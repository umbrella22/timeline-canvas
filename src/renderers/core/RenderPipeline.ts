import type {
  Renderer,
  RenderContext,
  RenderOptions,
  RenderStats,
  LayerType,
} from "./types";

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

  private prevContext?: RenderContext;
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
        console.error(
          `[RenderPipeline] Error rendering layer "${layer}":`,
          error
        );
      }

      if (!skipPerfMeasure) {
        this.stats.layerTimes[layer] = performance.now() - layerStartTime;
      }
    }

    this.stats.totalTime = performance.now() - startTime;
    this.prevContext = context;

    return { ...this.stats };
  }

  /**
   * 判断图层是否需要渲染
   */
  private shouldRenderLayer(
    layer: LayerType,
    renderer: Renderer,
    context: RenderContext,
    forceFullRender: boolean,
    dirtyLayers?: Set<LayerType>
  ): boolean {
    // 强制全量渲染
    if (forceFullRender) return true;

    // 如果没有提供 dirtyLayers，使用渲染器的 shouldRender 判断
    if (!dirtyLayers) {
      if (renderer.shouldRender && this.prevContext) {
        return renderer.shouldRender(context, this.prevContext);
      }
      return true;
    }

    // 检查脏图层标记
    if (!dirtyLayers.has(layer)) {
      return false;
    }

    // 如果图层在 dirtyLayers 中，直接渲染
    // 不再调用 shouldRender()，因为 prevContext.state 和 context.state 是同一个对象引用
    // 导致 shouldRender() 无法正确检测变化
    return true;
  }

  /**
   * 获取最近一次的渲染统计
   */
  getStats(): Readonly<RenderStats> {
    return { ...this.stats };
  }

  /**
   * 清空上一次的渲染上下文(强制下次全量渲染)
   */
  clearPrevContext(): void {
    this.prevContext = undefined;
  }

  /**
   * 获取已注册的渲染器列表
   */
  getRegisteredRenderers(): ReadonlyMap<LayerType, Renderer> {
    return this.renderers;
  }
}
