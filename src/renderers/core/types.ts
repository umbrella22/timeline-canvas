import type { TimelineConfig, TimelineState } from "../../types";
import type { PluginManager } from "../../core/managers/PluginManager";

/**
 * 渲染上下文 - 传递给渲染器的所有数据
 *
 * 设计原则:
 * - 只读数据,渲染器不应修改配置和状态
 * - 包含所有渲染所需的信息
 * - 避免直接暴露 Timeline 实例
 */
export interface RenderContext {
  /** Canvas 2D 渲染上下文 */
  readonly ctx: CanvasRenderingContext2D;

  /** Canvas 元素(用于获取尺寸等信息) */
  readonly canvas: HTMLCanvasElement;

  /** 时间轴配置(只读) */
  readonly config: Readonly<TimelineConfig>;

  /** 时间轴状态(只读) */
  readonly state: Readonly<TimelineState>;

  /** 设备像素比 */
  readonly dpr: number;

  /** Canvas 逻辑宽度(CSS 像素) */
  readonly width: number;

  /** Canvas 逻辑高度(CSS 像素) */
  readonly height: number;

  /** 插件管理器(可选,用于插件钩子) */
  readonly pluginManager?: PluginManager;
}

/**
 * 渲染器接口 - 所有渲染器必须实现
 *
 * 渲染器应该是纯函数或无状态类:
 * - 不依赖外部状态
 * - 不修改传入的参数
 * - 相同输入总是产生相同输出
 */
export interface Renderer {
  /**
   * 渲染器名称(用于调试和性能分析)
   */
  readonly name: string;

  /**
   * 执行渲染
   * @param context 渲染上下文
   */
  render(context: RenderContext): void;

  /**
   * 检查是否需要重新渲染(可选)
   * @param context 渲染上下文
   * @param prevContext 上一次的渲染上下文(可选)
   * @returns 如果需要重新渲染返回 true
   */
  shouldRender?(context: RenderContext, prevContext?: RenderContext): boolean;
}

/**
 * 图层类型 - 用于脏检查和优化
 */
export type LayerType =
  | "background" // 背景层:纯色背景或网格
  | "timeline" // 时间轴层:时间刻度和标签
  | "tracks" // 轨道层:轨道背景和事件
  | "guideLines" // 辅助线层:对齐辅助线
  | "indicator" // 指示器层:时间指示器
  | "interaction" // 交互层:拖拽预览、选中状态
  | "scrollbar" // 滚动条层
  | "overlay"; // 覆盖层:插件渲染的内容

/**
 * 渲染选项 - 控制渲染行为
 */
export interface RenderOptions {
  /** 是否强制重新渲染所有图层 */
  forceFullRender?: boolean;

  /** 需要重新渲染的图层(如果不指定,使用脏检查) */
  dirtyLayers?: Set<LayerType>;

  /** 是否跳过性能测量 */
  skipPerfMeasure?: boolean;
}

/**
 * 渲染统计信息
 */
export interface RenderStats {
  /** 各图层的渲染耗时(毫秒) */
  layerTimes: Record<LayerType, number>;

  /** 总渲染耗时(毫秒) */
  totalTime: number;

  /** 本次渲染的图层数量 */
  renderedLayers: number;

  /** 跳过的图层数量 */
  skippedLayers: number;
}

/**
 * 工具函数:创建渲染上下文
 */
export function createRenderContext(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  config: TimelineConfig,
  state: TimelineState,
  dpr: number,
  pluginManager?: PluginManager
): RenderContext {
  return {
    ctx,
    canvas,
    config,
    state,
    dpr,
    width: canvas.width / dpr,
    height: canvas.height / dpr,
    pluginManager,
  };
}
