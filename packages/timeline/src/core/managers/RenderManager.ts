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

const logger = getLogger("DirtyCheck");

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

    // 初始化 OffscreenCanvas 分层缓存管理器
    this.layerBufferManager = new LayerBufferManager();

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
    // canvas resize 影响所有层，标记全部脏
    this.markAllDirty();
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
      bufSize.width !== width ||
      bufSize.height !== height ||
      bufSize.dpr !== this.dpr
    ) {
      this.layerBufferManager.initialize(width, height, this.dpr);
    }

    // 1. 将脏 LayerType 映射到脏 BufferLayer
    if (this.isFirstRender) {
      this.layerBufferManager.markAllDirty();
    } else {
      this.layerBufferManager.markDirtyFromLayers(this.dirtyLayers);
    }

    // 2. 按需重绘各缓冲层（只重绘脏的）

    // === background 层：插件背景 ===
    if (this.layerBufferManager.isDirty("background")) {
      const buf = this.layerBufferManager.getBuffer("background")!;
      const t0 = performance.now();
      buf.ctx.clearRect(0, 0, buf.canvas.width, buf.canvas.height);
      buf.ctx.save();
      buf.ctx.scale(this.dpr, this.dpr);
      this.pluginManager.renderBackground(
        buf.ctx as CanvasRenderingContext2D,
        logicalCanvas,
        this.config,
        this.state
      );
      buf.ctx.restore();
      this.layerBufferManager.clearDirty("background");
      this.lastLayerTimes["background"] = performance.now() - t0;
    }

    // === main 层：tracks + timeline + guideLines + indicator + scrollbar ===
    if (this.layerBufferManager.isDirty("main")) {
      const buf = this.layerBufferManager.getBuffer("main")!;
      buf.ctx.clearRect(0, 0, buf.canvas.width, buf.canvas.height);
      buf.ctx.save();
      buf.ctx.scale(this.dpr, this.dpr);

      const renderContext = createRenderContext(
        buf.ctx as CanvasRenderingContext2D,
        this.canvas,
        this.config,
        this.state,
        this.dpr,
        this.pluginManager
      );

      // 只渲染 main 层包含的渲染器
      this.renderPipeline.render(renderContext, {
        forceFullRender: false,
        dirtyLayers: new Set([
          "tracks",
          "timeline",
          "guideLines",
          "indicator",
          "scrollbar",
        ] as const),
      });

      buf.ctx.restore();
      this.layerBufferManager.clearDirty("main");

      // 更新性能统计
      const stats = this.renderPipeline.getStats();
      this.lastLayerTimes = { ...this.lastLayerTimes, ...stats.layerTimes };
    }

    // === media 层：由 EventMediaPlugin 通过事件钩子写入（阶段 2 实现）===
    // 目前 media 渲染仍在 main 层内的 EventsRenderer 中完成
    // 当 media buffer 脏时，暂时不做独立处理
    if (this.layerBufferManager.isDirty("media")) {
      // 阶段 2 将在此处接入 MediaWorkerBridge 的位图输出
      this.layerBufferManager.clearDirty("media");
    }

    // === interaction 层：拖拽预览、resize handle ===
    if (this.layerBufferManager.isDirty("interaction")) {
      const buf = this.layerBufferManager.getBuffer("interaction")!;
      buf.ctx.clearRect(0, 0, buf.canvas.width, buf.canvas.height);
      buf.ctx.save();
      buf.ctx.scale(this.dpr, this.dpr);

      const renderContext = createRenderContext(
        buf.ctx as CanvasRenderingContext2D,
        this.canvas,
        this.config,
        this.state,
        this.dpr,
        this.pluginManager
      );

      this.renderPipeline.render(renderContext, {
        forceFullRender: false,
        dirtyLayers: new Set(["interaction"] as const),
      });

      buf.ctx.restore();
      this.layerBufferManager.clearDirty("interaction");
    }

    // === overlay 层：tooltip、context menu、perf overlay ===
    if (this.layerBufferManager.isDirty("overlay")) {
      const buf = this.layerBufferManager.getBuffer("overlay")!;
      const t0 = performance.now();
      buf.ctx.clearRect(0, 0, buf.canvas.width, buf.canvas.height);
      buf.ctx.save();
      buf.ctx.scale(this.dpr, this.dpr);
      this.pluginManager.renderOverlay(
        buf.ctx as CanvasRenderingContext2D,
        logicalCanvas,
        this.config,
        this.state
      );
      buf.ctx.restore();
      this.layerBufferManager.clearDirty("overlay");
      this.lastLayerTimes["overlay"] = performance.now() - t0;
    }

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
    logger.debugStyled(
      LogColors.dataUpdate,
      `✓ Marking layers dirty: [${layers.join(", ")}]`
    );
    for (const l of layers) this.dirtyLayers.add(l);
  }

  public markAllDirty(): void {
    logger.debugStyled(LogColors.dataUpdate, `✓ Marking ALL layers dirty`);
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
}
