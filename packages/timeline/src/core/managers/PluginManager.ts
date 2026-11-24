import type {
  CoreRenderTarget,
  PluginContext,
  PluginAPI,
  PluginEventMap,
  PluginEventHandler,
  TimelinePlugin,
  RenderLayer,
  CoreLayerHook,
  PerformanceProvider,
} from "../../plugins/types";
import { PluginType } from "../../plugins/types";
import { withPluginCanvas } from "../../renderers/core/canvasScope";
import type { TimelineConfig, TimelineState } from "../../types";
import { translateTimelineConfig } from "../../utils";
import { ErrorHandler } from "./ErrorHandler";
import { getLogger } from "./Logger";

export class PluginManager {
  private pluginMetadata: Map<string, TimelinePlugin["metadata"]> = new Map();
  private plugins: Map<
    string,
    { plugin: TimelinePlugin; context: PluginContext; active: boolean }
  > = new Map();
  private eventHandlers: Map<string, RegisteredEventHandler[]> = new Map();
  private renderLayers = new NamedRegistrations<RenderLayer>();
  private coreLayerHooks = new NamedRegistrations<CoreLayerHook>();
  private pluginData: Map<string, Map<string, unknown>> = new Map();
  private performanceProvider: PerformanceProvider | undefined;
  private performanceProviderOwner: string | undefined;
  private registrationOrder = 0;
  private destroyed = false;
  private destroyPromise: Promise<void> | undefined;
  private pendingLoads = new Map<string, Promise<boolean>>();
  private pendingUnloads = new Map<string, Promise<boolean>>();

  constructor(
    private baseContext: Omit<PluginContext, "api">,
    private errorHandler: ErrorHandler = new ErrorHandler(getLogger("PluginManager")),
  ) {}

  loadPlugin(plugin: TimelinePlugin): Promise<boolean> {
    const { name, version } = plugin.metadata;
    const pluginId = `${name}@${version}`;
    if (
      this.destroyed ||
      this.plugins.has(pluginId) ||
      this.pendingLoads.has(pluginId) ||
      this.pendingUnloads.has(pluginId)
    )
      return Promise.resolve(false);

    // Reserve the ID before invoking user lifecycle code, including reentrant calls.
    const task = Promise.resolve()
      .then(() => this.performLoad(pluginId, plugin))
      .finally(() => this.pendingLoads.delete(pluginId));
    this.pendingLoads.set(pluginId, task);
    return task;
  }

  private async performLoad(pluginId: string, plugin: TimelinePlugin): Promise<boolean> {
    if (this.destroyed) return false;
    if (!this.areDependenciesLoaded(plugin.metadata.dependencies)) {
      return this.errorHandler.fail(
        this.baseContext.config.debug,
        translateTimelineConfig(this.baseContext.config, "errorPluginDependenciesMissing", {
          pluginId,
        }),
        new Error(`Missing dependencies: ${plugin.metadata.dependencies?.join(", ")}`),
      );
    }

    this.pluginMetadata.set(pluginId, {
      ...plugin.metadata,
      dependencies: plugin.metadata.dependencies?.slice(),
    });
    // Themes can mutate the palette in-place before activation fails.
    const { config } = this.baseContext;
    const previousColors = plugin.metadata.type === PluginType.THEME ? config.colors : undefined;
    if (previousColors) {
      config.colors = { ...previousColors, eventColors: previousColors.eventColors.slice() };
    }
    const ctx = this.createPluginContext(pluginId);
    let initStarted = false;
    let activateStarted = false;
    let loaded = false;

    try {
      if (plugin.init) {
        initStarted = true;
        await plugin.init(ctx);
      }
      if (this.destroyed) return false;
      if (plugin.activate) {
        activateStarted = true;
        await plugin.activate(ctx);
      }
      if (this.destroyed) return false;
      this.plugins.set(pluginId, { plugin, context: ctx, active: true });
      loaded = true;
      return true;
    } catch (error) {
      return this.errorHandler.fail(
        this.baseContext.config.debug,
        translateTimelineConfig(this.baseContext.config, "errorPluginLoadFailed", {
          pluginId,
        }),
        error,
      );
    } finally {
      if (!loaded) {
        await this.rollbackFailedLoad(pluginId, plugin, ctx, initStarted, activateStarted);
        this.cleanupPluginResources(pluginId);
        if (previousColors) config.colors = previousColors;
      }
    }
  }

  unloadPlugin(pluginId: string): Promise<boolean> {
    if (this.hasDependentOn(pluginId)) return Promise.resolve(false);
    return this.detachPlugin(pluginId);
  }

  private detachPlugin(pluginId: string): Promise<boolean> {
    const pending = this.pendingUnloads.get(pluginId);
    if (pending) return pending;
    const entry = this.plugins.get(pluginId);
    if (!entry) return Promise.resolve(false);
    this.plugins.delete(pluginId);
    const task = Promise.resolve()
      .then(() => this.performUnload(pluginId, entry))
      .finally(() => {
        this.cleanupPluginResources(pluginId);
        this.pendingUnloads.delete(pluginId);
      });
    this.pendingUnloads.set(pluginId, task);
    return task;
  }

  private async performUnload(
    pluginId: string,
    entry: { plugin: TimelinePlugin; context: PluginContext },
  ): Promise<boolean> {
    let success = await this.runLifecycleStep(
      pluginId,
      "deactivate",
      entry.plugin.deactivate,
      entry.context,
    );

    const destroySucceeded = await this.runLifecycleStep(
      pluginId,
      "destroy",
      entry.plugin.destroy,
      entry.context,
    );

    if (!destroySucceeded) {
      success = false;
    }

    return success;
  }

  destroy(): Promise<void> {
    if (this.destroyPromise) return this.destroyPromise;
    this.destroyed = true;
    this.destroyPromise = Promise.resolve().then(() => this.disposePlugins());
    return this.destroyPromise;
  }

  private async disposePlugins(): Promise<void> {
    await Promise.allSettled([...this.pendingLoads.values(), ...this.pendingUnloads.values()]);
    // A later version can become the sole provider for an earlier name-only dependent.
    while (this.plugins.size) {
      const ids = [...this.plugins.keys()].reverse();
      const next = ids.find((id) => !this.hasDependentOn(id));
      // Version substitutions can form a dependency cycle. Destruction must still release all resources.
      await this.detachPlugin(next ?? ids[0]);
    }
    await Promise.allSettled(this.pendingUnloads.values());
  }

  private async rollbackFailedLoad(
    pluginId: string,
    plugin: TimelinePlugin,
    context: PluginContext,
    initStarted: boolean,
    activateStarted: boolean,
  ): Promise<void> {
    if (activateStarted) {
      await this.runLifecycleStep(pluginId, "rollback deactivate", plugin.deactivate, context);
    }

    if (initStarted || activateStarted) {
      await this.runLifecycleStep(pluginId, "rollback destroy", plugin.destroy, context);
    }
  }

  private async runLifecycleStep(
    pluginId: string,
    step: string,
    lifecycle: ((context: PluginContext) => Promise<void> | void) | undefined,
    context: PluginContext,
  ): Promise<boolean> {
    if (!lifecycle) {
      return true;
    }

    try {
      await lifecycle(context);
      return true;
    } catch (error) {
      return this.errorHandler.fail(
        this.baseContext.config.debug,
        translateTimelineConfig(this.baseContext.config, "errorPluginLifecycleFailed", {
          step,
          pluginId,
        }),
        error,
      );
    }
  }

  private createPluginContext(pluginId: string): PluginContext {
    const store = new Map<string, unknown>();
    this.pluginData.set(pluginId, store);
    const current = () => this.pluginData.get(pluginId) === store;
    const priority = this.getPluginPriority(pluginId);

    const api: PluginAPI = {
      registerRenderLayer: (layer) => {
        if (current())
          this.renderLayers.set(pluginId, layer, priority, this.nextRegistrationOrder());
      },
      unregisterRenderLayer: (name) => {
        if (current()) this.renderLayers.remove(pluginId, name);
      },
      registerCoreLayerHook: (hook) => {
        if (current())
          this.coreLayerHooks.set(pluginId, hook, priority, this.nextRegistrationOrder());
      },
      unregisterCoreLayerHook: (name) => {
        if (current()) this.coreLayerHooks.remove(pluginId, name);
      },
      registerEventHandler: (event: string, handler: PluginEventHandler) => {
        if (current()) this.registerEventHandler(pluginId, event, handler);
      },
      unregisterEventHandler: (event: string, handler: PluginEventHandler) => {
        if (current()) this.unregisterEventHandler(pluginId, event, handler);
      },
      showNotification: (message: string, type: "info" | "warning" | "error" = "info") => {
        const pluginLogger = getLogger(`plugin:${pluginId}`);
        switch (type) {
          case "error":
            pluginLogger.error(message);
            break;
          case "warning":
            pluginLogger.warn(message);
            break;
          default:
            pluginLogger.info(message);
        }
      },
      getData: (key: string) => store.get(key),
      setData: (key: string, value: unknown) => store.set(key, value),
      setPerformanceProvider: (provider: PerformanceProvider) => {
        if (!current()) return;
        this.performanceProvider = provider;
        this.performanceProviderOwner = pluginId;
      },
      getPerformanceStats: () => {
        return this.performanceProvider ? this.performanceProvider.getAllStats() : new Map();
      },
      getFPS: () => {
        return this.performanceProvider ? this.performanceProvider.getFPS() : 0;
      },
    };

    return { ...this.baseContext, api };
  }

  private registerEventHandler(pluginId: string, event: string, handler: PluginEventHandler): void {
    // Copy on registration: in-progress emits and validations keep their dispatch snapshot.
    const list = this.eventHandlers.get(event)?.slice() ?? [];
    list.push({
      pluginId,
      handler,
      priority: this.getPluginPriority(pluginId),
      order: this.nextRegistrationOrder(),
    });
    list.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.order - b.order;
    });
    this.eventHandlers.set(event, list);
  }

  private unregisterEventHandler(
    pluginId: string,
    event: string,
    handler: PluginEventHandler,
  ): void {
    const list = this.eventHandlers.get(event);
    if (!list) return;

    const nextList = list.filter((entry) => {
      return !(entry.pluginId === pluginId && entry.handler === handler);
    });

    if (nextList.length === 0) {
      this.eventHandlers.delete(event);
    } else {
      this.eventHandlers.set(event, nextList);
    }
  }

  getCoreLayerHooks(target: CoreRenderTarget): CoreLayerHook[] {
    return this.coreLayerHooks.matching((hook) => hook.target === target);
  }

  hasCoreLayerHooks(target: CoreRenderTarget): boolean {
    return this.getCoreLayerHooks(target).length > 0;
  }

  private cleanupPluginResources(pluginId: string): void {
    this.renderLayers.removeOwner(pluginId);
    this.coreLayerHooks.removeOwner(pluginId);
    for (const [event, handlers] of this.eventHandlers) {
      const remaining = handlers.filter((entry) => entry.pluginId !== pluginId);
      if (remaining.length) this.eventHandlers.set(event, remaining);
      else this.eventHandlers.delete(event);
    }

    if (this.performanceProviderOwner === pluginId) {
      this.performanceProvider = undefined;
      this.performanceProviderOwner = undefined;
    }

    this.pluginData.get(pluginId)?.clear();
    this.pluginData.delete(pluginId);
    this.pluginMetadata.delete(pluginId);
  }

  /** 已知键按 PluginEventMap tuple 强类型发射；自定义扩展走 unknown 边界 */
  emitEvent<K extends keyof PluginEventMap & string>(event: K, ...args: PluginEventMap[K]): void;
  emitEvent(event: string, ...args: unknown[]): void;
  emitEvent(event: string, ...args: unknown[]): void {
    const list = this.eventHandlers.get(event);
    if (!list || list.length === 0) return;
    for (const entry of list) {
      try {
        if (event === "render:event:media") {
          withPluginCanvas(args[0] as CanvasRenderingContext2D, (ctx) =>
            entry.handler(ctx, ...args.slice(1)),
          );
        } else {
          entry.handler(...args);
        }
      } catch (error) {
        this.errorHandler.debugIf(
          this.baseContext.config.debug,
          translateTimelineConfig(this.baseContext.config, "errorPluginEventFailed", {
            event,
          }),
          error,
        );
      }
    }
  }

  validateEvent<K extends keyof PluginEventMap & string>(
    event: K,
    ...args: PluginEventMap[K]
  ): boolean;
  validateEvent(event: string, ...args: unknown[]): boolean;
  validateEvent(event: string, ...args: unknown[]): boolean {
    const list = this.eventHandlers.get(event);
    if (!list || list.length === 0) return true;
    for (const entry of list) {
      try {
        const r = entry.handler(...args);
        if (r === false) return false;
      } catch (error) {
        this.errorHandler.debugIf(
          this.baseContext.config.debug,
          translateTimelineConfig(this.baseContext.config, "errorPluginValidationFailed", {
            event,
          }),
          error,
        );
        return false;
      }
    }
    return true;
  }

  renderBackground(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: TimelineConfig,
    state: TimelineState,
  ): void {
    this.renderLayersAt("background", ctx, canvas, config, state);
  }

  renderOverlay(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: TimelineConfig,
    state: TimelineState,
  ): void {
    this.renderLayersAt("overlay", ctx, canvas, config, state);
  }

  private renderLayersAt(
    position: RenderLayer["position"],
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: TimelineConfig,
    state: TimelineState,
  ): void {
    for (const layer of this.renderLayers.matching((item) => item.position === position)) {
      try {
        withPluginCanvas(ctx, (scoped) => layer.render(scoped, canvas, config, state));
      } catch (error) {
        this.errorHandler.debugIf(
          config.debug,
          translateTimelineConfig(config, "errorRenderLayer", { layer: layer.name }),
          error,
        );
      }
    }
  }

  getLoadedPlugins(): TimelinePlugin[] {
    return Array.from(this.plugins.values()).map((p) => p.plugin);
  }

  isPluginLoaded(pluginName: string): boolean {
    for (const [pluginId] of this.plugins) {
      if (pluginId.startsWith(`${pluginName}@`)) {
        return true;
      }
    }
    return false;
  }

  measureStart(name: string): void {
    if (this.performanceProvider) this.performanceProvider.startMeasurement(name);
  }

  measureEnd(name: string): void {
    if (this.performanceProvider) this.performanceProvider.endMeasurement(name);
  }

  private dependencyAvailable(dependency: string, excluding?: string): boolean {
    for (const [id, { plugin }] of this.plugins) {
      if (id !== excluding && (id === dependency || plugin.metadata.name === dependency))
        return true;
    }
    return false;
  }

  private areDependenciesLoaded(dependencies?: string[]): boolean {
    return dependencies?.every((dep) => this.dependencyAvailable(dep)) ?? true;
  }

  private hasDependentOn(pluginId: string): boolean {
    // Metadata spans init/activate, active use, and deactivate/destroy, including their awaits.
    const name = this.pluginMetadata.get(pluginId)?.name;
    for (const [id, metadata] of this.pluginMetadata) {
      if (
        id !== pluginId &&
        metadata.dependencies?.some(
          (dep) => (dep === pluginId || dep === name) && !this.dependencyAvailable(dep, pluginId),
        )
      )
        return true;
    }
    return false;
  }

  private getPluginPriority(pluginId: string): number {
    return this.pluginMetadata.get(pluginId)?.priority ?? 0;
  }

  private nextRegistrationOrder(): number {
    const current = this.registrationOrder;
    this.registrationOrder += 1;
    return current;
  }
}

interface RegisteredEventHandler {
  pluginId: string;
  handler: PluginEventHandler;
  priority: number;
  order: number;
}

interface Registration<T> {
  owner: string;
  resource: T;
  priority: number;
  order: number;
}

/** Last registration wins per name. Unloading a replacement reveals the last live owner. */
class NamedRegistrations<T extends { name: string }> {
  private entries = new Map<string, Registration<T>[]>();

  set(owner: string, resource: T, priority: number, order: number): void {
    this.remove(owner, resource.name);
    const stack = this.entries.get(resource.name) ?? [];
    stack.push({ owner, resource, priority, order });
    this.entries.set(resource.name, stack);
  }

  remove(owner: string, name: string): void {
    const stack = this.entries.get(name);
    if (!stack) return;
    const index = stack.findIndex((registration) => registration.owner === owner);
    if (index >= 0) stack.splice(index, 1);
    if (stack.length === 0) this.entries.delete(name);
  }

  removeOwner(owner: string): void {
    for (const name of this.entries.keys()) this.remove(owner, name);
  }

  matching(predicate: (resource: T) => boolean): T[] {
    const matches: Registration<T>[] = [];
    for (const stack of this.entries.values()) {
      const active = stack[stack.length - 1];
      if (predicate(active.resource)) matches.push(active);
    }
    return matches
      .sort((a, b) => b.priority - a.priority || a.order - b.order)
      .map((r) => r.resource);
  }
}
