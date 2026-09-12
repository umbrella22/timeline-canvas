import type {
  BusinessId,
  ScheduleDataFormat,
  ScheduleEventLocation,
  ScheduleEventPatch,
  ScheduleEventUpsert,
  ScheduleResult,
  TimelineConfig,
  TimelineState,
  TimelineOptions,
  TimelineCallbacks,
  TimelineViewportSnapshot,
  TimelineMessageParams,
  TimelineEvent,
  Track,
  TrackRect,
  ViewportListener,
  LoadDataFormat,
  InteractionTarget,
  ScheduleChange,
  ScheduleCommitStateData,
  SchedulePlacement,
  ScheduleEditState,
  ScheduleValidationResult,
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
  getTimeX,
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
import { BusinessIdentityIndex } from "./managers/BusinessIdentityIndex";
import { EditTransactionController as EditTransactionControllerClass } from "./managers/EditTransactionController";
import { ScheduleCommitCoordinator, type AcceptedPublishResult } from "./managers/ScheduleCommitCoordinator";
import { ScheduleDataService } from "./managers/ScheduleDataService";
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
  private businessIdentityIndex: BusinessIdentityIndex;
  private scheduleDataService: ScheduleDataService;
  private eventMutationService: EventMutationService;
  private trackManager: TrackManager;
  private timeIndicatorController: TimeIndicatorController;
  private viewportController: ViewportController;
  private guideLineService: GuideLineService;
  private hitTestService: HitTestService;
  private changeScheduler: ChangeScheduler;
  public editTransactions: EditTransactionControllerClass;
  private commitCoordinator: ScheduleCommitCoordinator;
  /** M2：编辑提交状态变化回调（独立于旧成功回调） */
  public onScheduleCommitStateChange: ((data: ScheduleCommitStateData) => void) | null = null;
  private destroyed = false;
  /** 数据集代数：整批权威替换（loadData/loadScheduleData）成功时自增，供提交协调器检测 accepted 通知内的重入刷新 */
  private datasetEpoch = 0;
  private destroyPromise: Promise<void> | undefined;

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

    // M2：编辑协议配置校验必须在任何监听/观察器注册之前失败
    EditTransactionControllerClass.validateOptions(options.scheduleEditing);
    this.onScheduleCommitStateChange = options.onScheduleCommitStateChange ?? null;

    this.stateManager = new StateManager(this.config);
    this.state = this.stateManager.state;
    this.trackManager = new TrackManager(this.state);
    this.eventIndexManager = new EventIndexManager(this.state);
    this.businessIdentityIndex = new BusinessIdentityIndex(this.state);
    this.editTransactions = new EditTransactionControllerClass(
      this.state,
      this.businessIdentityIndex,
      (data) => this.onScheduleCommitStateChange?.(data),
    );
    if (options.scheduleEditing) {
      this.editTransactions.configure(options.scheduleEditing);
    }
    this.commitCoordinator = new ScheduleCommitCoordinator({
      notify: (data) => this.onScheduleCommitStateChange?.(data),
      isAlive: () => !this.destroyed,
      getDatasetEpoch: () => this.datasetEpoch,
      notifySettled: () => this.notifyChange("events:update"),
      publishAccepted: (businessId, change, placement) =>
        this.publishAcceptedPlacement(businessId, change, placement),
      fireLegacySuccess: (change, placement, event, locations) =>
        this.fireLegacySuccessCallback(change, placement, event, locations),
      getTimeoutMs: () => options.scheduleEditing?.commitTimeoutMs ?? 30000,
    });
    this.commitCoordinator.attachController(this.editTransactions);
    this.editTransactions.commitSink = (result, change) =>
      this.commitCoordinator.handleResult(change, result);
    this.eventMutationService = new EventMutationService({
      config: this.config,
      state: this.state,
      eventIndexManager: this.eventIndexManager,
      logger: this.logger,
      onMutate: () => this.clearGuideLineCache(),
      onStructureInvalidated: (scope) => {
        if (scope === "all") this.businessIdentityIndex.markAllDirty();
        else this.businessIdentityIndex.markTrackDirty(scope);
      },
      hasBusinessIdConflict: (businessId) =>
        this.businessIdentityIndex.hasEvent(businessId),
    });
    this.scheduleDataService = new ScheduleDataService({
      config: this.config,
      state: this.state,
      businessIdentityIndex: this.businessIdentityIndex,
      eventIndexManager: this.eventIndexManager,
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
    if (this.destroyed) return;
    this.changeScheduler.notify(change);
    this.handleViewportRelevantChange(change);
  }

  private static readonly VIEWPORT_RELEVANT_CHANGES: ReadonlySet<ChangeType> =
    new Set<ChangeType>([
      "scroll:x",
      "scroll:y",
      "zoom:change",
      "canvas:resize",
      "tracks:add",
      "tracks:update",
      "tracks:remove",
      "data:load",
      "config:endTime",
    ]);

  private viewportBatching = false;

  private handleViewportRelevantChange(change: ChangeType): void {
    const viewport = this.renderManager.getViewportManager();
    if (!Timeline.VIEWPORT_RELEVANT_CHANGES.has(change)) return;
    viewport.markViewportChange();
    if (!this.viewportBatching) {
      viewport.flushViewportNotifications({
        width: this.renderManager.getCanvasLogicalWidth(),
        height: this.renderManager.getCanvasLogicalHeight(),
        dpr: this.renderManager.getDevicePixelRatio(),
      });
    }
  }

  /** 视口快照：逻辑像素几何；与订阅通知共享同一入口 */
  public getViewport(): TimelineViewportSnapshot {
    return this.renderManager
      .getViewportManager()
      .buildSnapshot(
        this.renderManager.getCanvasLogicalWidth(),
        this.renderManager.getCanvasLogicalHeight(),
        this.renderManager.getDevicePixelRatio()
      );
  }

  /** 订阅视口变化：立即同步收到当前快照；返回幂等取消函数 */
  public subscribeViewport(listener: ViewportListener): () => void {
    const viewport = this.renderManager.getViewportManager();
    return viewport.subscribeViewport(listener, () => ({
      width: this.renderManager.getCanvasLogicalWidth(),
      height: this.renderManager.getCanvasLogicalHeight(),
      dpr: this.renderManager.getDevicePixelRatio(),
    }));
  }

  /** 按业务身份查询资源行几何；完全离屏的行仍返回完整 rect，未知身份返回 null */
  public getTrackRectByBusinessId(businessId: BusinessId): TrackRect | null {
    const trackIndex = this.businessIdentityIndex.getTrackIndex(businessId);
    if (trackIndex === null) return null;
    const track = this.state.tracks[trackIndex];
    if (!track) return null;
    return this.renderManager.getViewportManager().getTrackRect(
      track.businessId ?? businessId,
      trackIndex,
      this.renderManager.getCanvasLogicalWidth(),
      this.renderManager.getCanvasLogicalHeight()
    );
  }

  /** 时间→X 坐标（CSS px）；不 clamp，视口外允许负值；非法输入返回 null */
  public timeToX(time: number): number | null {
    if (typeof time !== "number" || !Number.isFinite(time)) return null;
    return getTimeX(
      time,
      this.config.startTime,
      this.config.startPaddingTime,
      this.config.secondWidth,
      this.state.zoomLevel,
      this.state.scrollX
    );
  }

  /** X 坐标→时间；与 timeToX 互逆；非法输入返回 null */
  public xToTime(x: number): number | null {
    if (typeof x !== "number" || !Number.isFinite(x)) return null;
    const denominator = this.config.secondWidth * this.state.zoomLevel;
    if (denominator <= 0) return null;
    return (
      (x + this.state.scrollX - this.config.startPaddingTime) / denominator +
      this.config.startTime
    );
  }

  /**
   * 开始批量变更操作
   */
  public beginChangeBatch(): void {
    this.viewportBatching = true;
    this.changeScheduler.beginBatch();
  }

  /**
   * 结束批量变更操作
   */
  public endChangeBatch(): void {
    this.changeScheduler.endBatch();
    this.viewportBatching = false;
    // 显式批次只通知最终状态
    this.renderManager.getViewportManager().flushViewportNotifications({
      width: this.renderManager.getCanvasLogicalWidth(),
      height: this.renderManager.getCanvasLogicalHeight(),
      dpr: this.renderManager.getDevicePixelRatio(),
    });
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
    this.businessIdentityIndex.markTrackDirty(this.state.tracks.length - 1);
    this.setStatus(
      this.t("statusTrackAdded", { count: this.state.tracks.length })
    );
    if (this.callbacks.onTrackAdd) this.callbacks.onTrackAdd(track);
  }

  public removeTrack(): void {
    // W3：pending/unknown 事务引用的资源不可被普通 removeTrack 删除
    const lastTrack = this.state.tracks[this.state.tracks.length - 1];
    if (
      lastTrack?.businessId !== undefined &&
      this.editTransactions
        .getReservations()
        .some((r) => r.resourceBusinessId === lastTrack.businessId)
    ) {
      this.setStatus("resource is reserved by an in-flight edit operation");
      return;
    }
    const removedTrackIndex = this.state.tracks.length - 1;
    const removedTrack = this.trackManager.removeTrack();
    if (!removedTrack) {
      this.setStatus(this.t("statusAtLeastOneTrackRequired"));
      return;
    }
    this.clearGuideLineCache();
    this.adjustCanvasSize();
    this.businessIdentityIndex.markTrackDirty(removedTrackIndex);
    this.setStatus(
      this.t("statusTrackRemoved", { count: this.state.tracks.length })
    );
    if (this.callbacks.onTrackRemove)
      this.callbacks.onTrackRemove(removedTrack);
  }

  public autoRemoveEmptyLastTrack(): void {
    if (!this.config.autoRemoveEmptyLastTrack) return;
    // W3：被事务引用的资源不参与空尾轨自动清理
    const lastTrack = this.state.tracks[this.state.tracks.length - 1];
    if (
      lastTrack?.businessId !== undefined &&
      this.editTransactions
        .getReservations()
        .some((r) => r.resourceBusinessId === lastTrack.businessId)
    ) {
      return;
    }
    let removedTrack = this.trackManager.removeEmptyLastTrack();
    while (removedTrack) {
      this.clearGuideLineCache();
      this.businessIdentityIndex.markTrackDirty(this.state.tracks.length);
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
    // W3：被编辑事务锁定的事件不接受程序化字段修改（void 入口静默 no-op）
    const target = this.state.tracks[trackIndex]?.events[eventIndex];
    if (target?.businessId !== undefined && this.editTransactions.hasTransaction(target.businessId)) {
      return false;
    }
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
    // W3：被编辑事务锁定的事件不接受程序化数据修改（void 入口按既有反馈方式 no-op）
    const targetEvent = this.state.tracks[trackIndex]?.events[eventIndex];
    if (targetEvent?.businessId !== undefined && this.editTransactions.hasTransaction(targetEvent.businessId)) {
      return false;
    }

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
    const target = this.state.tracks[trackIndex]?.events[eventIndex];
    if (target?.businessId !== undefined && this.editTransactions.hasTransaction(target.businessId)) {
      return false;
    }
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

    this.datasetEpoch += 1;
    this.commitCoordinator.invalidateOperations(this.editTransactions.handleDatasetReplaced());
    if (this.state.tracks.length === 0) this.addTrack();
    if (data.timeIndicatorPosition !== undefined)
      this.setTimeIndicator(data.timeIndicatorPosition);
    // 数据集缩水后旧 scrollY 可能越界：先收敛并发布在界内的视口快照
    this.adjustCanvasSize();
    this.notifyChange("data:load");
    this.setStatus(
      this.t("statusDataLoaded", { count: this.state.tracks.length })
    );
    return true;
  }

  /** 事件被进行中的编辑事务锁定时的 typed 拒绝 */
  private lockedEditError(businessId: BusinessId): { ok: false; error: { code: "busy" | "reconciliation_required"; message: string } } | null {
    const transaction = this.editTransactions.getTransaction(businessId);
    if (!transaction) return null;
    if (transaction.state === "reconciliation_required") {
      return {
        ok: false,
        error: {
          code: "reconciliation_required",
          message: "event awaits authoritative reconciliation; edits are locked",
        },
      };
    }
    return {
      ok: false,
      error: { code: "busy", message: "event is locked by an in-flight edit operation" },
    };
  }

  /** 查询事件当前的编辑事务状态；事件不存在返回 null */
  public getScheduleEditState(id: BusinessId): ScheduleEditState | null {
    if (this.destroyed) return null;
    if (this.editTransactions.hasActiveTransaction(id)) {
      return this.editTransactions.getEditState(id);
    }
    if (!this.businessIdentityIndex.hasEvent(id)) return null;
    return { state: "idle" };
  }

  /**
   * 权威单事件恢复：以业务查询到的事实作废进行中的事务并原子替换/删除事件。
   * operationId 必须匹配当前事务；事务缺失/已终结返回 stale_operation（零写入）。
   */
  public reconcileScheduleEvent(
    id: BusinessId,
    snapshot: { resourceBusinessId: BusinessId; event: ScheduleEventUpsert["event"] } | null,
    options: { operationId: string },
  ): ScheduleResult<void> {
    if (this.destroyed) {
      return { ok: false, error: { code: "destroyed", message: "timeline instance is destroyed" } };
    }
    if (!this.businessIdentityIndex.hasEvent(id)) {
      return { ok: false, error: { code: "not_found", message: "no event with the given business id" } };
    }
    const transaction = this.editTransactions.getTransaction(id);
    if (!transaction || transaction.operationId !== options?.operationId) {
      return {
        ok: false,
        error: { code: "stale_operation", message: "operation no longer matches the current transaction" },
      };
    }
    if (snapshot === null) {
      // 权威删除：先作废事务（解除锁定），再删除事实，失败时事务已按权威语义终结
      const beforeSnapshot = transaction.before;
      const transactionAction = transaction.action;
      this.commitCoordinator.invalidateOperations([transaction.operationId]);
      this.editTransactions.invalidateTransaction(id, "authoritative deletion");
      const deleted = this.deleteEventByBusinessId(id);
      if (!deleted.ok) return deleted;
      this.notifyChange("events:delete");
      this.onScheduleCommitStateChange?.({
        state: "reconciled",
        operationId: options.operationId,
        eventBusinessId: id,
        action: transactionAction,
        before: beforeSnapshot,
        after: null,
      });
      return { ok: true, value: undefined };
    }
    if (typeof snapshot !== "object") {
      return { ok: false, error: { code: "invalid_input", message: "snapshot must be an object or null", path: "snapshot" } };
    }
    if (!snapshot.event || typeof snapshot.event !== "object") {
      return { ok: false, error: { code: "invalid_input", message: "snapshot.event must be an object", path: "snapshot.event" } };
    }
    if (snapshot.event.businessId !== id) {
      return {
        ok: false,
        error: { code: "invalid_input", message: "snapshot.event.businessId must match the reconciled id", path: "snapshot.event.businessId" },
      };
    }
    // 发布前预检目标资源存在性：避免"已作废事务但发布失败"的单向失效
    if (this.businessIdentityIndex.getTrackIndex(snapshot.resourceBusinessId) === null) {
      return {
        ok: false,
        error: { code: "not_found", message: "snapshot resource does not exist", path: "snapshot.resourceBusinessId" },
      };
    }
    // 发布前对权威快照做完整事件预检（title/时间窗/序列化）：预检失败零写入，
    // 事务保持 pending 可重试，不会进入"锁已释放但事实未更新"的不可重入态
    const snapshotPrecheck = this.scheduleDataService.validateSingleEventInput(snapshot.event, "snapshot.event");
    if (!snapshotPrecheck.ok) {
      return { ok: false, error: snapshotPrecheck.error };
    }
    // 先作废旧 operation（含停表），再原子发布权威事实
    this.commitCoordinator.invalidateOperations([transaction.operationId]);
    this.editTransactions.invalidateTransaction(id, "authoritative snapshot applied");
    const upsert = this.upsertScheduleEvents([
      { resourceBusinessId: snapshot.resourceBusinessId, event: snapshot.event },
    ]);
    if (!upsert.ok) {
      return { ok: false, error: upsert.error };
    }
    const located = this.getEventByBusinessId(id);
    this.notifyChange("events:update");
    this.onScheduleCommitStateChange?.({
      state: "reconciled",
      operationId: options.operationId,
      eventBusinessId: id,
      action: transaction.action,
      before: transaction.before,
      ...(located
        ? {
            after: {
              resourceBusinessId: snapshot.resourceBusinessId,
              event: located.event,
            },
          }
        : {}),
    });
    return { ok: true, value: undefined };
  }

  /**
   * 编辑候选的核心同步校验（typed）：只做本地约束，业务校验由
   * scheduleEditing.validate 在提交前单独执行，二者不允许互相替代。
   */
  public validateScheduleEditCandidate(
    params: {
      eventBusinessId: BusinessId;
      fromTrackIndex: number;
      fromEventIndex: number;
      toTrackIndex: number;
      startTime: number;
      endTime: number;
    },
    options?: { forPublish?: boolean },
  ): ScheduleValidationResult {
    const { eventBusinessId, fromTrackIndex, fromEventIndex, toTrackIndex, startTime, endTime } = params;
    if (this.destroyed) {
      return { allowed: false, code: "invalid_time", reason: "timeline instance is destroyed" };
    }
    const event = this.state.tracks[fromTrackIndex]?.events[fromEventIndex];
    if (!event) {
      return { allowed: false, code: "invalid_time", reason: "source event no longer exists" };
    }
    if (!options?.forPublish && (event.readonly || this.config.readOnly)) {
      return { allowed: false, code: "readonly", reason: "event or timeline is read-only" };
    }
    if (event.businessId === undefined || event.businessId !== eventBusinessId) {
      return { allowed: false, code: "missing_business_id", reason: "event business id mismatch" };
    }
    const targetTrack = this.state.tracks[toTrackIndex];
    if (!targetTrack || targetTrack.businessId === undefined) {
      return { allowed: false, code: "invalid_resource", reason: "target resource does not exist or has no business id" };
    }
    if (
      typeof startTime !== "number" ||
      typeof endTime !== "number" ||
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime) ||
      endTime - startTime < this.config.minEventDuration ||
      startTime < this.config.startTime ||
      endTime > this.config.endTime + this.config.endPaddingTime
    ) {
      return { allowed: false, code: "invalid_time", reason: "placement violates time constraints" };
    }
    // 已确认事实同轨防重叠（排除自身确认位置）；相邻 end==start 不算重叠
    for (let i = 0; i < targetTrack.events.length; i++) {
      if (toTrackIndex === fromTrackIndex && i === fromEventIndex) continue;
      const other = targetTrack.events[i];
      if (startTime < other.endTime && endTime > other.startTime) {
        return { allowed: false, code: "overlap", reason: "placement overlaps a confirmed event" };
      }
    }
    // W3：其他事务的 before/候选预约不可抢占（原占用 + 候选时段都参与防重叠）
    const targetResource = targetTrack.businessId;
    for (const reservation of this.editTransactions.getReservations(eventBusinessId)) {
      if (
        reservation.resourceBusinessId === targetResource &&
        startTime < reservation.endTime &&
        endTime > reservation.startTime
      ) {
        return {
          allowed: false,
          code: "reservation_conflict",
          reason: "placement conflicts with an in-flight edit reservation",
        };
      }
    }
    // 旧 boolean 插件仍生效，不能被新协议绕过（发布路径豁免：插件属 UI 级守卫）
    const pluginOk = options?.forPublish
      ? true
      : this.pluginManager.validateEvent("validate:event:move", {
      fromTrackIndex,
      fromEventIndex,
      toTrackIndex,
      newStartTime: startTime,
      duration: endTime - startTime,
        });
    if (!pluginOk) {
      return { allowed: false, code: "plugin_rejected", reason: "rejected by event-move plugin validation" };
    }
    return { allowed: true };
  }

  /**
   * 落点提交：最终候选校验 → 业务 validate → 通知 pending → 调用一次 onBeforeCommit。
   * 返回 false 表示未发起提交（typed 原因已通过状态回调/状态文本给出）。
   */
  public commitScheduleEdit(businessId: BusinessId): boolean {
    if (this.destroyed) return false;
    const transaction = this.editTransactions.getTransaction(businessId);
    if (!transaction || transaction.state !== "preview") return false;
    // 落点无效：丢弃当前编辑，不隐式提交上一个有效位置
    if (!transaction.lastCandidateValid) {
      this.editTransactions.cancelPreview(
        businessId,
        "drop position is invalid",
        "invalid_time",
        "validation_failed",
      );
      return false;
    }
    const draft = this.state.editDrafts.get(businessId);
    if (!draft) return false;
    const validation = this.validateScheduleEditCandidate({
      eventBusinessId: businessId,
      fromTrackIndex: transaction.beforeTrackIndex,
      fromEventIndex: transaction.beforeEventIndex,
      toTrackIndex: draft.targetTrackIndex,
      startTime: draft.startTime,
      endTime: draft.endTime,
    });
    if (!validation.allowed) {
      this.editTransactions.cancelPreview(businessId, validation.reason, validation.code, "validation_failed");
      this.setStatus(`${validation.code}: ${validation.reason}`);
      return false;
    }
    const change = this.editTransactions.buildChange(businessId);
    if (!change) return false;
    const businessResult = this.editTransactions.runBusinessValidate(change);
    if (!businessResult.allowed) {
      this.editTransactions.cancelPreview(businessId, businessResult.reason, businessResult.code, "validation_failed");
      this.setStatus(`${businessResult.code}: ${businessResult.reason}`);
      return false;
    }
    const started = this.editTransactions.beginCommit(businessId, change);
    if (started) {
      // hook 同步抛错时已在 beginCommit 内结算（进入待核对）：不再武装僵尸 timer
      const pendingTransaction = this.editTransactions.getTransaction(businessId);
      if (pendingTransaction?.state === "pending") {
        this.commitCoordinator.beginTiming(change);
      }
    }
    return started;
  }

  /** 接受结果的原子发布：身份/资源/时间/重叠（排除自身与预约）逐项校验后落盘 */
  private publishAcceptedPlacement(
    businessId: BusinessId,
    _change: ScheduleChange,
    placement: SchedulePlacement,
  ): AcceptedPublishResult {
    const location = this.businessIdentityIndex.getEventLocation(businessId);
    if (!location) {
      return { ok: false, code: "not_found", reason: "event no longer exists" };
    }
    const targetTrackIndex = this.businessIdentityIndex.getTrackIndex(placement.resourceBusinessId);
    if (targetTrackIndex === null) {
      return { ok: false, code: "invalid_resource", reason: "corrected resource does not exist" };
    }
    // 发布路径只做一致性校验（身份/资源/时间/重叠/预约）：
    // readonly 与插件属 UI 级守卫——pending 期间切换 readOnly 不应使服务器已确认的结果无法应用
    const validation = this.validateScheduleEditCandidate(
      {
        eventBusinessId: businessId,
        fromTrackIndex: location.trackIndex,
        fromEventIndex: location.eventIndex,
        toTrackIndex: targetTrackIndex,
        startTime: placement.startTime,
        endTime: placement.endTime,
      },
      { forPublish: true },
    );
    if (!validation.allowed) {
      // 待核对原因码统一为 reconciliation_required，细节并入 reason 文本
      return { ok: false, code: "reconciliation_required", reason: `${validation.code}: ${validation.reason}` };
    }
    const event = this.state.tracks[location.trackIndex].events[location.eventIndex];
    // 发布身份一致性：重复 businessId（legacy 容错装载可产生）会让索引定位到另一个
    // 同身份事件；此时拒绝发布并进入待核对，绝不把服务器确认的 placement
    // 落到未被编辑的事件上
    const beforeSnapshot = _change.before;
    const identityMatches =
      event.businessId === businessId &&
      event.startTime === beforeSnapshot.event.startTime &&
      event.endTime === beforeSnapshot.event.endTime &&
      this.state.tracks[location.trackIndex].businessId === beforeSnapshot.resourceBusinessId;
    if (!identityMatches) {
      return {
        ok: false,
        code: "reconciliation_required",
        reason: "located event no longer matches the edit snapshot; accepted placement withheld",
      };
    }
    event.startTime = placement.startTime;
    event.endTime = placement.endTime;
    event.duration = fixFloatPrecision(placement.endTime - placement.startTime);
    if (targetTrackIndex !== location.trackIndex) {
      this.state.tracks[location.trackIndex].events.splice(location.eventIndex, 1);
      this.state.tracks[targetTrackIndex].events.push(event);
      this.eventIndexManager.invalidateTrack(location.trackIndex);
      this.eventIndexManager.invalidateTrack(targetTrackIndex);
      this.businessIdentityIndex.markTrackDirty(location.trackIndex);
      this.businessIdentityIndex.markTrackDirty(targetTrackIndex);
      if (
        this.state.selectedEvent &&
        this.state.selectedEvent.trackIndex === location.trackIndex &&
        this.state.selectedEvent.eventIndex === location.eventIndex
      ) {
        this.state.selectedEvent = {
          trackIndex: targetTrackIndex,
          eventIndex: this.state.tracks[targetTrackIndex].events.length - 1,
        };
      }
      return {
        ok: true,
        event: cloneEvent(event),
        fromTrackIndex: location.trackIndex,
        fromEventIndex: location.eventIndex,
        toTrackIndex: targetTrackIndex,
        toEventIndex: this.state.tracks[targetTrackIndex].events.length - 1,
      };
    }
    this.eventIndexManager.invalidateTrack(location.trackIndex);
    this.businessIdentityIndex.markTrackDirty(location.trackIndex);
    return {
      ok: true,
      event: cloneEvent(event),
      fromTrackIndex: location.trackIndex,
      fromEventIndex: location.eventIndex,
      toTrackIndex: location.trackIndex,
      toEventIndex: location.eventIndex,
    };
  }

  /** 旧成功回调：确认后发送一次（move→onEventMove / resize→onEventUpdate） */
  private fireLegacySuccessCallback(
    change: ScheduleChange,
    placement: SchedulePlacement,
    event: TimelineEvent,
    locations: { fromTrackIndex: number; fromEventIndex: number; toTrackIndex: number; toEventIndex: number },
  ): void {
    if (change.action === "move") {
      if (this.callbacks.onEventMove) {
        this.callbacks.onEventMove({
          trackIndex: locations.toTrackIndex,
          eventIndex: locations.toEventIndex,
          event,
          fromTrackIndex: locations.fromTrackIndex,
          oldEvent: change.before.event,
          fromResourceBusinessId: change.before.resourceBusinessId,
          toResourceBusinessId: placement.resourceBusinessId,
        });
      }
      return;
    }
    if (this.callbacks.onEventUpdate) {
      this.callbacks.onEventUpdate({
        type: "resize",
        trackIndex: locations.toTrackIndex,
        eventIndex: locations.toEventIndex,
        event,
        oldEvent: change.before.event,
      });
    }
  }


  /**
   * 严格排程导入：整批验证通过后单次原子发布；失败时零写入且旧态保持。
   * 输入必须携带业务身份；需要保留选择的增量刷新请改用 upsert/patch。
   */
  public loadScheduleData(data: ScheduleDataFormat): ScheduleResult<void> {
    if (this.destroyed) {
      return {
        ok: false,
        error: { code: "destroyed", message: "timeline instance is destroyed" },
      };
    }
    const result = this.scheduleDataService.loadScheduleData(data);
    if (!result.ok) {
      this.logger.error(
        `[schedule] loadScheduleData rejected (code=${result.error.code}${result.error.path ? `, path=${result.error.path}` : ""})`
      );
      this.setStatus(this.t("errorInvalidDataFormat"));
      return result;
    }
    // 整批权威替换：作废进行中的编辑事务与候选草稿（合法输入才失效）；
    // 在途操作交给协调器停表并标记 settled，晚到结果永不写回新数据集
    this.datasetEpoch += 1;
    this.commitCoordinator.invalidateOperations(this.editTransactions.handleDatasetReplaced());
    if (data.timeIndicatorPosition !== undefined) {
      this.setTimeIndicator(data.timeIndicatorPosition);
    }
    // 数据集缩水后旧 scrollY 可能越界：先收敛并发布在界内的视口快照
    this.adjustCanvasSize();
    this.notifyChange("data:load");
    this.setStatus(
      this.t("statusDataLoaded", { count: this.state.tracks.length })
    );
    return result;
  }

  /** 导出与内存隔离的严格快照；含无数值 id、选中态或运行时缓存。legacy 事件返回 missing_business_id */
  public exportScheduleData(): ScheduleResult<ScheduleDataFormat> {
    const result = this.scheduleDataService.exportScheduleData();
    if (!result.ok) {
      this.logger.error(
        `[schedule] exportScheduleData rejected (code=${result.error.code}${result.error.path ? `, path=${result.error.path}` : ""})`
      );
    }
    return result;
  }

  /** 按业务身份查询事件位置；返回与内存隔离的快照，未知身份返回 null */
  public getEventByBusinessId(businessId: BusinessId): ScheduleEventLocation | null {
    return this.scheduleDataService.getEventLocation(businessId);
  }

  /** 按业务身份查询资源；返回与内存隔离的轨道快照，未知身份返回 null */
  public getTrackByBusinessId(
    businessId: BusinessId
  ): { trackIndex: number; track: Track } | null {
    return this.scheduleDataService.getTrack(businessId);
  }

  /** 按业务身份合并式 patch；customData 顶层整体替换；不改写 id/businessId/duration */
  public updateEventByBusinessId(
    businessId: BusinessId,
    patch: ScheduleEventPatch
  ): ScheduleResult<void> {
    if (this.destroyed) {
      return {
        ok: false,
        error: { code: "destroyed", message: "timeline instance is destroyed" },
      };
    }
    const locked = this.lockedEditError(businessId);
    if (locked) return locked;
    const result = this.scheduleDataService.patchEvent(businessId, patch);
    if (!result.ok) {
      this.logger.error(
        `[schedule] updateEventByBusinessId rejected (code=${result.error.code}${result.error.path ? `, path=${result.error.path}` : ""})`
      );
      return result;
    }
    const { trackIndex, eventIndex, event, oldEvent } = result.value;
    this.notifyChange("events:update");
    this.setStatus(this.t("statusEventUpdated", { title: event.title }));
    if (this.callbacks.onEventUpdate) {
      this.callbacks.onEventUpdate({
        trackIndex,
        eventIndex,
        event: cloneEvent(event),
        oldEvent,
      });
    }
    return { ok: true, value: undefined };
  }

  /** 按业务身份的完整事件替换批次；整批验证通过后按序应用，重复身份幂等 */
  public upsertScheduleEvents(items: ScheduleEventUpsert[]): ScheduleResult<void> {
    // 批次中任一事件被编辑事务锁定 → 整批零写入
    if (!this.destroyed) {
      for (const item of Array.isArray(items) ? items : []) {
        if (
          item &&
          typeof item === "object" &&
          item.event &&
          item.event.businessId !== undefined &&
          this.editTransactions.hasTransaction(item.event.businessId)
        ) {
          const locked = this.lockedEditError(item.event.businessId);
          if (locked) return locked;
        }
      }
    }
    if (this.destroyed) {
      return {
        ok: false,
        error: { code: "destroyed", message: "timeline instance is destroyed" },
      };
    }
    // 外层已在批处理中时不嵌套 begin/end，避免提前终止用户批次
    const ownsBatch = !this.changeScheduler.batching;
    if (ownsBatch) this.beginChangeBatch();
    try {
      const result = this.scheduleDataService.upsertScheduleEvents(items);
      if (!result.ok) {
        this.logger.error(
          `[schedule] upsertScheduleEvents rejected (code=${result.error.code}${result.error.path ? `, path=${result.error.path}` : ""})`
        );
        return result;
      }
      // 全部应用完成后按最终状态重算索引，避免批内先应用的操作报告失效 index
      for (const op of result.value) {
        if (op.event.businessId === undefined) continue;
        const location = this.businessIdentityIndex.getEventLocation(op.event.businessId);
        if (location) {
          op.trackIndex = location.trackIndex;
          op.eventIndex = location.eventIndex;
        }
      }
      let lastTitle = "";
      for (const op of result.value) {
        lastTitle = op.event.title;
        if (op.kind === "insert") {
          this.notifyChange("events:add");
          if (this.callbacks.onEventAdd) {
            this.callbacks.onEventAdd({ trackIndex: op.trackIndex, event: cloneEvent(op.event) });
          }
        } else {
          this.notifyChange("events:update");
          if (this.callbacks.onEventUpdate) {
            this.callbacks.onEventUpdate({
              trackIndex: op.trackIndex,
              eventIndex: op.eventIndex,
              event: cloneEvent(op.event),
              oldEvent: op.oldEvent,
            });
          }
        }
      }
      if (lastTitle) {
        this.setStatus(this.t("statusEventUpdated", { title: lastTitle }));
      }
      return { ok: true, value: undefined };
    } finally {
      if (ownsBatch) this.endChangeBatch();
    }
  }

  /** 按业务身份删除；被选事件删除时清空相关交互指针，邻项删除不使选择漂移 */
  public deleteEventByBusinessId(businessId: BusinessId): ScheduleResult<void> {
    if (this.destroyed) {
      return {
        ok: false,
        error: { code: "destroyed", message: "timeline instance is destroyed" },
      };
    }
    const lockedDelete = this.lockedEditError(businessId);
    if (lockedDelete) return lockedDelete;
    const location = this.businessIdentityIndex.getEventLocation(businessId);
    if (!location) {
      this.logger.error("[schedule] deleteEventByBusinessId rejected (code=not_found)");
      return {
        ok: false,
        error: { code: "not_found", message: "no event with the given business id" },
      };
    }
    this.deleteEvent(location.trackIndex, location.eventIndex);
    return { ok: true, value: undefined };
  }

  /** 按业务身份高亮事件 */
  public highlightEventByBusinessId(businessId: BusinessId): ScheduleResult<void> {
    if (this.destroyed) {
      return {
        ok: false,
        error: { code: "destroyed", message: "timeline instance is destroyed" },
      };
    }
    const location = this.businessIdentityIndex.getEventLocation(businessId);
    if (!location) {
      this.logger.error("[schedule] highlightEventByBusinessId rejected (code=not_found)");
      return {
        ok: false,
        error: { code: "not_found", message: "no event with the given business id" },
      };
    }
    const highlighted = this.highlightEvent(location.trackIndex, location.eventIndex);
    if (!highlighted) {
      return {
        ok: false,
        error: { code: "not_found", message: "no event with the given business id" },
      };
    }
    return { ok: true, value: undefined };
  }

  /** 按业务身份更新资源元数据；customData 顶层整体替换 */
  public updateTrackByBusinessId(
    businessId: BusinessId,
    patch: { customData?: Record<string, unknown> }
  ): ScheduleResult<void> {
    if (this.destroyed) {
      return {
        ok: false,
        error: { code: "destroyed", message: "timeline instance is destroyed" },
      };
    }
    const result = this.scheduleDataService.updateTrackCustomData(businessId, patch);
    if (!result.ok) {
      this.logger.error(
        `[schedule] updateTrackByBusinessId rejected (code=${result.error.code}${result.error.path ? `, path=${result.error.path}` : ""})`
      );
      return result;
    }
    this.notifyChange("tracks:update");
    return { ok: true, value: undefined };
  }

  /** 交互层结构写路径（如跨轨道 splice）调用，保持业务身份索引一致 */
  public invalidateBusinessIndexTrack(trackIndex: number): void {
    this.businessIdentityIndex.markTrackDirty(trackIndex);
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
    // W3：被编辑事务锁定的事件禁止 split
    const lockedEvent = this.state.tracks[trackIndex]?.events[eventIndex];
    if (lockedEvent?.businessId !== undefined && this.editTransactions.hasTransaction(lockedEvent.businessId)) {
      return false;
    }
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
      // 业务身份只保留在第一段；第二段由业务经旧 updateEvent 的可选 businessId 重新赋值
      businessId: undefined,
      startTime: splitTime,
      duration: fixFloatPrecision(event.endTime - splitTime),
      endTime: fixFloatPrecision(event.endTime),
      title: `${event.title} (2)`,
    };
    track.events[eventIndex] = firstEvent;
    track.events.push(secondEvent);
    this.clearGuideLineCache();
    this.eventIndexManager.invalidateTrack(trackIndex);
    this.businessIdentityIndex.markTrackDirty(trackIndex);
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
    if (this.destroyed) return;
    this.renderManager.draw();
  }

  public setReadOnly(readOnly: boolean): void {
    this.config.readOnly = readOnly;
    if (readOnly) {
      // W3：切查看模式取消预览；已发出的保存继续结算（不假定服务器未写）
      if (this.editTransactions.active) {
        this.editTransactions.cancelAll("read-only mode enabled during preview");
      }
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

  public destroy(): Promise<void> {
    // W3：销毁立即作废全部编辑事务与计时器；此后任何 resolve 不写状态、不通知
    this.editTransactions.destroyAll();
    this.commitCoordinator.destroy();
    if (this.destroyPromise) return this.destroyPromise;
    this.destroyed = true;
    this.clearGuideLineCache();
    // 清除视口订阅与挂起通知，旧实例不再回调
    this.renderManager.getViewportManager().unsubscribeAll();
    this.interactionManager.destroy();
    this.renderManager.dispose();
    this.destroyPromise = this.pluginManager.destroy();
    this.setStatus(this.t("statusTimelineDestroyed"));
    return this.destroyPromise;
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
