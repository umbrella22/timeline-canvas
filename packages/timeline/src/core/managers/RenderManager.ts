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
import { LogColors, getLogger } from "./Logger";
import { LayerBufferManager } from "./LayerBufferManager";


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
  private renderPipeline: RenderPipeline;
  private layerBufferManager: LayerBufferManager;
  private disposed = false;
  private readonly logger;

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
    this.logger = getLogger("DirtyCheck", config);
    this.state = state;
    this.pluginManager = pluginManager;
    this.dpr = window.devicePixelRatio || 1;
    this.logicalCanvas = {
      width: 0,
      height: 0,
      getContext: this.canvas.getContext.bind(this.canvas),
    };
    this.viewport = new ViewportManager(this.config, this.state);

    // 初始化 OffscreenCanvas 分层缓存管理器
    this.layerBufferManager = new LayerBufferManager(getLogger("LayerBuffer", config));

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

  public setCanvasSize(width: number, height: number, draw = true): void {
    if (this.disposed) return;
    const nextDpr = window.devicePixelRatio || 1;
    const actualWidth = Math.floor(width * nextDpr);
    const actualHeight = Math.floor(height * nextDpr);
    if (
      this.dpr === nextDpr &&
      Math.abs(this.canvas.width - actualWidth) < 1 &&
      Math.abs(this.canvas.height - actualHeight) < 1 &&
      this.canvas.style.width === `${width}px` &&
      this.canvas.style.height === `${height}px`
    ) {
      return;
    }
    this.dpr = nextDpr;
    this.canvas.width = actualWidth;
    this.canvas.height = actualHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.invalidateCache();
    if (this.state.zoomLevel < this.config.minAutoFitZoom) {
      this.state.zoomLevel = this.config.minAutoFitZoom;
      this.state.scrollX = 0;
    }
    const maxScrollX = this.computeMaxScrollX(this.state.zoomLevel);
    const maxScrollY = this.computeMaxScrollY();
    this.state.scrollX = Math.max(0, Math.min(maxScrollX, this.state.scrollX));
    this.state.scrollY = Math.max(0, Math.min(maxScrollY, this.state.scrollY));
    // canvas resize 影响所有层，标记全部脏
    this.markAllDirty();
    if (draw) this.draw();
  }

  public getCanvasLogicalWidth(): number {
    return this.canvas.width / this.dpr;
  }

  public getCanvasLogicalHeight(): number {
    return this.canvas.height / this.dpr;
  }

  public getDevicePixelRatio(): number {
    return this.dpr;
  }

  public getViewportManager(): ViewportManager {
    return this.viewport;
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
    if (this.disposed) return;
    // 如果没有脏层，跳过绘制
    if (this.dirtyLayers.size === 0 && !this.isFirstRender) {
      return;
    }

    this.pluginManager.measureStart("draw");

    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    this.logicalCanvas.width = width;
    this.logicalCanvas.height = height;
    const logicalCanvas = this.logicalCanvas as unknown as HTMLCanvasElement;

    // 确保 LayerBufferManager 已初始化/同步尺寸
    const bufSize = this.layerBufferManager.getSize();
    if (
      !this.layerBufferManager.isInitialized() ||
      bufSize.width !== this.canvas.width ||
      bufSize.height !== this.canvas.height ||
      bufSize.dpr !== this.dpr
    ) {
      this.layerBufferManager.initialize(this.canvas.width, this.canvas.height, this.dpr);
    }

    // 1. 将脏 LayerType 映射到脏 BufferLayer
    if (this.isFirstRender) {
      this.layerBufferManager.markAllDirty();
    } else {
      this.layerBufferManager.markDirtyFromLayers(this.dirtyLayers);
    }

    this.layerBufferManager.redraw("background", (ctx) => {
      const start = performance.now();
      this.pluginManager.renderBackground(ctx, logicalCanvas, this.config, this.state);
      this.lastLayerTimes.background = performance.now() - start;
    });

    this.layerBufferManager.redraw("main", (ctx) => {
      const context = createRenderContext(ctx, this.canvas, this.config, this.state, this.dpr, this.pluginManager);
      const stats = this.renderPipeline.render(context, {
        dirtyLayers: new Set(["tracks", "timeline", "guideLines", "indicator", "scrollbar"]),
      });
      Object.assign(this.lastLayerTimes, stats.layerTimes);
    });

    // Event media is drawn inline in the main/interaction buffers.
    this.layerBufferManager.clearDirty("media");
    this.layerBufferManager.redraw("interaction", (ctx) => {
      const context = createRenderContext(ctx, this.canvas, this.config, this.state, this.dpr, this.pluginManager);
      this.renderPipeline.render(context, { dirtyLayers: new Set(["interaction"]) });
    });

    this.layerBufferManager.redraw("overlay", (ctx) => {
      const start = performance.now();
      this.pluginManager.renderOverlay(ctx, logicalCanvas, this.config, this.state);
      this.lastLayerTimes.overlay = performance.now() - start;
    });

    // 3. 合成：将所有缓冲层按顺序 drawImage 到主 canvas
    this.layerBufferManager.compositeToMain(
      this.ctx,
      this.canvas.width,
      this.canvas.height
    );

    if (this.isFirstRender) {
      this.isFirstRender = false;
    }

    this.pluginManager.measureEnd("draw");
    this.dirtyLayers.clear();
  }

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
    this.logger.debugStyled(
      LogColors.dataUpdate,
      `✓ Marking layers dirty: [${layers.join(", ")}]`
    );
    for (const l of layers) this.dirtyLayers.add(l);
  }

  public markAllDirty(): void {
    this.logger.debugStyled(LogColors.dataUpdate, `✓ Marking ALL layers dirty`);
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
    this.layerBufferManager.markAllDirty();
  }

  public getLastLayerTimes(): Record<string, number> {
    return { ...this.lastLayerTimes };
  }

  public dispose(): void {
    this.disposed = true;
    this.layerBufferManager.dispose();
    this.dirtyLayers.clear();
    this.lastLayerTimes = {};
  }
}
