import type {
  TimelineConfig,
  TimelineState,
  TimelineOptions,
  TimelineCallbacks,
  Track,
  TimelineEvent,
  LoadDataFormat,
  InteractionTarget,
} from "../types";
import {
  DEFAULT_CONFIG,
  DEFAULT_COLORS,
  DEFAULT_EVENT_TEXT_STYLE,
  DEFAULT_EVENT_BLOCK_STYLE,
  DEFAULT_CONTEXT_MENU_ITEMS,
  DEFAULT_CONTEXT_MENU_STYLE,
  formatTime,
  fixFloatPrecision,
  getSnapInterval,
  snapToInterval,
  cloneEvent,
  getTimeX,
} from "../utils";
import { RenderManager } from "./managers/RenderManager";
import { MouseHandler } from "../handlers/MouseHandler";
import { WheelHandler } from "../handlers/WheelHandler";
import { PluginManager } from "./managers/PluginManager";
import { Logger, configureGlobalLogger } from "./managers/Logger";
import { ErrorHandler } from "./managers/ErrorHandler";
import { StateManager } from "./managers/StateManager";
import { EventIndexManager } from "./managers/EventIndexManager";
import { ChangeScheduler, type ChangeType } from "./managers/ChangeScheduler";
import { EventMutationService } from "./managers/EventMutationService";
import { GuideLineService } from "./managers/GuideLineService";
import { HitTestService } from "./managers/HitTestService";
// Built-in plugins are now optional external imports for tree-shaking.
import { LightThemePlugin } from "../plugins/builtin/LightThemePlugin";
import { DarkThemePlugin } from "../plugins/builtin/DarkThemePlugin";
import { type TimelinePlugin, PluginType } from "../plugins/types";

export class Timeline {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public config: TimelineConfig;
  public callbacks: TimelineCallbacks;
  public state: TimelineState;
  private mouseHandler: MouseHandler;
  private wheelHandler: WheelHandler;
  private renderManager: RenderManager;

  private eventListeners: {
    mousedown: (e: MouseEvent) => void;
    mousemove: (e: MouseEvent) => void;
    mouseup: (e: MouseEvent) => void;
    mouseleave: () => void;
    contextmenu: (e: MouseEvent) => void;
    wheel: (e: WheelEvent) => void;
  } | null = null;

  private pluginManager: PluginManager;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private stateManager: StateManager;
  private eventIndexManager: EventIndexManager;
  private eventMutationService: EventMutationService;
  private guideLineService: GuideLineService;
  private hitTestService: HitTestService;
  private changeScheduler: ChangeScheduler;
  private currentThemePluginId: string | null = null;

  constructor(canvasId: string, options: TimelineOptions = {}) {
    this.logger = new Logger({
      enabled: true,
      level: options.debug ? "debug" : "info",
      prefix: "Timeline",
      useGlobalConfig: false, // 主 Timeline 实例使用独立配置
    });
    // 同步全局日志配置
    configureGlobalLogger({
      enabled: true,
      level: options.debug ? "debug" : "info",
    });
    this.errorHandler = new ErrorHandler(this.logger);
    const canvas = document.getElementById(canvasId);
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      this.errorHandler.throw(`Canvas element with id "${canvasId}" not found`);
    }

    this.canvas = canvas as HTMLCanvasElement;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      this.errorHandler.throw("Failed to get 2D context from canvas");
    }
    this.ctx = ctx as CanvasRenderingContext2D;

    if (options.startPaddingTime === undefined) {
      options.startPaddingTime = 10;
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...options,
      colors: {
        ...DEFAULT_COLORS,
        ...options.colors,
      },
      eventTextStyle: {
        ...DEFAULT_EVENT_TEXT_STYLE,
        ...options.eventTextStyle,
      },
      eventBlockStyle: {
        ...DEFAULT_EVENT_BLOCK_STYLE,
        ...options.eventBlockStyle,
      },
      contextMenuItems: options.contextMenuItems || DEFAULT_CONTEXT_MENU_ITEMS,
      contextMenuStyle: {
        ...DEFAULT_CONTEXT_MENU_STYLE,
        ...options.contextMenuStyle,
      },
    } as TimelineConfig;

    this.logger.setLevel(this.config.debug ? "debug" : "info");

    this.callbacks = {
      onEventAdd: options.onEventAdd || null,
      onEventUpdate: options.onEventUpdate || null,
      onEventDelete: options.onEventDelete || null,
      onEventMove: options.onEventMove || null,
      onEventClick: options.onEventClick || null,
      onEventEdit: options.onEventEdit || null,
      onContextMenu: options.onContextMenu || null,
      onTrackAdd: options.onTrackAdd || null,
      onTrackRemove: options.onTrackRemove || null,
      onTimeIndicatorMove: options.onTimeIndicatorMove || null,
      onZoom: options.onZoom || null,
      onStatusChange: options.onStatusChange || null,
      onEventHighlight: options.onEventHighlight || null,
      onTimeIndicatorHighlight: options.onTimeIndicatorHighlight || null,
    };

    this.stateManager = new StateManager(this.config);
    this.state = this.stateManager.state;
    this.eventIndexManager = new EventIndexManager(this.state);
    this.eventMutationService = new EventMutationService({
      config: this.config,
      state: this.state,
      eventIndexManager: this.eventIndexManager,
      logger: this.logger,
      onMutate: () => this.clearGuideLineCache(),
    });
    this.guideLineService = new GuideLineService(this.config, this.state);
    this.hitTestService = new HitTestService(
      this.config,
      this.state,
      this.eventIndexManager
    );

    this.mouseHandler = new MouseHandler(this);
    this.wheelHandler = new WheelHandler(this);
    this.pluginManager = new PluginManager({
      timeline: this,
      config: this.config,
      state: this.state,
    });
    if (options.theme) {
      const id = `${options.theme.metadata.name}@${options.theme.metadata.version}`;
      this.pluginManager.loadPlugin(options.theme).then((ok) => {
        if (ok) {
          this.currentThemePluginId = id;
          // 主题插件异步激活后需触发重绘，确保所有缓冲层使用正确的主题色
          this.notifyChange("theme:change");
        }
      });
    }
    // ContextMenuPlugin 需要通过 usePlugin() 显式加载
    // 不再自动加载以支持完全的插件化架构
    this.renderManager = new RenderManager(
      this.canvas,
      this.ctx,
      this.config,
      this.state,
      this.pluginManager
    );

    // 初始化变更调度器
    this.changeScheduler = new ChangeScheduler(
      this.state,
      this.config,
      this.callbacks
    );
    this.changeScheduler.setRenderManager(this.renderManager);
    this.changeScheduler.setEventIndexManager(this.eventIndexManager);
    this.changeScheduler.setDrawFunction(() => this.draw());

    this.init();
    this.setupEventListeners();
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public async usePlugin(plugin: TimelinePlugin): Promise<boolean> {
    if (this.isThemePlugin(plugin)) {
      return this.switchTheme(plugin);
    }

    const loaded = await this.pluginManager.loadPlugin(plugin);
    if (!loaded) {
      return false;
    }

    this.redrawAfterPluginChange();
    return true;
  }

  public getLoadedPlugins(): TimelinePlugin[] {
    return this.pluginManager.getLoadedPlugins();
  }

  public isPluginLoaded(pluginName: string): boolean {
    return this.pluginManager.isPluginLoaded(pluginName);
  }

  public async removePlugin(pluginId: string): Promise<boolean> {
    const unloaded = await this.pluginManager.unloadPlugin(pluginId);
    if (!unloaded) {
      return false;
    }

    const removedTheme = this.currentThemePluginId === pluginId;
    if (removedTheme) {
      this.currentThemePluginId = null;
      this.notifyChange("theme:change");
      return true;
    }

    this.redrawAfterPluginChange();
    return true;
  }

  public async setTheme(theme: "light" | "dark"): Promise<boolean> {
    const plugin = theme === "dark" ? DarkThemePlugin : LightThemePlugin;
    return this.switchTheme(plugin);
  }

  private async switchTheme(plugin: TimelinePlugin): Promise<boolean> {
    const nextThemePluginId = this.getPluginId(plugin);
    if (this.currentThemePluginId === nextThemePluginId) {
      return true;
    }

    if (this.currentThemePluginId) {
      const unloaded = await this.pluginManager.unloadPlugin(
        this.currentThemePluginId
      );
      if (!unloaded) {
        return false;
      }
      this.currentThemePluginId = null;
    }

    const ok = await this.pluginManager.loadPlugin(plugin);
    if (ok) {
      this.currentThemePluginId = nextThemePluginId;
      this.notifyChange("theme:change");
    }
    return ok;
  }

  private init(): void {
    if (this.config.autoFitOnInit) {
      this.autoFitZoomToCanvas();
    }
    this.notifyChange("data:load");
  }

  public getContentWidthForZoom(zoomLevel: number): number {
    return this.renderManager.getContentWidth(zoomLevel);
  }

  public hasHorizontalScrollbar(): boolean {
    return this.renderManager.hasHorizontalScrollbar();
  }

  public getAvailableHeight(): number {
    return this.renderManager.getAvailableHeight();
  }

  /**
   * 通知状态变更，由调度器自动处理脏层标记、派生状态计算和回调触发
   */
  public notifyChange(change: ChangeType): void {
    this.changeScheduler.notify(change);
  }

  /**
   * 开始批量变更操作
   */
  public beginChangeBatch(): void {
    this.changeScheduler.beginBatch();
  }

  /**
   * 结束批量变更操作
   */
  public endChangeBatch(): void {
    this.changeScheduler.endBatch();
  }

  public setDebug(enabled: boolean): void {
    if (this.config.debug === enabled) return;
    this.config.debug = enabled;
    this.logger.setLevel(enabled ? "debug" : "info");
    configureGlobalLogger({ level: enabled ? "debug" : "info" });
    this.notifyChange("config:debug");
  }

  public setEnableTimeIndicator(enabled: boolean): void {
    if (this.config.enableTimeIndicator === enabled) return;
    this.config.enableTimeIndicator = enabled;
    if (!enabled) {
      this.state.draggingTimeIndicator = false;
      this.state.timeIndicatorHighlightedEvents = [];
    }
    this.notifyChange("config:timeIndicator");
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
    this.renderManager.markDirty(layers);
  }

  public getLastLayerTimes(): Record<string, number> {
    return this.renderManager.getLastLayerTimes();
  }

  public beginIndexBatch(): void {
    this.eventIndexManager.beginBatch();
  }

  public endIndexBatch(): void {
    this.eventIndexManager.endBatch();
  }

  public invalidateIndexTrack(trackIndex: number): void {
    this.eventIndexManager.invalidateTrack(trackIndex);
  }

  public invalidateIndexAll(): void {
    this.eventIndexManager.invalidateAll();
  }

  private autoFitZoomToCanvas(): void {
    this.adjustCanvasSize();
    const canvasWidth = this.renderManager.getCanvasLogicalWidth();
    let zoom = Math.max(this.config.minAutoFitZoom, this.state.zoomLevel, 1.0);
    const maxZoom = Math.max(this.config.maxAutoFitZoom, zoom);
    if (this.renderManager.getContentWidth(zoom) >= canvasWidth) {
      this.state.zoomLevel = zoom;
      return;
    }
    const step = 0.05;
    while (
      zoom <= maxZoom &&
      this.renderManager.getContentWidth(zoom) < canvasWidth
    ) {
      zoom += step;
    }
    if (
      zoom <= maxZoom &&
      this.renderManager.getContentWidth(zoom) >= canvasWidth
    ) {
      this.state.zoomLevel = parseFloat(zoom.toFixed(3));
      this.setStatus(
        `Auto fit: ${Math.round(this.state.zoomLevel * 100)}%`
      );
      return;
    }
    if (this.config.endPaddingTime === 0) {
      const needWidth = canvasWidth;
      const currentWidth = this.renderManager.getContentWidth(maxZoom);
      if (currentWidth < needWidth) {
        const missingPixels = needWidth - currentWidth;
        const secondsPerPixel = this.config.secondWidth * maxZoom;
        const extraSeconds = missingPixels / secondsPerPixel;
        this.config.endPaddingTime = Math.ceil(extraSeconds);
        this.state.zoomLevel = maxZoom;
        this.setStatus(
          `Auto fit capped at ${Math.round(maxZoom * 100)}%, added ${
            this.config.endPaddingTime
          }s padding`
        );
        return;
      }
    }
    this.state.zoomLevel = maxZoom;
    this.setStatus(
      `Auto fit capped at ${Math.round(
        maxZoom * 100
      )}%, content does not fill canvas`
    );
    this.markDirty([
      "background",
      "tracks",
      "timeline",
      "guideLines",
      "indicator",
      "scrollbar",
      "interaction",
      "overlay",
    ]);
  }

  private setupEventListeners(): void {
    this.eventListeners = {
      mousedown: (e: MouseEvent) => this.mouseHandler.handleMouseDown(e),
      mousemove: (e: MouseEvent) => this.mouseHandler.handleMouseMove(e),
      mouseup: (e: MouseEvent) => this.mouseHandler.handleMouseUp(e),
      mouseleave: () => this.mouseHandler.handleMouseUp(),
      contextmenu: (e: MouseEvent) => this.mouseHandler.handleContextMenu(e),
      wheel: (e: WheelEvent) => this.wheelHandler.handleWheel(e),
    };
    this.canvas.addEventListener("mousedown", this.eventListeners.mousedown);
    this.canvas.addEventListener("mousemove", this.eventListeners.mousemove);
    this.canvas.addEventListener("mouseup", this.eventListeners.mouseup);
    this.canvas.addEventListener("mouseleave", this.eventListeners.mouseleave);
    this.canvas.addEventListener(
      "contextmenu",
      this.eventListeners.contextmenu
    );
    this.canvas.addEventListener("wheel", this.eventListeners.wheel, {
      passive: false,
    });
    this.setInitialCanvasSize();
  }

  private setInitialCanvasSize(): void {
    const container = this.canvas.parentElement;
    if (!container) {
      this.setCanvasSize(
        this.renderManager.getCanvasLogicalWidth(),
        this.config.canvasHeight || 500
      );
      return;
    }
    const rect = container.getBoundingClientRect();
    this.setCanvasSize(
      rect.width,
      rect.height || this.config.canvasHeight || 500
    );
  }

  public setCanvasSize(width: number, height: number): void {
    this.renderManager.setCanvasSize(width, height);
  }

  public getCanvasLogicalHeight(): number {
    return this.renderManager.getCanvasLogicalHeight();
  }

  public getCachedLogicalHeight(): number {
    return this.renderManager.getCachedLogicalHeight();
  }

  public adjustCanvasSize(): void {
    const maxScrollY = this.renderManager.computeMaxScrollY();
    this.state.scrollY = Math.max(0, Math.min(maxScrollY, this.state.scrollY));
    this.notifyChange("canvas:resize");
  }

  public addTrack(): void {
    const track: Track = { id: this.state.tracks.length, events: [] };
    this.state.tracks.push(track);
    this.clearGuideLineCache();
    this.adjustCanvasSize();
    this.setStatus(`Track added (${this.state.tracks.length} total)`);
    if (this.callbacks.onTrackAdd) this.callbacks.onTrackAdd(track);
  }

  public removeTrack(): void {
    if (this.state.tracks.length <= 1) {
      this.setStatus("At least one track is required");
      return;
    }
    const removedTrack = this.state.tracks.pop()!;
    if (
      this.state.selectedTrack !== null &&
      this.state.selectedTrack >= this.state.tracks.length
    ) {
      this.state.selectedTrack =
        this.state.tracks.length > 0 ? this.state.tracks.length - 1 : null;
    }
    this.clearGuideLineCache();
    this.adjustCanvasSize();
    this.setStatus(`Track removed (${this.state.tracks.length} remaining)`);
    if (this.callbacks.onTrackRemove)
      this.callbacks.onTrackRemove(removedTrack);
  }

  public autoRemoveEmptyLastTrack(): void {
    if (!this.config.autoRemoveEmptyLastTrack) return;
    if (this.state.tracks.length <= 1) return;
    const lastTrack = this.state.tracks[this.state.tracks.length - 1];
    if (lastTrack.events.length === 0) {
      const removedTrack = this.state.tracks.pop()!;
      if (
        this.state.selectedTrack !== null &&
        this.state.selectedTrack >= this.state.tracks.length
      ) {
        this.state.selectedTrack =
          this.state.tracks.length > 0 ? this.state.tracks.length - 1 : null;
      }
      this.clearGuideLineCache();
      this.setStatus(`Empty track removed (${this.state.tracks.length} remaining)`);
      if (this.callbacks.onTrackRemove)
        this.callbacks.onTrackRemove(removedTrack);
      this.adjustCanvasSize();
      this.autoRemoveEmptyLastTrack();
    }
  }

  public addEvent(
    trackIndex: number,
    startTime: number,
    endTime: number,
    title: string,
    description = "",
    customData?: Record<string, unknown>,
    readonly = false
  ): void {
    const event = this.eventMutationService.addEvent(
      trackIndex,
      startTime,
      endTime,
      title,
      description,
      customData,
      readonly
    );
    if (!event) return;

    this.notifyChange("events:add");
    if (this.callbacks.onEventAdd)
      this.callbacks.onEventAdd({ trackIndex, event: cloneEvent(event) });
  }

  public updateEvent(
    trackIndex: number,
    eventIndex: number,
    updates: Partial<TimelineEvent>
  ): boolean {
    const result = this.eventMutationService.updateEvent(
      trackIndex,
      eventIndex,
      updates
    );
    if (!result) {
      return false;
    }

    this.notifyChange("events:update");
    this.setStatus(`Event updated: ${result.event.title}`);
    if (this.callbacks.onEventUpdate) {
      this.callbacks.onEventUpdate({
        trackIndex,
        eventIndex,
        event: cloneEvent(result.event),
        oldEvent: result.oldEvent,
      });
    }
    return true;
  }

  public updateEventData(
    trackIndex: number,
    eventIndex: number,
    eventData: {
      title?: string;
      startTime?: number;
      duration?: number;
      description?: string;
    }
  ): boolean {
    const result = this.eventMutationService.updateEventData(
      trackIndex,
      eventIndex,
      eventData
    );
    if (!result) {
      return false;
    }

    this.notifyChange("events:update");
    this.setStatus(`Event updated: ${result.event.title}`);
    if (this.callbacks.onEventUpdate) {
      this.callbacks.onEventUpdate({
        trackIndex,
        eventIndex,
        event: cloneEvent(result.event),
        oldEvent: result.oldEvent,
      });
    }
    return true;
  }

  public deleteEvent(trackIndex: number, eventIndex: number): boolean {
    const event = this.eventMutationService.deleteEvent(trackIndex, eventIndex);
    if (!event) return false;

    this.autoRemoveEmptyLastTrack();
    this.notifyChange("events:delete");
    this.setStatus(`Event deleted: ${event.title}`);
    if (this.callbacks.onEventDelete)
      this.callbacks.onEventDelete({ trackIndex, eventIndex, event });
    return true;
  }

  public loadData(data: LoadDataFormat): boolean {
    const loaded = this.eventMutationService.loadData(data);
    if (!loaded) return false;

    if (this.state.tracks.length === 0) this.addTrack();
    if (data.timeIndicatorPosition !== undefined)
      this.setTimeIndicator(data.timeIndicatorPosition);
    this.notifyChange("data:load");
    this.setStatus(`Loaded ${this.state.tracks.length} track(s)`);
    return true;
  }

  public setTimeIndicator(seconds: number, applySnap = false): boolean {
    if (typeof seconds !== "number" || isNaN(seconds)) {
      this.logger.error("Time indicator position must be a number (seconds)");
      return false;
    }
    if (applySnap && this.state.snapEnabled) {
      const snapIntervalSeconds = getSnapInterval(
        this.state.zoomLevel,
        this.config.snapInterval,
        this.config.snapToSeconds,
        this.config.secondPrecisionZoomThreshold,
        this.config.scale,
        this.config.scaleSplitCount
      );
      seconds = snapToInterval(seconds, snapIntervalSeconds);
    }
    seconds = Math.max(
      this.config.startTime,
      Math.min(this.config.endTime, seconds)
    );
    // 位置未变则跳过整条渲染链路
    if (seconds === this.state.timeIndicatorPosition) return true;
    this.state.timeIndicatorPosition = seconds;
    this.scrollToTimeIndicator(seconds);
    // 使用调度器处理高亮计算和回调触发
    this.notifyChange("timeIndicator:move");
    this.setStatus(`Time indicator moved to: ${formatTime(seconds)}`);
    if (this.callbacks.onTimeIndicatorMove)
      this.callbacks.onTimeIndicatorMove({
        position: seconds,
        time: formatTime(seconds),
      });
    return true;
  }

  /**
   * 拖拽过程中的轻量时间指示器更新
   *
   * 与 setTimeIndicator 的区别：
   * - 触发 "timeIndicator:drag" 而非 "timeIndicator:move"（不触发 onTimeIndicatorMove / emitTimeIndicatorHighlight 回调）
   * - 不调用 setStatus
   * - 使用节流的边界滚动而非每帧滚动
   */
  public setTimeIndicatorDuringDrag(seconds: number): void {
    seconds = Math.max(
      this.config.startTime,
      Math.min(this.config.endTime, seconds)
    );
    this.state.timeIndicatorPosition = seconds;
    // 仅在越界时节流滚动
    this.scrollToTimeIndicatorThrottled(seconds);
    this.notifyChange("timeIndicator:drag");
  }

  private _lastEdgeScrollTime = 0;

  private scrollToTimeIndicatorThrottled(seconds: number): void {
    const now = performance.now();
    if (now - this._lastEdgeScrollTime < this.getEdgeScrollThrottle()) return;

    const timeIndicatorX = getTimeX(
      seconds,
      this.config.startTime,
      this.config.startPaddingTime,
      this.config.secondWidth,
      this.state.zoomLevel,
      this.state.scrollX
    );
    const canvasWidth = this.renderManager.getCanvasLogicalWidth();
    const triggerMargin = this.getEdgeScrollTriggerMargin();

    if (
      timeIndicatorX >= triggerMargin &&
      timeIndicatorX <= canvasWidth - triggerMargin
    ) {
      return;
    }

    this._lastEdgeScrollTime = now;
    const viewportMargin = this.getEdgeScrollViewportMargin();
    const timeAtZeroScroll = getTimeX(
      seconds,
      this.config.startTime,
      this.config.startPaddingTime,
      this.config.secondWidth,
      this.state.zoomLevel,
      0
    );
    const maxScrollX = this.renderManager.computeMaxScrollX(
      this.state.zoomLevel
    );

    if (timeIndicatorX < triggerMargin) {
      this.state.scrollX = Math.max(
        0,
        Math.min(maxScrollX, timeAtZeroScroll - viewportMargin)
      );
    } else {
      this.state.scrollX = Math.max(
        0,
        Math.min(maxScrollX, timeAtZeroScroll - (canvasWidth - viewportMargin))
      );
    }

    this.markDirty([
      "background",
      "tracks",
      "timeline",
      "guideLines",
      "indicator",
      "scrollbar",
      "interaction",
      "overlay",
    ]);
  }

  private scrollToTimeIndicator(seconds: number): void {
    const timeIndicatorX = getTimeX(
      seconds,
      this.config.startTime,
      this.config.startPaddingTime,
      this.config.secondWidth,
      this.state.zoomLevel,
      this.state.scrollX
    );
    const canvasWidth = this.renderManager.getCanvasLogicalWidth();
    const margin = this.getEdgeScrollViewportMargin();
    let needsScroll = false;
    if (timeIndicatorX < margin) {
      const targetScrollX =
        getTimeX(
          seconds,
          this.config.startTime,
          this.config.startPaddingTime,
          this.config.secondWidth,
          this.state.zoomLevel,
          0
        ) - margin;
      const maxScrollX = this.renderManager.computeMaxScrollX(
        this.state.zoomLevel
      );
      this.state.scrollX = Math.max(0, Math.min(maxScrollX, targetScrollX));
      needsScroll = true;
    } else if (timeIndicatorX > canvasWidth - margin) {
      const targetScrollX =
        getTimeX(
          seconds,
          this.config.startTime,
          this.config.startPaddingTime,
          this.config.secondWidth,
          this.state.zoomLevel,
          0
        ) -
        (canvasWidth - margin);
      const maxScrollX = this.renderManager.computeMaxScrollX(
        this.state.zoomLevel
      );
      this.state.scrollX = Math.max(0, Math.min(maxScrollX, targetScrollX));
      needsScroll = true;
    }
    if (needsScroll) {
      this.markDirty([
        "background",
        "tracks",
        "timeline",
        "guideLines",
        "indicator",
        "scrollbar",
        "interaction",
        "overlay",
      ]);
    }
  }

  public zoom(factor: number): void {
    const oldZoomLevel = this.state.zoomLevel;
    const oldScrollX = this.state.scrollX;
    const centerX = this.renderManager.getCachedLogicalWidth() / 2;
    const centerTimeOffset =
      (centerX + oldScrollX) / (this.config.secondWidth * oldZoomLevel);
    this.state.zoomLevel *= factor;
    this.state.zoomLevel = Math.max(
      1.0,
      Math.min(1000.0, this.state.zoomLevel)
    );
    if (oldZoomLevel !== this.state.zoomLevel) {
      const newCenterX =
        centerTimeOffset * this.config.secondWidth * this.state.zoomLevel;
      this.state.scrollX = newCenterX - centerX;
      const maxScrollX = this.renderManager.computeMaxScrollX(
        this.state.zoomLevel
      );
      this.state.scrollX = Math.max(
        0,
        Math.min(maxScrollX, this.state.scrollX)
      );
    }
    this.notifyChange("zoom:change");
    this.setStatus(`Zoom: ${Math.round(this.state.zoomLevel * 100)}%`);
    if (this.callbacks.onZoom && oldZoomLevel !== this.state.zoomLevel) {
      this.callbacks.onZoom({
        zoomLevel: this.state.zoomLevel,
        percentage: Math.round(this.state.zoomLevel * 100),
      });
    }
  }

  public setZoomLevel(zoomLevel: number): boolean {
    if (typeof zoomLevel !== "number" || isNaN(zoomLevel)) {
      this.logger.error("Zoom level must be a valid number");
      return false;
    }
    if (zoomLevel < 1.0 || zoomLevel > 1000.0) {
      this.logger.error("Zoom level out of valid range (1-1000)");
      return false;
    }
    const oldZoomLevel = this.state.zoomLevel;
    const oldScrollX = this.state.scrollX;
    const centerX = this.renderManager.getCachedLogicalWidth() / 2;
    const centerTimeOffset =
      (centerX + oldScrollX) / (this.config.secondWidth * oldZoomLevel);
    this.state.zoomLevel = zoomLevel;
    const newCenterX =
      centerTimeOffset * this.config.secondWidth * this.state.zoomLevel;
    this.state.scrollX = newCenterX - centerX;
    const maxScrollX = this.renderManager.computeMaxScrollX(
      this.state.zoomLevel
    );
    this.state.scrollX = Math.max(0, Math.min(maxScrollX, this.state.scrollX));
    this.notifyChange("zoom:change");
    this.setStatus(`Zoom: ${Math.round(this.state.zoomLevel * 100)}%`);
    if (this.callbacks.onZoom && oldZoomLevel !== this.state.zoomLevel) {
      this.callbacks.onZoom({
        zoomLevel: this.state.zoomLevel,
        percentage: Math.round(this.state.zoomLevel * 100),
      });
    }
    return true;
  }

  public getZoomLevel(): number {
    return this.state.zoomLevel;
  }

  public setEndTime(endTime: number): boolean {
    if (typeof endTime !== "number" || isNaN(endTime)) {
      this.logger.error("End time must be a valid number (seconds)");
      return false;
    }
    if (endTime <= this.config.startTime) {
      this.logger.error("End time must be greater than start time");
      return false;
    }
    const hasOverflowEvents = this.state.tracks.some((track) =>
      track.events.some((event) => event.endTime > endTime)
    );
    if (hasOverflowEvents) {
      this.logger.warn("Warning: some events exceed the new end time");
    }
    const oldEndTime = this.config.endTime;
    this.config.endTime = endTime;
    this.clearGuideLineCache();
    this.renderManager.invalidateLayoutCache();
    if (this.state.timeIndicatorPosition > endTime) {
      this.state.timeIndicatorPosition = endTime;
    }
    const contentWidth = this.renderManager.getContentWidth(
      this.state.zoomLevel
    );
    const maxScrollX = Math.max(
      0,
      contentWidth - this.renderManager.getCachedLogicalWidth()
    );
    this.state.scrollX = Math.max(0, Math.min(maxScrollX, this.state.scrollX));
    this.notifyChange("config:endTime");
    this.setStatus(
      `End time updated: ${formatTime(oldEndTime)} → ${formatTime(endTime)}`
    );
    return true;
  }

  public getEndTime(): number {
    return this.config.endTime;
  }

  public formatTime(seconds: number): string {
    return formatTime(seconds);
  }

  public setStatus(text: string): void {
    this.stateManager.setStatus(
      text,
      this.callbacks.onStatusChange || undefined
    );
  }

  public getStatus(): string {
    return this.state.statusText;
  }

  /**
   * 统一命中：一次查询同时检测 resize handle 和事件体命中
   * 内部使用 O(n) max-scan 代替排序，降低 CPU 开销
   * @param canvasX 画布坐标 X（不含 scroll 偏移）
   * @param canvasY 画布坐标 Y（不含 scroll 偏移）
   */
  public getInteractionTarget(canvasX: number, canvasY: number): InteractionTarget {
    return this.hitTestService.getInteractionTarget(canvasX, canvasY);
  }

  public getEventAtPosition(
    x: number,
    y: number
  ): { trackIndex: number; eventIndex: number } | null {
    return this.hitTestService.getEventAtPosition(x, y);
  }

  public getResizeHandle(
    x: number,
    y: number
  ): { trackIndex: number; eventIndex: number; edge: "left" | "right" } | null {
    return this.hitTestService.getResizeHandle(x, y);
  }

  private getEdgeScrollThrottle(): number {
    return this.resolveEdgeScrollValue(
      this.config.edgeScrollThrottle,
      DEFAULT_CONFIG.edgeScrollThrottle
    );
  }

  private getEdgeScrollTriggerMargin(): number {
    return this.resolveEdgeScrollValue(
      this.config.edgeScrollTriggerMargin,
      DEFAULT_CONFIG.edgeScrollTriggerMargin
    );
  }

  private getEdgeScrollViewportMargin(): number {
    return this.resolveEdgeScrollValue(
      this.config.edgeScrollViewportMargin,
      DEFAULT_CONFIG.edgeScrollViewportMargin
    );
  }

  private resolveEdgeScrollValue(value: number, fallback: number): number {
    if (!Number.isFinite(value) || value < 0) {
      return fallback;
    }
    return value;
  }

  public calculateGuideLines(
    fromTrackIndex: number,
    eventIndex: number,
    toTrackIndex: number,
    newStartTime: number,
    duration: number
  ): Array<{ time: number; type: "start" | "end"; trackIndices: number[] }> {
    return this.guideLineService.calculateGuideLines(
      fromTrackIndex,
      eventIndex,
      toTrackIndex,
      newStartTime,
      duration
    );
  }

  public snapToGuideLines(
    newStartTime: number,
    duration: number
  ): number | null {
    if (this.state.guideLines.length === 0) return null;
    const threshold = this.config.guideLineSnapThreshold;
    const newEndTime = newStartTime + duration;

    // 找最近的吸附点，而不是第一个匹配的（参考 react-timeline 的最小距离算法）
    let bestSnap: number | null = null;
    let minDistance = Number.MAX_SAFE_INTEGER;

    for (const guideLine of this.state.guideLines) {
      if (guideLine.type === "start") {
        const distance = Math.abs(guideLine.time - newStartTime);
        if (distance < threshold && distance < minDistance) {
          minDistance = distance;
          bestSnap = guideLine.time;
        }
      } else if (guideLine.type === "end") {
        const distance = Math.abs(guideLine.time - newEndTime);
        if (distance < threshold && distance < minDistance) {
          minDistance = distance;
          bestSnap = guideLine.time - duration;
        }
      }
    }
    return bestSnap;
  }

  /**
   * Resize 边缘辅助线吸附 - 仅检查单侧边缘
   * @param edgeTime 正在调整的边缘时间（左边缘的 startTime 或右边缘的 endTime）
   * @returns 吸附后的边缘时间，或 null
   */
  public snapEdgeToGuideLines(edgeTime: number): number | null {
    if (this.state.guideLines.length === 0) return null;
    const threshold = this.config.guideLineSnapThreshold;

    let bestSnap: number | null = null;
    let minDistance = Number.MAX_SAFE_INTEGER;

    for (const guideLine of this.state.guideLines) {
      const distance = Math.abs(guideLine.time - edgeTime);
      if (distance < threshold && distance < minDistance) {
        minDistance = distance;
        bestSnap = guideLine.time;
      }
    }
    return bestSnap;
  }

  public canMoveEvent(
    fromTrackIndex: number,
    fromEventIndex: number,
    toTrackIndex: number,
    newStartTime: number,
    duration: number
  ): boolean {
    const newEndTime = newStartTime + duration;
    const maxAllowedEndTime = this.config.endTime + this.config.endPaddingTime;
    if (newStartTime < this.config.startTime || newEndTime > maxAllowedEndTime)
      return false;
    if (toTrackIndex < 0 || toTrackIndex >= this.state.tracks.length)
      return false;
    const targetTrack = this.state.tracks[toTrackIndex];
    for (let i = 0; i < targetTrack.events.length; i++) {
      if (toTrackIndex === fromTrackIndex && i === fromEventIndex) continue;
      const event = targetTrack.events[i];
      if (!(newEndTime <= event.startTime || newStartTime >= event.endTime))
        return false;
    }
    const ok = this.pluginManager.validateEvent("validate:event:move", {
      fromTrackIndex,
      fromEventIndex,
      toTrackIndex,
      newStartTime,
      duration,
    });
    if (!ok) return false;
    return true;
  }

  public showSplitLine(
    trackIndex: number,
    eventIndex: number,
    splitTime: number
  ): void {
    const needsUpdate =
      !this.state.hoveredSplitLine ||
      this.state.hoveredSplitLine.trackIndex !== trackIndex ||
      this.state.hoveredSplitLine.eventIndex !== eventIndex ||
      Math.abs(this.state.hoveredSplitLine.splitTime - splitTime) > 0.001;
    if (needsUpdate) {
      this.state.hoveredSplitLine = { trackIndex, eventIndex, splitTime };
      this.notifyChange("interaction:splitLine");
    }
  }

  public hideSplitLine(): void {
    if (this.state.hoveredSplitLine) {
      this.state.hoveredSplitLine = null;
      this.notifyChange("interaction:splitLine");
    }
  }

  public splitEvent(
    trackIndex: number,
    eventIndex: number,
    splitTime: number
  ): boolean {
    if (trackIndex < 0 || trackIndex >= this.state.tracks.length) return false;
    const track = this.state.tracks[trackIndex];
    if (eventIndex < 0 || eventIndex >= track.events.length) return false;
    const event = track.events[eventIndex];
    if (
      splitTime <= event.startTime + this.config.minEventDuration ||
      splitTime >= event.endTime - this.config.minEventDuration
    ) {
      this.setStatus("Invalid split position: resulting events too short");
      return false;
    }
    const firstEvent: TimelineEvent = {
      ...event,
      id: event.id,
      duration: fixFloatPrecision(splitTime - event.startTime),
      endTime: splitTime,
      title: `${event.title} (1)`,
    };
    const secondEvent: TimelineEvent = {
      ...event,
      id: track.events.length,
      startTime: splitTime,
      duration: fixFloatPrecision(event.endTime - splitTime),
      endTime: fixFloatPrecision(event.endTime),
      title: `${event.title} (2)`,
    };
    track.events[eventIndex] = firstEvent;
    track.events.push(secondEvent);
    this.clearGuideLineCache();
    this.eventIndexManager.invalidateTrack(trackIndex);
    this.notifyChange("events:split");
    this.setStatus(`Event split: ${event.title}`);
    if (this.callbacks.onEventUpdate) {
      this.callbacks.onEventUpdate({
        type: "split",
        trackIndex,
        eventIndex,
        event: cloneEvent(event),
        firstEvent: cloneEvent(firstEvent),
        secondEvent: cloneEvent(secondEvent),
      });
    }
    return true;
  }

  public draw(): void {
    this.renderManager.draw();
  }

  public setReadOnly(readOnly: boolean): void {
    this.config.readOnly = readOnly;
    if (readOnly) {
      this.state.selectedEvent = null;
      this.state.draggingEvent = null;
      this.state.resizingEvent = null;
      this.state.draggingTimeIndicator = false;
      this.state.contextMenuVisible = false;
      this.state.contextMenuEvent = null;
      this.state.hoveredResizeHandle = null;
      this.state.hoveredSplitLine = null;
      this.state.guideLines = [];
    }
    this.notifyChange("config:readOnly");
    this.setStatus(readOnly ? "Read-only mode enabled" : "Read-only mode disabled");
  }
  public highlightEvent(trackIndex: number, eventIndex: number): boolean {
    if (trackIndex < 0 || trackIndex >= this.state.tracks.length) {
      this.logger.error(`Invalid track index: ${trackIndex}`);
      return false;
    }
    const track = this.state.tracks[trackIndex];
    if (eventIndex < 0 || eventIndex >= track.events.length) {
      this.logger.error(`Invalid event index: ${eventIndex}`);
      return false;
    }
    this.state.selectedEvent = null;
    this.state.selectedTrack = null;
    this.state.highlightedEvent = { trackIndex, eventIndex };
    const event = track.events[eventIndex];
    this.notifyChange("highlight:change");
    this.setStatus(`Event highlighted: ${event.title}`);
    return true;
  }

  public clearHighlight(): void {
    if (this.state.highlightedEvent || this.state.selectedEvent) {
      this.state.highlightedEvent = null;
      this.state.selectedEvent = null;
      this.state.selectedTrack = null;
      this.notifyChange("highlight:change");
      this.setStatus("Highlight cleared");
    }
  }

  public getHighlightedEvent(): {
    trackIndex: number;
    eventIndex: number;
  } | null {
    return this.state.highlightedEvent;
  }

  public isReadOnly(): boolean {
    return this.config.readOnly;
  }

  public destroy(): void {
    this.clearGuideLineCache();
    if (this.eventListeners) {
      this.canvas.removeEventListener(
        "mousedown",
        this.eventListeners.mousedown
      );
      this.canvas.removeEventListener(
        "mousemove",
        this.eventListeners.mousemove
      );
      this.canvas.removeEventListener("mouseup", this.eventListeners.mouseup);
      this.canvas.removeEventListener(
        "mouseleave",
        this.eventListeners.mouseleave
      );
      this.canvas.removeEventListener(
        "contextmenu",
        this.eventListeners.contextmenu
      );
      this.canvas.removeEventListener("wheel", this.eventListeners.wheel);
      this.eventListeners = null;
    }
    this.setStatus("Timeline destroyed");
  }

  private clearGuideLineCache(): void {
    this.guideLineService.clearCache();
  }

  private getPluginId(plugin: TimelinePlugin): string {
    return `${plugin.metadata.name}@${plugin.metadata.version}`;
  }

  private isThemePlugin(plugin: TimelinePlugin): boolean {
    return plugin.metadata.type === PluginType.THEME;
  }

  private redrawAfterPluginChange(): void {
    this.markDirty([
      "background",
      "tracks",
      "timeline",
      "guideLines",
      "indicator",
      "scrollbar",
      "interaction",
      "overlay",
    ]);
    this.draw();
  }
}
