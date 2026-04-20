import type {
  TimelineConfig,
  TimelineState,
  TimelineOptions,
  TimelineCallbacks,
  TimelineMessageParams,
  TimelineEvent,
  LoadDataFormat,
  InteractionTarget,
} from "../types";
import {
  DEFAULT_CONFIG,
  DEFAULT_COLORS,
  DEFAULT_EVENT_TEXT_STYLE,
  DEFAULT_EVENT_BLOCK_STYLE,
  DEFAULT_CONTEXT_MENU_STYLE,
  formatTime,
  fixFloatPrecision,
  cloneEvent,
  createDefaultContextMenuItems,
  createTimelineMessages,
  normalizeTimelineLocale,
  translateTimelineMessage,
  type TimelineMessageKey,
} from "../utils";
import { RenderManager } from "./managers/RenderManager";
import { PluginManager } from "./managers/PluginManager";
import { Logger, configureGlobalLogger } from "./managers/Logger";
import { ErrorHandler } from "./managers/ErrorHandler";
import { StateManager } from "./managers/StateManager";
import { EventIndexManager } from "./managers/EventIndexManager";
import { ChangeScheduler, type ChangeType } from "./managers/ChangeScheduler";
import { EventMutationService } from "./managers/EventMutationService";
import { GuideLineService } from "./managers/GuideLineService";
import { HitTestService } from "./managers/HitTestService";
import { TrackManager } from "./managers/TrackManager";
import { TimeIndicatorController } from "./managers/TimeIndicatorController";
import { ViewportController } from "./managers/ViewportController";
import { CanvasController } from "./managers/CanvasController";
import { InteractionManager } from "./managers/InteractionManager";
import { PluginController } from "./managers/PluginController";
// Built-in plugins are now optional external imports for tree-shaking.
import { LightThemePlugin } from "../plugins/builtin/LightThemePlugin";
import { DarkThemePlugin } from "../plugins/builtin/DarkThemePlugin";
import { type TimelinePlugin } from "../plugins/types";

export class Timeline {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public config: TimelineConfig;
  public callbacks: TimelineCallbacks;
  public state: TimelineState;
  private renderManager: RenderManager;
  private canvasController: CanvasController;
  private interactionManager: InteractionManager;

  private pluginManager: PluginManager;
  private pluginController: PluginController;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private stateManager: StateManager;
  private eventIndexManager: EventIndexManager;
  private eventMutationService: EventMutationService;
  private trackManager: TrackManager;
  private timeIndicatorController: TimeIndicatorController;
  private viewportController: ViewportController;
  private guideLineService: GuideLineService;
  private hitTestService: HitTestService;
  private changeScheduler: ChangeScheduler;

  constructor(canvasId: string, options: TimelineOptions = {}) {
    const locale = normalizeTimelineLocale(options.locale);
    const messages = createTimelineMessages(locale, options.messages);

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
      this.errorHandler.throw(
        translateTimelineMessage(messages, "errorCanvasNotFound", {
          canvasId,
        })
      );
    }

    this.canvas = canvas as HTMLCanvasElement;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      this.errorHandler.throw(
        translateTimelineMessage(messages, "errorCanvasContextUnavailable")
      );
    }
    this.ctx = ctx as CanvasRenderingContext2D;

    if (options.startPaddingTime === undefined) {
      options.startPaddingTime = 10;
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...options,
      locale,
      messages,
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
      eventDurationPrefix:
        options.eventDurationPrefix ?? messages.labelDurationPrefix,
      contextMenuItems:
        options.contextMenuItems || createDefaultContextMenuItems(messages),
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
    this.trackManager = new TrackManager(this.state);
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

    this.pluginManager = new PluginManager({
      timeline: this,
      config: this.config,
      state: this.state,
    });
    this.renderManager = new RenderManager(
      this.canvas,
      this.ctx,
      this.config,
      this.state,
      this.pluginManager
    );
    this.pluginController = new PluginController({
      pluginManager: this.pluginManager,
      builtinThemes: {
        light: LightThemePlugin,
        dark: DarkThemePlugin,
      },
      onThemeChanged: () => this.notifyChange("theme:change"),
      onPluginVisualChange: () => this.redrawAfterPluginChange(),
    });
    // ContextMenuPlugin 需要通过 usePlugin() 显式加载
    // 不再自动加载以支持完全的插件化架构
    this.canvasController = new CanvasController({
      canvas: this.canvas,
      config: this.config,
      state: this.state,
      renderManager: this.renderManager,
      onCanvasResize: () => this.notifyChange("canvas:resize"),
    });
    this.interactionManager = new InteractionManager({
      timeline: this,
      canvasController: this.canvasController,
    });
    if (options.theme) {
      this.pluginController.loadInitialTheme(options.theme);
    }
    this.timeIndicatorController = new TimeIndicatorController({
      config: this.config,
      state: this.state,
      renderManager: this.renderManager,
    });
    this.viewportController = new ViewportController({
      config: this.config,
      state: this.state,
      renderManager: this.renderManager,
    });

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
    this.interactionManager.bind();
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public async usePlugin(plugin: TimelinePlugin): Promise<boolean> {
    return this.pluginController.usePlugin(plugin);
  }

  public getLoadedPlugins(): TimelinePlugin[] {
    return this.pluginController.getLoadedPlugins();
  }

  public isPluginLoaded(pluginName: string): boolean {
    return this.pluginController.isPluginLoaded(pluginName);
  }

  public async removePlugin(pluginId: string): Promise<boolean> {
    return this.pluginController.removePlugin(pluginId);
  }

  public async setTheme(theme: "light" | "dark"): Promise<boolean> {
    return this.pluginController.setTheme(theme);
  }

  private init(): void {
    if (this.config.autoFitOnInit) {
      this.autoFitViewport();
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

  private autoFitViewport(): void {
    this.adjustCanvasSize();
    const result = this.viewportController.autoFitToCanvas();
    switch (result.type) {
      case "fit":
        this.setStatus(
          this.t("statusAutoFit", {
            percentage: result.percentage,
          })
        );
        break;
      case "cappedWithPadding":
        this.setStatus(
          this.t("statusAutoFitCappedWithPadding", {
            percentage: result.percentage,
            seconds: result.seconds,
          })
        );
        break;
      case "cappedContentShort":
        this.setStatus(
          this.t("statusAutoFitCappedContentShort", {
            percentage: result.percentage,
          })
        );
        break;
      default:
        break;
    }
  }

  public setCanvasSize(width: number, height: number): void {
    this.canvasController.setCanvasSize(width, height);
  }

  public getCanvasLogicalHeight(): number {
    return this.canvasController.getCanvasLogicalHeight();
  }

  public getCachedLogicalHeight(): number {
    return this.canvasController.getCachedLogicalHeight();
  }

  public adjustCanvasSize(): void {
    this.canvasController.adjustCanvasSize();
  }

  public addTrack(): void {
    const track = this.trackManager.addTrack();
    this.clearGuideLineCache();
    this.adjustCanvasSize();
    this.setStatus(
      this.t("statusTrackAdded", { count: this.state.tracks.length })
    );
    if (this.callbacks.onTrackAdd) this.callbacks.onTrackAdd(track);
  }

  public removeTrack(): void {
    const removedTrack = this.trackManager.removeTrack();
    if (!removedTrack) {
      this.setStatus(this.t("statusAtLeastOneTrackRequired"));
      return;
    }
    this.clearGuideLineCache();
    this.adjustCanvasSize();
    this.setStatus(
      this.t("statusTrackRemoved", { count: this.state.tracks.length })
    );
    if (this.callbacks.onTrackRemove)
      this.callbacks.onTrackRemove(removedTrack);
  }

  public autoRemoveEmptyLastTrack(): void {
    if (!this.config.autoRemoveEmptyLastTrack) return;
    let removedTrack = this.trackManager.removeEmptyLastTrack();
    while (removedTrack) {
      this.clearGuideLineCache();
      this.setStatus(
        this.t("statusEmptyTrackRemoved", {
          count: this.state.tracks.length,
        })
      );
      if (this.callbacks.onTrackRemove)
        this.callbacks.onTrackRemove(removedTrack);
      this.adjustCanvasSize();
      removedTrack = this.trackManager.removeEmptyLastTrack();
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
    this.setStatus(
      this.t("statusEventUpdated", { title: result.event.title })
    );
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
    this.setStatus(
      this.t("statusEventUpdated", { title: result.event.title })
    );
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
    this.setStatus(this.t("statusEventDeleted", { title: event.title }));
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
    this.setStatus(
      this.t("statusDataLoaded", { count: this.state.tracks.length })
    );
    return true;
  }

  public setTimeIndicator(seconds: number, applySnap = false): boolean {
    if (typeof seconds !== "number" || isNaN(seconds)) {
      this.logger.error(this.t("errorTimeIndicatorInvalid"));
      return false;
    }
    const result = this.timeIndicatorController.setPosition(seconds, applySnap);
    if (!result.changed) return true;
    // 使用调度器处理高亮计算和回调触发
    this.notifyChange("timeIndicator:move");
    const formattedTime = formatTime(result.position);
    this.setStatus(
      this.t("statusTimeIndicatorMoved", {
        time: formattedTime,
      })
    );
    if (this.callbacks.onTimeIndicatorMove)
      this.callbacks.onTimeIndicatorMove({
        position: result.position,
        time: formattedTime,
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
    this.timeIndicatorController.setPositionDuringDrag(seconds);
    this.notifyChange("timeIndicator:drag");
  }

  public zoom(factor: number): void {
    const result = this.viewportController.zoomByFactor(factor);
    this.notifyChange("zoom:change");
    this.setStatus(
      this.t("statusZoomChanged", {
        percentage: result.percentage,
      })
    );
    if (this.callbacks.onZoom && result.changed) {
      this.callbacks.onZoom({
        zoomLevel: result.zoomLevel,
        percentage: result.percentage,
      });
    }
  }

  public setZoomLevel(zoomLevel: number): boolean {
    if (typeof zoomLevel !== "number" || isNaN(zoomLevel)) {
      this.logger.error(this.t("errorZoomLevelInvalid"));
      return false;
    }
    if (zoomLevel < 1.0 || zoomLevel > 1000.0) {
      this.logger.error(this.t("errorZoomLevelOutOfRange"));
      return false;
    }
    const result = this.viewportController.setZoomLevel(zoomLevel);
    this.notifyChange("zoom:change");
    this.setStatus(
      this.t("statusZoomChanged", {
        percentage: result.percentage,
      })
    );
    if (this.callbacks.onZoom && result.changed) {
      this.callbacks.onZoom({
        zoomLevel: result.zoomLevel,
        percentage: result.percentage,
      });
    }
    return true;
  }

  public getZoomLevel(): number {
    return this.state.zoomLevel;
  }

  public setEndTime(endTime: number): boolean {
    if (typeof endTime !== "number" || isNaN(endTime)) {
      this.logger.error(this.t("errorEndTimeInvalid"));
      return false;
    }
    if (endTime <= this.config.startTime) {
      this.logger.error(this.t("errorEndTimeNotAfterStart"));
      return false;
    }
    const result = this.viewportController.setEndTime(endTime);
    if (result.hasOverflowEvents) {
      this.logger.warn(this.t("warningEventsExceedEndTime"));
    }
    this.clearGuideLineCache();
    this.notifyChange("config:endTime");
    this.setStatus(
      this.t("statusEndTimeUpdated", {
        from: formatTime(result.oldEndTime),
        to: formatTime(result.endTime),
      })
    );
    return true;
  }

  public getEndTime(): number {
    return this.config.endTime;
  }

  public formatTime(seconds: number): string {
    return formatTime(seconds);
  }

  public t(
    key: TimelineMessageKey,
    params: TimelineMessageParams = {}
  ): string {
    return translateTimelineMessage(this.config.messages, key, params);
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
      this.setStatus(this.t("statusInvalidSplitPosition"));
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
    this.setStatus(this.t("statusEventSplit", { title: event.title }));
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
    this.setStatus(
      this.t(
        readOnly ? "statusReadOnlyModeEnabled" : "statusReadOnlyModeDisabled"
      )
    );
  }
  public highlightEvent(trackIndex: number, eventIndex: number): boolean {
    if (trackIndex < 0 || trackIndex >= this.state.tracks.length) {
      this.logger.error(
        this.t("errorInvalidTrackIndexWithValue", { trackIndex })
      );
      return false;
    }
    const track = this.state.tracks[trackIndex];
    if (eventIndex < 0 || eventIndex >= track.events.length) {
      this.logger.error(
        this.t("errorInvalidEventIndexWithValue", { eventIndex })
      );
      return false;
    }
    this.state.selectedEvent = null;
    this.state.selectedTrack = null;
    this.state.highlightedEvent = { trackIndex, eventIndex };
    const event = track.events[eventIndex];
    this.notifyChange("highlight:change");
    this.setStatus(
      this.t("statusEventHighlighted", { title: event.title })
    );
    return true;
  }

  public clearHighlight(): void {
    if (this.state.highlightedEvent || this.state.selectedEvent) {
      this.state.highlightedEvent = null;
      this.state.selectedEvent = null;
      this.state.selectedTrack = null;
      this.notifyChange("highlight:change");
      this.setStatus(this.t("statusHighlightCleared"));
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
    this.interactionManager.destroy();
    this.setStatus(this.t("statusTimelineDestroyed"));
  }

  private clearGuideLineCache(): void {
    this.guideLineService.clearCache();
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
