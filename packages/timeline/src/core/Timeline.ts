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
  private guideLinesCache: Map<
    string,
    Array<{ time: number; type: "start" | "end"; trackIndices: number[] }>
  > = new Map();
  private guideLinesCacheTimestamp: number = 0;
  private readonly GUIDE_LINES_CACHE_TTL = 500;

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

  public usePlugin(plugin: any): Promise<boolean> {
    return this.pluginManager.loadPlugin(plugin).then((ok) => {
      if (ok && plugin.metadata?.type === PluginType.THEME) {
        const id = `${plugin.metadata.name}@${plugin.metadata.version}`;
        this.currentThemePluginId = id;
        // 主题插件加载后需触发重绘，确保背景层使用正确的主题色
        this.notifyChange("theme:change");
      }
      return ok;
    });
  }

  public getLoadedPlugins(): any[] {
    return this.pluginManager.getLoadedPlugins();
  }

  public isPluginLoaded(pluginName: string): boolean {
    return this.pluginManager.isPluginLoaded(pluginName);
  }

  public async removePlugin(pluginId: string): Promise<boolean> {
    return this.pluginManager.unloadPlugin(pluginId);
  }

  public async setTheme(theme: "light" | "dark"): Promise<boolean> {
    const plugin = theme === "dark" ? DarkThemePlugin : LightThemePlugin;
    return this.switchTheme(plugin);
  }

  private async switchTheme(plugin: TimelinePlugin): Promise<boolean> {
    if (this.currentThemePluginId) {
      await this.pluginManager.unloadPlugin(this.currentThemePluginId);
      this.currentThemePluginId = null;
    }
    const id = `${plugin.metadata.name}@${plugin.metadata.version}`;
    const ok = await this.pluginManager.loadPlugin(plugin);
    if (ok) {
      this.currentThemePluginId = id;
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
        `自动缩放: ${Math.round(this.state.zoomLevel * 100)}% 以铺满画布`
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
          `自动缩放达到上限(${Math.round(maxZoom * 100)}%)，已自动增加留白 ${
            this.config.endPaddingTime
          } 秒以铺满画布`
        );
        return;
      }
    }
    this.state.zoomLevel = maxZoom;
    this.setStatus(
      `自动缩放达到上限(${Math.round(
        maxZoom * 100
      )}%)，内容仍不足以完全铺满画布`
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
    this.adjustCanvasSize();
    this.setStatus(`已添加轨道 ${this.state.tracks.length}`);
    if (this.callbacks.onTrackAdd) this.callbacks.onTrackAdd(track);
  }

  public removeTrack(): void {
    if (this.state.tracks.length <= 1) {
      this.setStatus("至少需要保留一个轨道");
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
    this.adjustCanvasSize();
    this.setStatus(`已删除轨道，当前轨道数: ${this.state.tracks.length}`);
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
      this.setStatus(`自动清理空轨道，当前轨道数: ${this.state.tracks.length}`);
      if (this.callbacks.onTrackRemove)
        this.callbacks.onTrackRemove(removedTrack);
      this.adjustCanvasSize();
      this.autoRemoveEmptyLastTrack();
    }
  }

  private validateEventTime(
    startTime: number,
    endTime: number
  ): { startSec: number; duration: number } | null {
    const maxAllowedEndTime = this.config.endTime + this.config.endPaddingTime;
    let startSec: number;
    let duration: number;
    if (endTime > startTime && endTime <= maxAllowedEndTime) {
      startSec = startTime;
      duration = fixFloatPrecision(endTime - startTime);
    } else if (
      endTime <= this.config.endTime - this.config.startTime &&
      startTime + endTime <= maxAllowedEndTime
    ) {
      startSec = startTime;
      duration = endTime;
    } else {
      this.logger.error(
        `无效的时间范围: startTime=${startTime}, endTime=${endTime}`
      );
      return null;
    }
    if (startSec < this.config.startTime) {
      this.logger.error(
        `开始时间不能进入左侧留白区域: startTime=${startSec}, minAllowed=${this.config.startTime}`
      );
      return null;
    }
    return { startSec, duration };
  }

  public addEvent(
    trackIndex: number,
    startTime: number,
    endTime: number,
    title: string,
    description = "",
    customData?: Record<string, any>,
    readonly = false
  ): void {
    if (trackIndex < 0 || trackIndex >= this.state.tracks.length) return;
    const timeValidation = this.validateEventTime(startTime, endTime);
    if (!timeValidation) return;
    const { startSec, duration } = timeValidation;
    const track = this.state.tracks[trackIndex];
    const fixedDuration = fixFloatPrecision(duration);
    const event: TimelineEvent = {
      id: track.events.length,
      startTime: startSec,
      endTime: fixFloatPrecision(startSec + fixedDuration),
      duration: fixedDuration,
      title,
      description,
      color:
        this.config.colors.eventColors[
          track.events.length % this.config.colors.eventColors.length
        ],
      ...(readonly && { readonly }),
      ...(customData && { customData }),
    };
    track.events.push(event);
    this.eventIndexManager.invalidateTrack(trackIndex);
    this.notifyChange("events:add");
    if (this.callbacks.onEventAdd)
      this.callbacks.onEventAdd({ trackIndex, event: cloneEvent(event) });
  }

  public updateEvent(
    trackIndex: number,
    eventIndex: number,
    updates: Partial<TimelineEvent>
  ): boolean {
    if (trackIndex < 0 || trackIndex >= this.state.tracks.length) {
      this.logger.error("无效的轨道索引");
      return false;
    }
    const track = this.state.tracks[trackIndex];
    if (eventIndex < 0 || eventIndex >= track.events.length) {
      this.logger.error("无效的事件索引");
      return false;
    }
    const event = track.events[eventIndex];
    const oldEvent = cloneEvent(event);
    Object.assign(event, updates);
    this.eventIndexManager.invalidateTrack(trackIndex);
    this.notifyChange("events:update");
    this.setStatus(`已更新事件: ${event.title}`);
    if (this.callbacks.onEventUpdate) {
      this.callbacks.onEventUpdate({
        trackIndex,
        eventIndex,
        event: cloneEvent(event),
        oldEvent,
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
    if (trackIndex < 0 || trackIndex >= this.state.tracks.length) {
      this.logger.error("无效的轨道索引");
      return false;
    }
    const track = this.state.tracks[trackIndex];
    if (eventIndex < 0 || eventIndex >= track.events.length) {
      this.logger.error("无效的事件索引");
      return false;
    }
    const event = track.events[eventIndex];
    const oldEvent = cloneEvent(event);
    if (eventData.title !== undefined) event.title = eventData.title;
    if (eventData.startTime !== undefined) {
      event.startTime = eventData.startTime;
      event.endTime = fixFloatPrecision(event.startTime + event.duration);
    }
    if (eventData.duration !== undefined) {
      event.duration = fixFloatPrecision(eventData.duration);
      event.endTime = fixFloatPrecision(event.startTime + event.duration);
    }
    if (eventData.description !== undefined)
      event.description = eventData.description;
    this.eventIndexManager.invalidateTrack(trackIndex);
    this.notifyChange("events:update");
    this.setStatus(`已更新事件: ${event.title}`);
    if (this.callbacks.onEventUpdate) {
      this.callbacks.onEventUpdate({
        trackIndex,
        eventIndex,
        event: cloneEvent(event),
        oldEvent,
      });
    }
    return true;
  }

  public deleteEvent(trackIndex: number, eventIndex: number): boolean {
    if (trackIndex < 0 || trackIndex >= this.state.tracks.length) return false;
    const track = this.state.tracks[trackIndex];
    if (eventIndex < 0 || eventIndex >= track.events.length) return false;
    const event = cloneEvent(track.events[eventIndex]);
    track.events.splice(eventIndex, 1);
    this.eventIndexManager.invalidateTrack(trackIndex);
    this.autoRemoveEmptyLastTrack();
    this.notifyChange("events:delete");
    this.setStatus(`已删除事件: ${event.title}`);
    if (this.callbacks.onEventDelete)
      this.callbacks.onEventDelete({ trackIndex, eventIndex, event });
    return true;
  }

  public loadData(data: LoadDataFormat): boolean {
    if (!data || typeof data !== "object") {
      this.logger.error("无效的数据格式");
      return false;
    }
    this.state.tracks = [];
    this.state.selectedTrack = null;
    this.state.selectedEvent = null;
    const tracks = data.tracks || [];
    for (let i = 0; i < tracks.length; i++) {
      const trackData = tracks[i];
      const track: Track = { id: this.state.tracks.length, events: [] };
      const events = trackData.events || [];
      for (let j = 0; j < events.length; j++) {
        const eventData = events[j];
        if (!eventData.title) continue;
        let startTime: number;
        let duration: number;
        if (eventData.endTime !== undefined) {
          startTime = eventData.startTime || 0;
          duration = fixFloatPrecision(eventData.endTime - startTime);
        } else if (eventData.duration !== undefined) {
          startTime = eventData.startTime || 0;
          duration = eventData.duration;
        } else {
          continue;
        }
        const fixedDuration = fixFloatPrecision(duration);
        const event: TimelineEvent = {
          id: track.events.length,
          startTime,
          endTime: fixFloatPrecision(startTime + fixedDuration),
          duration: fixedDuration,
          title: eventData.title,
          description: eventData.description || "",
          color:
            eventData.color ||
            this.config.colors.eventColors[
              track.events.length % this.config.colors.eventColors.length
            ],
          ...(eventData.readonly && { readonly: eventData.readonly }),
          ...(eventData.customData && { customData: eventData.customData }),
        };
        track.events.push(event);
      }
      this.state.tracks.push(track);
    }
    if (this.state.tracks.length === 0) this.addTrack();
    this.eventIndexManager.invalidateAll();
    if (data.timeIndicatorPosition !== undefined)
      this.setTimeIndicator(data.timeIndicatorPosition);
    this.notifyChange("data:load");
    this.setStatus(`已加载 ${this.state.tracks.length} 个轨道`);
    return true;
  }

  public setTimeIndicator(seconds: number, applySnap = false): boolean {
    if (typeof seconds !== "number" || isNaN(seconds)) {
      this.logger.error("时间指示器位置必须是数字（秒）");
      return false;
    }
    if (applySnap && this.state.snapEnabled) {
      const snapIntervalSeconds = getSnapInterval(
        this.state.zoomLevel,
        this.config.snapInterval,
        this.config.snapToSeconds,
        this.config.secondPrecisionZoomThreshold
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
    this.setStatus(`时间指示器已移动到: ${formatTime(seconds)}`);
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

  /** 上一次边界滚动的时间戳 */
  private _lastEdgeScrollTime = 0;
  /** 边界滚动节流间隔（ms） */
  private static readonly EDGE_SCROLL_THROTTLE = 80;
  /** 距画布边缘多少 px 内触发滚动 */
  private static readonly EDGE_SCROLL_MARGIN = 30;

  /**
   * 拖拽过程中的节流边界滚动
   * 仅当指示器距离画布边缘 < EDGE_SCROLL_MARGIN 时才调整 scrollX，
   * 且受 EDGE_SCROLL_THROTTLE 节流。
   */
  private scrollToTimeIndicatorThrottled(seconds: number): void {
    const now = performance.now();
    if (now - this._lastEdgeScrollTime < Timeline.EDGE_SCROLL_THROTTLE) return;

    const timeIndicatorX = getTimeX(
      seconds,
      this.config.startTime,
      this.config.startPaddingTime,
      this.config.secondWidth,
      this.state.zoomLevel,
      this.state.scrollX
    );
    const canvasWidth = this.renderManager.getCanvasLogicalWidth();
    const margin = Timeline.EDGE_SCROLL_MARGIN;

    if (timeIndicatorX >= margin && timeIndicatorX <= canvasWidth - margin) {
      // 在安全区域内，无需滚动
      return;
    }

    this._lastEdgeScrollTime = now;
    const scrollMargin = 50; // 滚动后保留的边距
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

    if (timeIndicatorX < margin) {
      this.state.scrollX = Math.max(
        0,
        Math.min(maxScrollX, timeAtZeroScroll - scrollMargin)
      );
    } else {
      this.state.scrollX = Math.max(
        0,
        Math.min(maxScrollX, timeAtZeroScroll - (canvasWidth - scrollMargin))
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
    const margin = 50;
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
    // 仅在实际发生滚动时才标记所有层脏
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
    this.setStatus(`缩放级别: ${Math.round(this.state.zoomLevel * 100)}%`);
    if (this.callbacks.onZoom && oldZoomLevel !== this.state.zoomLevel) {
      this.callbacks.onZoom({
        zoomLevel: this.state.zoomLevel,
        percentage: Math.round(this.state.zoomLevel * 100),
      });
    }
  }

  public setZoomLevel(zoomLevel: number): boolean {
    if (typeof zoomLevel !== "number" || isNaN(zoomLevel)) {
      this.logger.error("缩放级别必须是有效的数字");
      return false;
    }
    if (zoomLevel < 1.0 || zoomLevel > 1000.0) {
      this.logger.error("缩放级别超出有效范围 (1-1000)");
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
    this.setStatus(`缩放级别: ${Math.round(this.state.zoomLevel * 100)}%`);
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
      this.logger.error("结束时间必须是有效的数字（秒）");
      return false;
    }
    if (endTime <= this.config.startTime) {
      this.logger.error("结束时间必须大于开始时间");
      return false;
    }
    const hasOverflowEvents = this.state.tracks.some((track) =>
      track.events.some((event) => event.endTime > endTime)
    );
    if (hasOverflowEvents) {
      this.logger.warn("警告：有事件超出新的结束时间范围");
    }
    const oldEndTime = this.config.endTime;
    this.config.endTime = endTime;
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
      `结束时间已更新: ${formatTime(oldEndTime)} → ${formatTime(endTime)}`
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
    const result: InteractionTarget = {
      trackIndex: null,
      eventIndex: null,
      resizeEdge: null,
    };

    const logicalY = canvasY + this.state.scrollY;
    if (logicalY < this.config.timelineHeight) return result;

    const trackIndex = Math.floor(
      (logicalY -
        this.config.timelineHeight -
        this.config.firstTrackTopMargin) /
        (this.config.trackHeight + this.config.trackMargin)
    );
    if (trackIndex < 0 || trackIndex >= this.state.tracks.length) return result;

    result.trackIndex = trackIndex;
    const track = this.state.tracks[trackIndex];
    const eventVerticalPadding = Math.max(5, this.config.trackHeight * 0.0625);
    const trackY =
      this.config.timelineHeight +
      this.config.firstTrackTopMargin +
      trackIndex * (this.config.trackHeight + this.config.trackMargin) -
      this.state.scrollY;

    if (
      canvasY < trackY + eventVerticalPadding ||
      canvasY > trackY + this.config.trackHeight - eventVerticalPadding
    ) {
      return result;
    }

    const mouseTime =
      (canvasX + this.state.scrollX - this.config.startPaddingTime) /
        (this.config.secondWidth * this.state.zoomLevel) +
      this.config.startTime;

    const handleWidth = this.config.resizeHandleWidth;
    const margin =
      handleWidth / (this.config.secondWidth * this.state.zoomLevel);

    // 用较大的 margin 获取候选，同时满足 resize handle 和事件体需求
    const candidates = this.eventIndexManager.getCandidatesByTime(
      trackIndex,
      mouseTime,
      margin
    );

    if (candidates.length === 0) return result;

    // O(n) max-scan：追踪最高 z-order（eventIndex 最大）的命中
    let bestResizeIndex: number | null = null;
    let bestResizeEdge: "left" | "right" | null = null;
    let bestEventIndex: number | null = null;

    for (const eventIndex of candidates) {
      const event = track.events[eventIndex];
      const eventX =
        this.config.startPaddingTime +
        (event.startTime - this.config.startTime) *
          this.config.secondWidth *
          this.state.zoomLevel -
        this.state.scrollX;
      const eventWidth =
        event.duration * this.config.secondWidth * this.state.zoomLevel;

      // 检测 resize handle（优先级高于事件体）
      if (
        canvasX >= eventX - handleWidth / 2 &&
        canvasX <= eventX + handleWidth / 2
      ) {
        if (bestResizeIndex === null || eventIndex > bestResizeIndex) {
          bestResizeIndex = eventIndex;
          bestResizeEdge = "left";
        }
      } else if (
        canvasX >= eventX + eventWidth - handleWidth / 2 &&
        canvasX <= eventX + eventWidth + handleWidth / 2
      ) {
        if (bestResizeIndex === null || eventIndex > bestResizeIndex) {
          bestResizeIndex = eventIndex;
          bestResizeEdge = "right";
        }
      }

      // 检测事件体
      if (canvasX >= eventX && canvasX <= eventX + eventWidth) {
        if (bestEventIndex === null || eventIndex > bestEventIndex) {
          bestEventIndex = eventIndex;
        }
      }
    }

    // resize handle 优先级高于事件体
    if (bestResizeIndex !== null) {
      result.eventIndex = bestResizeIndex;
      result.resizeEdge = bestResizeEdge;
    } else if (bestEventIndex !== null) {
      result.eventIndex = bestEventIndex;
    }

    return result;
  }

  public getEventAtPosition(
    x: number,
    y: number
  ): { trackIndex: number; eventIndex: number } | null {
    // 将画布坐标转换为逻辑坐标（考虑滚动偏移）
    const logicalY = y + this.state.scrollY;
    if (logicalY < this.config.timelineHeight) return null;
    const trackIndex = Math.floor(
      (logicalY -
        this.config.timelineHeight -
        this.config.firstTrackTopMargin) /
        (this.config.trackHeight + this.config.trackMargin)
    );
    if (trackIndex < 0 || trackIndex >= this.state.tracks.length) return null;
    const track = this.state.tracks[trackIndex];
    const eventVerticalPadding = Math.max(5, this.config.trackHeight * 0.0625);
    const trackY =
      this.config.timelineHeight +
      this.config.firstTrackTopMargin +
      trackIndex * (this.config.trackHeight + this.config.trackMargin) -
      this.state.scrollY;
    if (
      y < trackY + eventVerticalPadding ||
      y > trackY + this.config.trackHeight - eventVerticalPadding
    ) {
      return null;
    }
    const mouseTime =
      (x + this.state.scrollX - this.config.startPaddingTime) /
        (this.config.secondWidth * this.state.zoomLevel) +
      this.config.startTime;
    const candidates = this.eventIndexManager.getCandidatesByTime(
      trackIndex,
      mouseTime,
      0
    );

    if (candidates.length > 0) {
      // O(n) max-scan 替代 sort：找到 eventIndex 最大（z-order 最高）的命中
      let bestHit: number | null = null;
      for (const eventIndex of candidates) {
        const event = track.events[eventIndex];
        const eventX =
          this.config.startPaddingTime +
          (event.startTime - this.config.startTime) *
            this.config.secondWidth *
            this.state.zoomLevel -
          this.state.scrollX;
        const eventWidth =
          event.duration * this.config.secondWidth * this.state.zoomLevel;

        if (x >= eventX && x <= eventX + eventWidth) {
          if (bestHit === null || eventIndex > bestHit) {
            bestHit = eventIndex;
          }
        }
      }
      if (bestHit !== null) {
        return { trackIndex, eventIndex: bestHit };
      }
    }
    return null;
  }

  public getResizeHandle(
    x: number,
    y: number
  ): { trackIndex: number; eventIndex: number; edge: "left" | "right" } | null {
    // 将画布坐标转换为逻辑坐标（考虑滚动偏移）
    const logicalY = y + this.state.scrollY;
    if (logicalY < this.config.timelineHeight) return null;
    const trackIndex = Math.floor(
      (logicalY -
        this.config.timelineHeight -
        this.config.firstTrackTopMargin) /
        (this.config.trackHeight + this.config.trackMargin)
    );
    if (trackIndex < 0 || trackIndex >= this.state.tracks.length) return null;
    const track = this.state.tracks[trackIndex];
    const handleWidth = this.config.resizeHandleWidth;
    const eventVerticalPadding = Math.max(5, this.config.trackHeight * 0.0625);
    const trackY =
      this.config.timelineHeight +
      this.config.firstTrackTopMargin +
      trackIndex * (this.config.trackHeight + this.config.trackMargin) -
      this.state.scrollY;
    if (
      y < trackY + eventVerticalPadding ||
      y > trackY + this.config.trackHeight - eventVerticalPadding
    ) {
      return null;
    }
    const mouseTime =
      (x + this.state.scrollX - this.config.startPaddingTime) /
        (this.config.secondWidth * this.state.zoomLevel) +
      this.config.startTime;
    const margin =
      handleWidth / (this.config.secondWidth * this.state.zoomLevel);
    const candidates = this.eventIndexManager.getCandidatesByTime(
      trackIndex,
      mouseTime,
      margin
    );
    if (candidates.length > 0) {
      // O(n) max-scan 替代 sort：找到 eventIndex 最大（z-order 最高）的 resize handle 命中
      let bestIndex: number | null = null;
      let bestEdge: "left" | "right" | null = null;
      for (const eventIndex of candidates) {
        const event = track.events[eventIndex];
        const eventX =
          this.config.startPaddingTime +
          (event.startTime - this.config.startTime) *
            this.config.secondWidth *
            this.state.zoomLevel -
          this.state.scrollX;
        const eventWidth =
          event.duration * this.config.secondWidth * this.state.zoomLevel;
        if (x >= eventX - handleWidth / 2 && x <= eventX + handleWidth / 2) {
          if (bestIndex === null || eventIndex > bestIndex) {
            bestIndex = eventIndex;
            bestEdge = "left";
          }
        } else if (
          x >= eventX + eventWidth - handleWidth / 2 &&
          x <= eventX + eventWidth + handleWidth / 2
        ) {
          if (bestIndex === null || eventIndex > bestIndex) {
            bestIndex = eventIndex;
            bestEdge = "right";
          }
        }
      }
      if (bestIndex !== null) {
        return { trackIndex, eventIndex: bestIndex, edge: bestEdge! };
      }
    }
    return null;
  }

  public calculateGuideLines(
    fromTrackIndex: number,
    eventIndex: number,
    toTrackIndex: number,
    newStartTime: number,
    duration: number
  ): Array<{ time: number; type: "start" | "end"; trackIndices: number[] }> {
    const cacheKey = `${fromTrackIndex}-${eventIndex}-${toTrackIndex}-${newStartTime.toFixed(
      3
    )}-${duration.toFixed(3)}`;
    const now = Date.now();
    if (now - this.guideLinesCacheTimestamp < this.GUIDE_LINES_CACHE_TTL) {
      const cached = this.guideLinesCache.get(cacheKey);
      if (cached) return cached;
    } else {
      this.guideLinesCache.clear();
      this.guideLinesCacheTimestamp = now;
    }
    const guideLines: Array<{
      time: number;
      type: "start" | "end";
      trackIndices: number[];
    }> = [];
    const threshold = this.config.guideLineSnapThreshold;
    const newEndTime = newStartTime + duration;
    const tracksToCheck = new Set<number>();
    tracksToCheck.add(toTrackIndex);
    if (toTrackIndex > 0) tracksToCheck.add(toTrackIndex - 1);
    if (toTrackIndex < this.state.tracks.length - 1)
      tracksToCheck.add(toTrackIndex + 1);
    const addGuideLine = (
      time: number,
      type: "start" | "end",
      trackIndex: number
    ) => {
      const existing = guideLines.find(
        (gl) => Math.abs(gl.time - time) < 0.0001 && gl.type === type
      );
      if (existing) {
        if (!existing.trackIndices.includes(trackIndex))
          existing.trackIndices.push(trackIndex);
      } else {
        guideLines.push({ time, type, trackIndices: [trackIndex] });
      }
    };
    for (const i of tracksToCheck) {
      if (i < 0 || i >= this.state.tracks.length) continue;
      const track = this.state.tracks[i];
      if (track.events.length === 0) continue;
      const candidateEvents: typeof track.events = [];
      for (let j = 0; j < track.events.length; j++) {
        if (i === fromTrackIndex && j === eventIndex) continue;
        const otherEvent = track.events[j];
        if (
          otherEvent.endTime < newStartTime - threshold ||
          otherEvent.startTime > newEndTime + threshold
        )
          continue;
        candidateEvents.push(otherEvent);
      }
      if (candidateEvents.length === 0) continue;
      for (const otherEvent of candidateEvents) {
        if (Math.abs(otherEvent.startTime - newStartTime) < threshold)
          addGuideLine(otherEvent.startTime, "start", i);
        if (Math.abs(otherEvent.endTime - newEndTime) < threshold)
          addGuideLine(otherEvent.endTime, "end", i);
        if (Math.abs(otherEvent.endTime - newStartTime) < threshold)
          addGuideLine(otherEvent.endTime, "end", i);
        if (Math.abs(otherEvent.startTime - newEndTime) < threshold)
          addGuideLine(otherEvent.startTime, "start", i);
      }
    }
    this.guideLinesCache.set(cacheKey, guideLines);
    return guideLines;
  }

  public snapToGuideLines(
    newStartTime: number,
    duration: number
  ): number | null {
    if (this.state.guideLines.length === 0) return null;
    const threshold = this.config.guideLineSnapThreshold;
    const newEndTime = newStartTime + duration;
    for (const guideLine of this.state.guideLines) {
      if (guideLine.type === "start") {
        if (Math.abs(guideLine.time - newStartTime) < threshold)
          return guideLine.time;
      } else if (guideLine.type === "end") {
        if (Math.abs(guideLine.time - newEndTime) < threshold)
          return guideLine.time - duration;
      }
    }
    return null;
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
      this.setStatus("切割位置无效：切割后的事件块时长太短");
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
    this.eventIndexManager.invalidateTrack(trackIndex);
    this.notifyChange("events:split");
    this.setStatus(`已切割事件: ${event.title}`);
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
    this.setStatus(readOnly ? "已进入只读模式" : "已退出只读模式");
  }
  public highlightEvent(trackIndex: number, eventIndex: number): boolean {
    if (trackIndex < 0 || trackIndex >= this.state.tracks.length) {
      this.logger.error(`无效的轨道索引: ${trackIndex}`);
      return false;
    }
    const track = this.state.tracks[trackIndex];
    if (eventIndex < 0 || eventIndex >= track.events.length) {
      this.logger.error(`无效的事件索引: ${eventIndex}`);
      return false;
    }
    this.state.selectedEvent = null;
    this.state.selectedTrack = null;
    this.state.highlightedEvent = { trackIndex, eventIndex };
    const event = track.events[eventIndex];
    this.notifyChange("highlight:change");
    this.setStatus(`已高亮事件: ${event.title}`);
    return true;
  }

  public clearHighlight(): void {
    if (this.state.highlightedEvent || this.state.selectedEvent) {
      this.state.highlightedEvent = null;
      this.state.selectedEvent = null;
      this.state.selectedTrack = null;
      this.notifyChange("highlight:change");
      this.setStatus("已清除高亮");
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
    this.guideLinesCache.clear();
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
    this.setStatus("Timeline 已销毁");
  }
}
