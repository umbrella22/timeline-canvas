import type { Timeline } from "../core/Timeline";
import type { TimelineConfig, TimelineState } from "../types";
import type { PerformanceStats } from "../utils/performanceMonitor";

export enum PluginType {
  RENDER = "render",
  EVENT_HANDLER = "event_handler",
  DATA_SOURCE = "data_source",
  THEME = "theme",
  TOOL = "tool",
  EXTENSION = "extension",
}

export enum PluginPriority {
  LOW = 0,
  NORMAL = 50,
  HIGH = 100,
  CRITICAL = 200,
}

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  type: PluginType;
  priority?: PluginPriority;
  dependencies?: string[];
}

export type RenderLayerPosition = "background" | "overlay";

export interface RenderLayer {
  name: string;
  position: RenderLayerPosition;
  render: (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: TimelineConfig,
    state: TimelineState
  ) => void;
}

/**
 * 可被插件钩子拦截的核心渲染层
 */
export type CoreRenderTarget =
  | "tracks"
  | "timeline"
  | "guideLines"
  | "indicator"
  | "scrollbar"
  | "interaction";

/**
 * 核心层钩子 — 允许插件拦截、修改或替换核心渲染层的行为
 *
 * `handler` 中调用 `next()` 执行默认渲染，不调用则完全替换默认行为。
 * 多个钩子按注册顺序形成中间件链。
 *
 * @example
 * ```ts
 * // 修改轨道渲染：添加自定义背景后执行默认渲染
 * registerCoreLayerHook({
 *   name: "custom-track-bg",
 *   target: "tracks",
 *   handler(ctx, canvas, config, state, next) {
 *     ctx.save();
 *     ctx.fillStyle = "rgba(0,0,255,0.05)";
 *     ctx.fillRect(0, 0, canvas.width, canvas.height);
 *     ctx.restore();
 *     next(); // 执行默认轨道渲染
 *   }
 * });
 *
 * // 完全替换时间轴刻度渲染
 * registerCoreLayerHook({
 *   name: "custom-timeline",
 *   target: "timeline",
 *   handler(ctx, canvas, config, state, _next) {
 *     // 不调用 next()，完全自定义绘制
 *     drawMyCustomTimeline(ctx, canvas, config, state);
 *   }
 * });
 * ```
 */
export interface CoreLayerHook {
  /** 钩子名称，唯一标识 */
  name: string;
  /** 目标核心渲染层 */
  target: CoreRenderTarget;
  /** 钩子处理函数 */
  handler: (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: TimelineConfig,
    state: TimelineState,
    next: () => void
  ) => void;
}

export type PluginEventHandler = (...args: any[]) => unknown;

export interface PluginAPI {
  registerRenderLayer: (layer: RenderLayer) => void;
  unregisterRenderLayer: (name: string) => void;
  registerCoreLayerHook: (hook: CoreLayerHook) => void;
  unregisterCoreLayerHook: (name: string) => void;
  registerEventHandler: (event: string, handler: PluginEventHandler) => void;
  unregisterEventHandler: (event: string, handler: PluginEventHandler) => void;
  showNotification: (message: string, type?: "info" | "warning" | "error") => void;
  getData: (key: string) => any;
  setData: (key: string, value: any) => void;
  setPerformanceProvider: (provider: PerformanceProvider) => void;
  getPerformanceStats: () => Map<string, PerformanceStats>;
  getFPS: () => number;
}

export interface PluginContext {
  timeline: Timeline;
  config: TimelineConfig;
  state: TimelineState;
  api: PluginAPI;
}

export interface TimelinePlugin {
  metadata: PluginMetadata;
  init?: (context: PluginContext) => Promise<void> | void;
  activate?: (context: PluginContext) => Promise<void> | void;
  deactivate?: (context: PluginContext) => Promise<void> | void;
  destroy?: (context: PluginContext) => Promise<void> | void;
}

export interface PerformanceProvider {
  startMeasurement: (name: string) => void;
  endMeasurement: (name: string) => void;
  getAllStats: () => Map<string, PerformanceStats>;
  getFPS: () => number;
}
