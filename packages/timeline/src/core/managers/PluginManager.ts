import type {
  CoreRenderTarget,
  PluginContext,
  PluginAPI,
  PluginEventHandler,
  TimelinePlugin,
  RenderLayer,
  CoreLayerHook,
  PerformanceProvider,
} from "../../plugins/types";
import type { TimelineConfig, TimelineState } from "../../types";
import { translateTimelineConfig } from "../../utils";
import { ErrorHandler } from "./ErrorHandler";
import { getLogger } from "./Logger";

export class PluginManager {
  private pluginResources: Map<string, PluginResources> = new Map();
  private pluginMetadata: Map<string, TimelinePlugin["metadata"]> = new Map();
  private plugins: Map<
    string,
    { plugin: TimelinePlugin; context: PluginContext; active: boolean }
  > = new Map();
  private eventHandlers: Map<string, RegisteredEventHandler[]> = new Map();
  private renderLayers: Map<string, RenderLayer> = new Map();
  private renderLayerOwners: Map<string, string> = new Map();
  private renderLayerOrder: Map<string, number> = new Map();
  private coreLayerHooks: Map<string, CoreLayerHook> = new Map();
  private coreLayerHookOwners: Map<string, string> = new Map();
  private coreLayerHookOrder: Map<string, number> = new Map();
  private pluginData: Map<string, Map<string, unknown>> = new Map();
  private performanceProvider: PerformanceProvider | undefined;
  private performanceProviderOwner: string | undefined;
  private registrationOrder = 0;

  constructor(
    private baseContext: Omit<PluginContext, "api">,
    private errorHandler: ErrorHandler = new ErrorHandler(
      getLogger("PluginManager")
    )
  ) {}

  async loadPlugin(plugin: TimelinePlugin): Promise<boolean> {
    const { name, version } = plugin.metadata;
    const pluginId = `${name}@${version}`;
    if (this.plugins.has(pluginId)) return false;
    if (!this.areDependenciesLoaded(plugin.metadata.dependencies)) {
      return this.errorHandler.fail(
        this.baseContext.config.debug,
        translateTimelineConfig(
          this.baseContext.config,
          "errorPluginDependenciesMissing",
          { pluginId }
        ),
        new Error(
          `Missing dependencies: ${plugin.metadata.dependencies?.join(", ")}`
        )
      );
    }

    this.pluginMetadata.set(pluginId, plugin.metadata);
    const ctx = this.createPluginContext(pluginId);
    let initStarted = false;
    let activateStarted = false;

    try {
      if (plugin.init) {
        initStarted = true;
        await plugin.init(ctx);
      }
      if (plugin.activate) {
        activateStarted = true;
        await plugin.activate(ctx);
      }
      this.plugins.set(pluginId, { plugin, context: ctx, active: true });
      return true;
    } catch (error) {
      await this.rollbackFailedLoad(
        pluginId,
        plugin,
        ctx,
        initStarted,
        activateStarted
      );
      this.cleanupPluginResources(pluginId);
      return this.errorHandler.fail(
        this.baseContext.config.debug,
        translateTimelineConfig(this.baseContext.config, "errorPluginLoadFailed", {
          pluginId,
        }),
        error
      );
    }
  }

  async unloadPlugin(pluginId: string): Promise<boolean> {
    const entry = this.plugins.get(pluginId);
    if (!entry) return false;
    let success = await this.runLifecycleStep(
      pluginId,
      "deactivate",
      entry.plugin.deactivate,
      entry.context
    );

    const destroySucceeded = await this.runLifecycleStep(
      pluginId,
      "destroy",
      entry.plugin.destroy,
      entry.context
    );

    if (!destroySucceeded) {
      success = false;
    }

    try {
      return success;
    } finally {
      this.cleanupPluginResources(pluginId);
      this.plugins.delete(pluginId);
    }
  }

  private async rollbackFailedLoad(
    pluginId: string,
    plugin: TimelinePlugin,
    context: PluginContext,
    initStarted: boolean,
    activateStarted: boolean
  ): Promise<void> {
    if (activateStarted) {
      await this.runLifecycleStep(
        pluginId,
        "rollback deactivate",
        plugin.deactivate,
        context
      );
    }

    if (initStarted || activateStarted) {
      await this.runLifecycleStep(
        pluginId,
        "rollback destroy",
        plugin.destroy,
        context
      );
    }
  }

  private async runLifecycleStep(
    pluginId: string,
    step: string,
    lifecycle:
      | ((context: PluginContext) => Promise<void> | void)
      | undefined,
    context: PluginContext
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
        translateTimelineConfig(
          this.baseContext.config,
          "errorPluginLifecycleFailed",
          { step, pluginId }
        ),
        error
      );
    }
  }

  private createPluginContext(pluginId: string): PluginContext {
    const store = new Map<string, unknown>();
    this.pluginData.set(pluginId, store);
    this.pluginResources.set(pluginId, this.createPluginResources());

    const api: PluginAPI = {
      registerRenderLayer: (layer: RenderLayer) =>
        this.registerRenderLayer(pluginId, layer),
      unregisterRenderLayer: (name: string) =>
        this.unregisterRenderLayer(pluginId, name),
      registerCoreLayerHook: (hook: CoreLayerHook) =>
        this.registerCoreLayerHook(pluginId, hook),
      unregisterCoreLayerHook: (name: string) =>
        this.unregisterCoreLayerHook(pluginId, name),
      registerEventHandler: (event: string, handler: PluginEventHandler) =>
        this.registerEventHandler(pluginId, event, handler),
      unregisterEventHandler: (event: string, handler: PluginEventHandler) =>
        this.unregisterEventHandler(pluginId, event, handler),
      showNotification: (
        message: string,
        type: "info" | "warning" | "error" = "info"
      ) => {
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
        this.performanceProvider = provider;
        this.performanceProviderOwner = pluginId;
      },
      getPerformanceStats: () => {
        return this.performanceProvider
          ? this.performanceProvider.getAllStats()
          : new Map();
      },
      getFPS: () => {
        return this.performanceProvider ? this.performanceProvider.getFPS() : 0;
      },
    };

    return { ...this.baseContext, api };
  }

  private registerEventHandler(
    pluginId: string,
    event: string,
    handler: PluginEventHandler
  ): void {
    const list = this.eventHandlers.get(event) || [];
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

    const resources = this.getPluginResources(pluginId);
    const handlers = resources.eventHandlers.get(event) ?? new Set();
    handlers.add(handler);
    resources.eventHandlers.set(event, handlers);
  }

  private unregisterEventHandler(
    pluginId: string,
    event: string,
    handler: PluginEventHandler
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

    const resources = this.pluginResources.get(pluginId);
    const handlers = resources?.eventHandlers.get(event);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      resources?.eventHandlers.delete(event);
    }
  }

  private registerRenderLayer(pluginId: string, layer: RenderLayer): void {
    this.reassignRenderLayerOwner(layer.name, pluginId);
    this.renderLayers.set(layer.name, layer);
    this.renderLayerOwners.set(layer.name, pluginId);
    this.renderLayerOrder.set(layer.name, this.nextRegistrationOrder());
    this.getPluginResources(pluginId).renderLayers.add(layer.name);
  }

  private unregisterRenderLayer(pluginId: string, name: string): void {
    if (this.renderLayerOwners.get(name) !== pluginId) {
      return;
    }
    this.renderLayers.delete(name);
    this.renderLayerOwners.delete(name);
    this.renderLayerOrder.delete(name);
    this.pluginResources.get(pluginId)?.renderLayers.delete(name);
  }

  private registerCoreLayerHook(
    pluginId: string,
    hook: CoreLayerHook
  ): void {
    this.reassignCoreLayerHookOwner(hook.name, pluginId);
    this.coreLayerHooks.set(hook.name, hook);
    this.coreLayerHookOwners.set(hook.name, pluginId);
    this.coreLayerHookOrder.set(hook.name, this.nextRegistrationOrder());
    this.getPluginResources(pluginId).coreLayerHooks.add(hook.name);
  }

  private unregisterCoreLayerHook(pluginId: string, name: string): void {
    if (this.coreLayerHookOwners.get(name) !== pluginId) {
      return;
    }
    this.coreLayerHooks.delete(name);
    this.coreLayerHookOwners.delete(name);
    this.coreLayerHookOrder.delete(name);
    this.pluginResources.get(pluginId)?.coreLayerHooks.delete(name);
  }

  /**
   * 获取指定核心渲染层的所有钩子
   */
  getCoreLayerHooks(target: CoreRenderTarget): CoreLayerHook[] {
    return Array.from(this.coreLayerHooks.entries())
      .filter(([, hook]) => hook.target === target)
      .sort(([nameA], [nameB]) => this.compareOwnedResources(nameA, nameB))
      .map(([, hook]) => hook);
  }

  /**
   * 检查指定核心渲染层是否有钩子注册
   */
  hasCoreLayerHooks(target: CoreRenderTarget): boolean {
    for (const hook of this.coreLayerHooks.values()) {
      if (hook.target === target) return true;
    }
    return false;
  }

  private cleanupPluginResources(pluginId: string): void {
    const resources = this.pluginResources.get(pluginId);

    if (resources) {
      for (const [event, handlers] of resources.eventHandlers) {
        const list = this.eventHandlers.get(event);
        if (!list) continue;

        const nextList = list.filter((entry) => {
          return !(entry.pluginId === pluginId && handlers.has(entry.handler));
        });

        if (nextList.length === 0) {
          this.eventHandlers.delete(event);
        } else {
          this.eventHandlers.set(event, nextList);
        }
      }

      for (const name of resources.renderLayers) {
        if (this.renderLayerOwners.get(name) !== pluginId) continue;
        this.renderLayers.delete(name);
        this.renderLayerOwners.delete(name);
        this.renderLayerOrder.delete(name);
      }

      for (const name of resources.coreLayerHooks) {
        if (this.coreLayerHookOwners.get(name) !== pluginId) continue;
        this.coreLayerHooks.delete(name);
        this.coreLayerHookOwners.delete(name);
        this.coreLayerHookOrder.delete(name);
      }
    }

    if (this.performanceProviderOwner === pluginId) {
      this.performanceProvider = undefined;
      this.performanceProviderOwner = undefined;
    }

    this.pluginData.delete(pluginId);
    this.pluginMetadata.delete(pluginId);
    this.pluginResources.delete(pluginId);
  }

  emitEvent(event: string, ...args: unknown[]): void {
    const list = this.eventHandlers.get(event);
    if (!list || list.length === 0) return;
    for (const entry of list) {
      try {
        entry.handler(...args);
      } catch (error) {
        this.errorHandler.debugIf(
          this.baseContext.config.debug,
          translateTimelineConfig(this.baseContext.config, "errorPluginEventFailed", {
            event,
          }),
          error
        );
      }
    }
  }

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
          translateTimelineConfig(
            this.baseContext.config,
            "errorPluginValidationFailed",
            { event }
          ),
          error
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
    state: TimelineState
  ): void {
    for (const layer of this.layersByPosition("background")) {
      layer.render(ctx, canvas, config, state);
    }
  }

  renderOverlay(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: TimelineConfig,
    state: TimelineState
  ): void {
    for (const layer of this.layersByPosition("overlay")) {
      layer.render(ctx, canvas, config, state);
    }
  }

  private layersByPosition(pos: "background" | "overlay"): RenderLayer[] {
    return Array.from(this.renderLayers.entries())
      .filter(([, layer]) => layer.position === pos)
      .sort(([nameA], [nameB]) => this.compareOwnedResources(nameA, nameB))
      .map(([, layer]) => layer);
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
    if (this.performanceProvider)
      this.performanceProvider.startMeasurement(name);
  }

  measureEnd(name: string): void {
    if (this.performanceProvider) this.performanceProvider.endMeasurement(name);
  }

  private createPluginResources(): PluginResources {
    return {
      eventHandlers: new Map(),
      renderLayers: new Set(),
      coreLayerHooks: new Set(),
    };
  }

  private getPluginResources(pluginId: string): PluginResources {
    let resources = this.pluginResources.get(pluginId);
    if (resources) {
      return resources;
    }

    resources = this.createPluginResources();
    this.pluginResources.set(pluginId, resources);
    return resources;
  }

  private reassignRenderLayerOwner(name: string, pluginId: string): void {
    const previousOwner = this.renderLayerOwners.get(name);
    if (!previousOwner || previousOwner === pluginId) {
      return;
    }

    this.pluginResources.get(previousOwner)?.renderLayers.delete(name);
  }

  private reassignCoreLayerHookOwner(name: string, pluginId: string): void {
    const previousOwner = this.coreLayerHookOwners.get(name);
    if (!previousOwner || previousOwner === pluginId) {
      return;
    }

    this.pluginResources.get(previousOwner)?.coreLayerHooks.delete(name);
  }

  private areDependenciesLoaded(dependencies?: string[]): boolean {
    if (!dependencies || dependencies.length === 0) {
      return true;
    }

    return dependencies.every((dependency) => {
      if (this.plugins.has(dependency)) {
        return true;
      }
      return this.isPluginLoaded(dependency);
    });
  }

  private getPluginPriority(pluginId: string): number {
    return this.pluginMetadata.get(pluginId)?.priority ?? 0;
  }

  private nextRegistrationOrder(): number {
    const current = this.registrationOrder;
    this.registrationOrder += 1;
    return current;
  }

  private compareOwnedResources(nameA: string, nameB: string): number {
    const ownerA =
      this.renderLayerOwners.get(nameA) ?? this.coreLayerHookOwners.get(nameA);
    const ownerB =
      this.renderLayerOwners.get(nameB) ?? this.coreLayerHookOwners.get(nameB);
    const priorityA = ownerA ? this.getPluginPriority(ownerA) : 0;
    const priorityB = ownerB ? this.getPluginPriority(ownerB) : 0;
    if (priorityB !== priorityA) {
      return priorityB - priorityA;
    }

    const orderA =
      this.renderLayerOrder.get(nameA) ?? this.coreLayerHookOrder.get(nameA) ?? 0;
    const orderB =
      this.renderLayerOrder.get(nameB) ?? this.coreLayerHookOrder.get(nameB) ?? 0;
    return orderA - orderB;
  }
}

interface RegisteredEventHandler {
  pluginId: string;
  handler: PluginEventHandler;
  priority: number;
  order: number;
}

interface PluginResources {
  eventHandlers: Map<string, Set<PluginEventHandler>>;
  renderLayers: Set<string>;
  coreLayerHooks: Set<string>;
}
