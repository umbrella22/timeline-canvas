import type {
  Renderer,
  RenderContext,
  RenderOptions,
  RenderStats,
  LayerType,
} from "./types";
import { LogColors, getLogger } from "../../core/managers/Logger";

const logger = getLogger("RenderPipeline");

let lastPipelineLogTime = 0;

/**
 * 渲染管道 - 管理和执行多个渲染器
 *
 * 职责:
 * - 按顺序执行渲染器
 * - 跟踪脏图层,跳过不需要渲染的图层
 * - 收集性能统计信息
 * - 提供渲染器的注册和管理
 */
export class RenderPipeline {
  private renderers: Map<LayerType, Renderer> = new Map();
  private renderOrder: LayerType[] = [
    "background",
    "tracks",
    "timeline",
    "guideLines",
    "indicator",
    "interaction",
    "scrollbar",
    "overlay",
  ];

  private stats: RenderStats = {
    layerTimes: {} as Record<LayerType, number>,
    totalTime: 0,
    renderedLayers: 0,
    skippedLayers: 0,
  };

  /**
   * 注册渲染器
   */
  registerRenderer(layer: LayerType, renderer: Renderer): void {
    this.renderers.set(layer, renderer);
  }

  /**
   * 注销渲染器
   */
  unregisterRenderer(layer: LayerType): void {
    this.renderers.delete(layer);
  }

  /**
   * 设置渲染顺序
   */
  setRenderOrder(order: LayerType[]): void {
    this.renderOrder = order;
  }

  /**
   * 执行渲染
   */
  render(context: RenderContext, options: RenderOptions = {}): RenderStats {
    const startTime = performance.now();
    const {
      forceFullRender = false,
      dirtyLayers,
      skipPerfMeasure = false,
    } = options;

    const shouldLog = startTime - lastPipelineLogTime >= 250;
    if (shouldLog) {
      lastPipelineLogTime = startTime;
      logger.debugStyled(
        LogColors.pipeline,
        `▶ Render Start`,
        `forceFullRender=${forceFullRender}`,
        dirtyLayers
          ? `dirtyLayers=[${Array.from(dirtyLayers).join(", ")}]`
          : "dirtyLayers=all"
      );
    }

    this.stats.renderedLayers = 0;
    this.stats.skippedLayers = 0;
    this.stats.layerTimes = {} as Record<LayerType, number>;

    // 遍历渲染顺序
    for (const layer of this.renderOrder) {
      const renderer = this.renderers.get(layer);
      if (!renderer) continue;

      // 检查是否需要渲染此图层
      const shouldRender = this.shouldRenderLayer(
        layer,
        renderer,
        context,
        forceFullRender,
        dirtyLayers
      );

      if (!shouldRender) {
        this.stats.skippedLayers++;
        continue;
      }

      // 执行渲染
      const layerStartTime = skipPerfMeasure ? 0 : performance.now();

      try {
        renderer.render(context);
        this.stats.renderedLayers++;
      } catch (error) {
        logger.error(`Error rendering layer "${layer}":`, error);
      }

      if (!skipPerfMeasure) {
        this.stats.layerTimes[layer] = performance.now() - layerStartTime;
      }
    }

    this.stats.totalTime = performance.now() - startTime;
    if (shouldLog) {
      logger.debugStyled(
        LogColors.pipeline,
        `◀ Render End`,
        `rendered=${this.stats.renderedLayers}, skipped=${
          this.stats.skippedLayers
        }, time=${this.stats.totalTime.toFixed(2)}ms`
      );
    }

    return { ...this.stats };
  }

  /**
   * 判断图层是否需要渲染
   *
   * 完全依赖 ChangeScheduler 的脏层标记，不再使用 prevContext 对比。
   * 原因：TimelineState 是可变对象，prevContext.state 和 context.state
   * 是同一个引用，shouldRender() 无法正确检测变化。
   */
  private shouldRenderLayer(
    layer: LayerType,
    _renderer: Renderer,
    _context: RenderContext,
    forceFullRender: boolean,
    dirtyLayers?: Set<LayerType>
  ): boolean {
    // 强制全量渲染
    if (forceFullRender) return true;

    // 完全基于 dirtyLayers 判断
    if (!dirtyLayers) return true;
    return dirtyLayers.has(layer);
  }

  /**
   * 获取最近一次的渲染统计
   */
  getStats(): Readonly<RenderStats> {
    return { ...this.stats };
  }

  /**
   * 清空上一次的渲染上下文(保持兼容性，目前为空操作)
   * @deprecated 脏层判断已完全依赖 ChangeScheduler
   */
  clearPrevContext(): void {
    // no-op：脏层判断已完全依赖 ChangeScheduler
  }

  /**
   * 获取已注册的渲染器列表
   */
  getRegisteredRenderers(): ReadonlyMap<LayerType, Renderer> {
    return this.renderers;
  }
}
