import type { TimelineConfig, TimelineState } from "../../types";
import type { PluginManager } from "./PluginManager";
import { ViewportManager } from "./ViewportManager";
import { RenderPipeline } from "../../renderers/core/RenderPipeline";
import { TimelineRenderer } from "../../renderers/layers/TimelineRenderer";
import { TracksRenderer } from "../../renderers/layers/TracksRenderer";
import { ScrollbarRenderer } from "../../renderers/layers/ScrollbarRenderer";
import { IndicatorRenderer } from "../../renderers/layers/IndicatorRenderer";
import { GuideLinesRenderer } from "../../renderers/layers/GuideLinesRenderer";
import { InteractionRenderer } from "../../renderers/layers/InteractionRenderer";
import { createRenderContext } from "../../renderers/core/types";

export class RenderManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: TimelineConfig;
  private state: TimelineState;
  private pluginManager: PluginManager;
  private dpr: number;
  private cachedLogicalWidth = 0;
  private cachedLogicalHeight = 0;
  private cacheValid = false;
  private logicalCanvas: {
    width: number;
    height: number;
    getContext: HTMLCanvasElement["getContext"];
  };
  private viewport: ViewportManager;
  private dirtyLayers: Set<
    | "background"
    | "tracks"
    | "timeline"
    | "guideLines"
    | "indicator"
    | "scrollbar"
    | "overlay"
    | "interaction"
  > = new Set([
    "background",
    "tracks",
    "timeline",
    "guideLines",
    "indicator",
    "scrollbar",
    "overlay",
    "interaction",
  ]);
  private lastLayerTimes: Record<string, number> = {};
  private isFirstRender = true;
  private renderPipeline: RenderPipeline; // 新的渲染管道(架构准备,暂未启用)

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    config: TimelineConfig,
    state: TimelineState,
    pluginManager: PluginManager
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.config = config;
    this.state = state;
    this.pluginManager = pluginManager;
    this.dpr = window.devicePixelRatio || 1;
    this.logicalCanvas = {
      width: 0,
      height: 0,
      getContext: this.canvas.getContext.bind(this.canvas),
    };
    this.viewport = new ViewportManager(this.config, this.state);

    // 初始化新的渲染管道
    this.renderPipeline = new RenderPipeline();
    this.renderPipeline.registerRenderer("timeline", new TimelineRenderer());
    this.renderPipeline.registerRenderer("tracks", new TracksRenderer());
    this.renderPipeline.registerRenderer(
      "guideLines",
      new GuideLinesRenderer()
    );
    this.renderPipeline.registerRenderer("indicator", new IndicatorRenderer());
    this.renderPipeline.registerRenderer("scrollbar", new ScrollbarRenderer());
    this.renderPipeline.registerRenderer(
      "interaction",
      new InteractionRenderer()
    );
  }

  public setCanvasSize(width: number, height: number): void {
    const actualWidth = Math.floor(width * this.dpr);
    const actualHeight = Math.floor(height * this.dpr);
    if (
      Math.abs(this.canvas.width - actualWidth) < 1 &&
      Math.abs(this.canvas.height - actualHeight) < 1
    ) {
      return;
    }
    this.canvas.width = actualWidth;
    this.canvas.height = actualHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.invalidateCache();
    const contentHeight = this.getContentHeight();
    const maxScrollY = Math.max(
      0,
      contentHeight - this.getCachedLogicalHeight()
    );
    this.state.scrollY = Math.max(0, Math.min(maxScrollY, this.state.scrollY));
    if (this.state.zoomLevel < this.config.minAutoFitZoom) {
      this.state.zoomLevel = this.config.minAutoFitZoom;
      this.state.scrollX = 0;
    }
    this.dirtyLayers.add("tracks");
    this.dirtyLayers.add("timeline");
    this.dirtyLayers.add("indicator");
    this.dirtyLayers.add("scrollbar");
    this.draw();
  }

  public getCanvasLogicalWidth(): number {
    return this.canvas.width / this.dpr;
  }

  public getCanvasLogicalHeight(): number {
    return this.canvas.height / this.dpr;
  }

  public getCachedLogicalWidth(): number {
    if (!this.cacheValid) {
      this.cachedLogicalWidth = this.canvas.width / this.dpr;
      this.cachedLogicalHeight = this.canvas.height / this.dpr;
      this.cacheValid = true;
    }
    return this.cachedLogicalWidth;
  }

  public getCachedLogicalHeight(): number {
    if (!this.cacheValid) {
      this.cachedLogicalWidth = this.canvas.width / this.dpr;
      this.cachedLogicalHeight = this.canvas.height / this.dpr;
      this.cacheValid = true;
    }
    return this.cachedLogicalHeight;
  }

  public invalidateCache(): void {
    this.cacheValid = false;
  }

  public draw(): void {
    this.pluginManager.measureStart("draw");
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    this.logicalCanvas.width = width;
    this.logicalCanvas.height = height;
    const logicalCanvas = this.logicalCanvas as unknown as HTMLCanvasElement;

    // 使用新的渲染管道
    let t0 = performance.now();
    this.pluginManager.renderBackground(
      ctx,
      logicalCanvas,
      this.config,
      this.state
    );
    this.lastLayerTimes["background"] = performance.now() - t0;

    // 创建渲染上下文
    const renderContext = createRenderContext(
      ctx,
      this.canvas,
      this.config,
      this.state,
      this.dpr,
      this.pluginManager
    );

    // 使用渲染管道渲染核心图层
    // 首次渲染或 dirtyLayers 为空时强制全量渲染
    const shouldForceFullRender =
      this.isFirstRender || this.dirtyLayers.size === 0;

    this.renderPipeline.render(renderContext, {
      forceFullRender: shouldForceFullRender,
      dirtyLayers: shouldForceFullRender ? undefined : this.dirtyLayers,
    });

    if (this.isFirstRender) {
      this.isFirstRender = false;
    }

    // 更新性能统计
    const stats = this.renderPipeline.getStats();
    this.lastLayerTimes = { ...this.lastLayerTimes, ...stats.layerTimes };

    // 插件覆盖层
    t0 = performance.now();
    this.pluginManager.renderOverlay(
      ctx,
      logicalCanvas,
      this.config,
      this.state
    );
    this.lastLayerTimes["overlay"] = performance.now() - t0;

    this.pluginManager.measureEnd("draw");
    ctx.restore();
    this.dirtyLayers.clear();
  }

  // 旧的私有渲染方法已删除
  // drawDraggingEvent 和 drawDragPreviewInternal 已迁移到 InteractionRenderer

  public getContentWidth(zoomLevel: number): number {
    return this.viewport.getContentWidth(zoomLevel);
  }

  public getContentHeight(): number {
    return this.viewport.getContentHeight();
  }

  public computeMaxScrollX(zoomLevel: number): number {
    return this.viewport.computeMaxScrollX(
      zoomLevel,
      this.getCachedLogicalWidth()
    );
  }

  public computeMaxScrollY(): number {
    return this.viewport.computeMaxScrollYWithPadding(
      this.getCachedLogicalHeight(),
      this.getCachedLogicalWidth(),
      this.state.zoomLevel
    );
  }

  public hasHorizontalScrollbar(): boolean {
    return this.viewport.hasHorizontalScrollbar(
      this.getCachedLogicalWidth(),
      this.state.zoomLevel
    );
  }

  public getAvailableHeight(): number {
    return this.viewport.getAvailableHeight(
      this.getCachedLogicalHeight(),
      this.getCachedLogicalWidth(),
      this.state.zoomLevel
    );
  }

  public invalidateLayoutCache(): void {
    this.viewport.invalidateCache();
  }

  public markDirty(
    layers: Array<
      | "background"
      | "tracks"
      | "timeline"
      | "guideLines"
      | "indicator"
      | "scrollbar"
      | "overlay"
      | "interaction"
    >
  ): void {
    for (const l of layers) this.dirtyLayers.add(l);
  }

  public markAllDirty(): void {
    this.dirtyLayers = new Set([
      "background",
      "tracks",
      "timeline",
      "guideLines",
      "indicator",
      "scrollbar",
      "overlay",
      "interaction",
    ]);
  }

  public getLastLayerTimes(): Record<string, number> {
    return { ...this.lastLayerTimes };
  }
}
