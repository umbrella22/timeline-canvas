import type {
  PluginContext,
  TimelinePlugin,
  RenderLayer,
  PerformanceProvider,
} from "../../plugins/types";
import { getLogger } from "./Logger";

const logger = getLogger("PluginManager");

export class PluginManager {
  private plugins: Map<
    string,
    { plugin: TimelinePlugin; context: PluginContext; active: boolean }
  > = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();
  private renderLayers: Map<string, RenderLayer> = new Map();
  private pluginData: Map<string, Map<string, any>> = new Map();
  private performanceProvider: PerformanceProvider | undefined;

  constructor(private baseContext: Omit<PluginContext, "api">) {}

  async loadPlugin(plugin: TimelinePlugin): Promise<boolean> {
    const { name, version } = plugin.metadata;
    const pluginId = `${name}@${version}`;
    if (this.plugins.has(pluginId)) return false;

    const ctx = this.createPluginContext(pluginId);
    try {
      if (plugin.init) await plugin.init(ctx);
      if (plugin.activate) await plugin.activate(ctx);
      this.plugins.set(pluginId, { plugin, context: ctx, active: true });
      return true;
    } catch {
      return false;
    }
  }

  async unloadPlugin(pluginId: string): Promise<boolean> {
    const entry = this.plugins.get(pluginId);
    if (!entry) return false;
    try {
      if (entry.plugin.deactivate) await entry.plugin.deactivate(entry.context);
      if (entry.plugin.destroy) await entry.plugin.destroy(entry.context);
    } finally {
      this.cleanupPluginResources(pluginId);
      this.plugins.delete(pluginId);
    }
    return true;
  }

  private createPluginContext(pluginId: string): PluginContext {
    const store = new Map<string, any>();
    this.pluginData.set(pluginId, store);

    const api = {
      registerRenderLayer: (layer: RenderLayer) =>
        this.registerRenderLayer(pluginId, layer),
      unregisterRenderLayer: (name: string) =>
        this.unregisterRenderLayer(pluginId, name),
      registerEventHandler: (event: string, handler: Function) =>
        this.registerEventHandler(pluginId, event, handler),
      unregisterEventHandler: (event: string, handler: Function) =>
        this.unregisterEventHandler(pluginId, event, handler),
      showNotification: (
        message: string,
        type: "info" | "warning" | "error" = "info"
      ) => {
        // 使用日志管理器输出插件通知
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
      setData: (key: string, value: any) => store.set(key, value),
      setPerformanceProvider: (provider: PerformanceProvider) => {
        this.performanceProvider = provider;
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

    return { ...this.baseContext, api } as PluginContext;
  }

  private registerEventHandler(
    _pluginId: string,
    event: string,
    handler: Function
  ): void {
    const list = this.eventHandlers.get(event) || [];
    list.push(handler);
    this.eventHandlers.set(event, list);
  }

  private unregisterEventHandler(
    _pluginId: string,
    event: string,
    handler: Function
  ): void {
    const list = this.eventHandlers.get(event);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx >= 0) list.splice(idx, 1);
    this.eventHandlers.set(event, list);
  }

  private registerRenderLayer(_pluginId: string, layer: RenderLayer): void {
    this.renderLayers.set(layer.name, layer);
  }

  private unregisterRenderLayer(_pluginId: string, name: string): void {
    this.renderLayers.delete(name);
  }

  private cleanupPluginResources(pluginId: string): void {
    // 清理插件私有数据
    this.pluginData.delete(pluginId);
    // 渲染层按名称由插件在 destroy 时自行清理；这里作为兜底删除其命名空间前缀的层
    for (const [name] of this.renderLayers) {
      if (name.startsWith(pluginId)) this.renderLayers.delete(name);
    }
    // 事件处理器无需全局清理（弱引用策略），由插件管理
  }

  emitEvent(event: string, ...args: any[]): void {
    const list = this.eventHandlers.get(event);
    if (!list || list.length === 0) return;
    for (const fn of list) {
      try {
        (fn as any)(...args);
      } catch {}
    }
  }

  validateEvent(event: string, ...args: any[]): boolean {
    const list = this.eventHandlers.get(event);
    if (!list || list.length === 0) return true;
    for (const fn of list) {
      try {
        const r = (fn as any)(...args);
        if (r === false) return false;
      } catch {}
    }
    return true;
  }

  renderBackground(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: any,
    state: any
  ): void {
    for (const layer of this.layersByPosition("background")) {
      layer.render(ctx, canvas, config, state);
    }
  }

  renderOverlay(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: any,
    state: any
  ): void {
    for (const layer of this.layersByPosition("overlay")) {
      layer.render(ctx, canvas, config, state);
    }
  }

  private layersByPosition(pos: "background" | "overlay"): RenderLayer[] {
    return Array.from(this.renderLayers.values()).filter(
      (l) => l.position === pos
    );
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
}
