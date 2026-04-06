//#region src/types/index.d.ts
interface TimelineColors {
  canvasBackground: string;
  timelineBackground: string;
  trackBackground: string;
  trackBackgroundSelected: string;
  trackBackgroundOdd?: string;
  trackBackgroundEven?: string;
  timelineText: string;
  timelineGrid: string;
  timelineSubGrid: string;
  trackText: string;
  eventColors: string[];
  eventText: string;
  eventBorder: string;
  eventBorderSelected: string;
  eventOverlay: string;
  dragPreviewValid: string;
  dragPreviewInvalid: string;
  dragPreviewBorderValid: string;
  dragPreviewBorderInvalid: string;
  timeIndicator: string;
  guideLine: string;
  guideLineLabel: string;
  dragTimeReferenceLine: string;
  dragTimeReferenceLabel: string;
  dragTimeReferenceLabelBackground: string;
  scrollbarTrack: string;
  scrollbarHandle: string;
  scrollbarHandleHover: string;
  scrollbarHandleHighlight: string;
  scrollbarBorder: string;
  contextMenuBackground: string;
  contextMenuBorder: string;
  contextMenuText: string;
  contextMenuHoverBackground: string;
  contextMenuHoverText: string;
  eventDurationLabel: string;
}
interface EventTextStyle {
  titleFontSize: number | "auto";
  timeFontSize: number | "auto";
  titleFontFamily: string;
  timeFontFamily: string;
  titleFontWeight: string;
  timeFontWeight: string;
  titleColor: string | null;
  timeColor: string | null;
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  titleOffsetY: number;
  timeOffsetY: number;
  showTitle: boolean;
  showTime: boolean;
  minHeightForTitle: number;
  minHeightForTime: number;
}
interface EventBlockStyle {
  borderRadius: number;
  enableSelectionGlow: boolean;
  selectionGlowBlur: number;
}
interface ContextMenuItem {
  type: string;
  name: string;
}
interface ContextMenuStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  padding: number;
  itemHeight: number;
  borderRadius: number;
  borderWidth: number;
  minWidth: number;
}
type TimelineLocale = "en" | "zh" | "zh-CN";
type TimelineMessageParams = Record<string, string | number>;
interface TimelineI18nMessages {
  statusReady: string;
  statusTrackAdded: string;
  statusAtLeastOneTrackRequired: string;
  statusTrackRemoved: string;
  statusEmptyTrackRemoved: string;
  statusEventUpdated: string;
  statusEventDeleted: string;
  statusDataLoaded: string;
  statusTimeIndicatorMoved: string;
  statusZoomChanged: string;
  statusAutoFit: string;
  statusAutoFitCappedWithPadding: string;
  statusAutoFitCappedContentShort: string;
  statusEndTimeUpdated: string;
  statusInvalidSplitPosition: string;
  statusEventSplit: string;
  statusReadOnlyModeEnabled: string;
  statusReadOnlyModeDisabled: string;
  statusEventHighlighted: string;
  statusHighlightCleared: string;
  statusTimelineDestroyed: string;
  statusDragging: string;
  statusAutoTrackAdded: string;
  statusEventPlaced: string;
  statusEventSelected: string;
  statusEventResizing: string;
  statusEventResized: string;
  statusReadOnlyEditDeleteBlocked: string;
  statusReadOnlySplitBlocked: string;
  statusHoverEventTimeRange: string;
  labelTrackName: string;
  labelDurationPrefix: string;
  contextMenuEdit: string;
  contextMenuDelete: string;
  contextMenuExport: string;
  overlayPerformanceMonitor: string;
  overlayFps: string;
  overlayLayerTimesMs: string;
  overlayCollecting: string;
  overlayLayerBackground: string;
  overlayLayerTracks: string;
  overlayLayerTimeline: string;
  overlayLayerGuideLines: string;
  overlayLayerIndicator: string;
  overlayLayerScrollbar: string;
  overlayLayerInteraction: string;
  overlayLayerOverlay: string;
  overlayLayerDragPreview: string;
  errorCanvasNotFound: string;
  errorCanvasContextUnavailable: string;
  errorTimeIndicatorInvalid: string;
  errorZoomLevelInvalid: string;
  errorZoomLevelOutOfRange: string;
  errorEndTimeInvalid: string;
  errorEndTimeNotAfterStart: string;
  warningEventsExceedEndTime: string;
  errorInvalidTrackIndex: string;
  errorInvalidTrackIndexWithValue: string;
  errorInvalidEventIndex: string;
  errorInvalidEventIndexWithValue: string;
  errorInvalidDataFormat: string;
  errorInvalidTimeRange: string;
  errorStartTimeBeforeMin: string;
  errorRenderLayer: string;
  errorCoreLayerHook: string;
  errorPluginDependenciesMissing: string;
  errorPluginLoadFailed: string;
  errorPluginLifecycleFailed: string;
  errorPluginEventFailed: string;
  errorPluginValidationFailed: string;
  warningInvalidDraggingState: string;
  warningDraggingEventMissing: string;
  warningUnknownChangeType: string;
  warningAlreadyInBatchMode: string;
  warningNotInBatchMode: string;
  warningEmptyHtmlTemplateFallback: string;
  warningEmptyTooltipTemplateFallback: string;
}
interface TimelineConfig {
  canvasHeight?: number;
  timelineHeight: number;
  trackHeight: number;
  trackMargin: number;
  firstTrackTopMargin: number;
  secondWidth: number;
  startTime: number;
  endTime: number;
  startPaddingTime: number;
  endPaddingTime: number;
  autoFitOnInit: boolean;
  minAutoFitZoom: number;
  maxAutoFitZoom: number;
  timeUnit: string;
  timeFormat: string;
  snapInterval: number;
  snapToSeconds: boolean;
  secondPrecisionZoomThreshold: number;
  timeIndicatorWidth: number;
  timeIndicatorSnapThreshold: number;
  timeIndicatorHeadSize: number;
  timeIndicatorTriangleHeight: number;
  edgeScrollThrottle: number;
  edgeScrollTriggerMargin: number;
  edgeScrollViewportMargin: number;
  guideLineSnapThreshold: number;
  enableTimeIndicator: boolean;
  enableEventResize: boolean;
  enableEventSplit: boolean;
  enableContextMenu: boolean;
  resizeHandleWidth: number;
  minEventDuration: number;
  debug: boolean;
  enablePerformanceMonitor: boolean;
  autoAddTrack: boolean;
  autoRemoveEmptyLastTrack: boolean;
  readOnly: boolean;
  showEventDurationLabel: boolean;
  eventDurationPrefix: string;
  formatEventDuration: ((duration: number) => string) | null;
  /** 主刻度时间间隔（秒），>0。设置后启用自定义刻度模式 */
  scale: number | null;
  /** 每个主刻度之间的细分数，>0 整数 */
  scaleSplitCount: number;
  /** 自定义刻度标签渲染回调，参数为该刻度对应的时间（秒） */
  getScaleRender: ((time: number) => string) | null;
  eventTextStyle: EventTextStyle;
  eventBlockStyle: EventBlockStyle;
  colors: TimelineColors;
  contextMenuItems: ContextMenuItem[];
  contextMenuStyle: ContextMenuStyle;
  contextMenuHtml?: string | HTMLElement;
  locale: TimelineLocale;
  messages: TimelineI18nMessages;
}
interface TimelineCallbacks {
  onEventAdd?: ((data: EventAddData) => void) | null;
  onEventUpdate?: ((data: EventUpdateData) => void) | null;
  onEventDelete?: ((data: EventDeleteData) => void) | null;
  onEventMove?: ((data: EventMoveData) => void) | null;
  onEventClick?: ((data: EventClickData) => void) | null;
  onEventEdit?: ((data: EventEditData) => void) | null;
  onContextMenu?: ((data: ContextMenuData) => void) | null;
  onTrackAdd?: ((track: Track) => void) | null;
  onTrackRemove?: ((track: Track) => void) | null;
  onTimeIndicatorMove?: ((data: TimeIndicatorMoveData) => void) | null;
  onZoom?: ((data: ZoomData) => void) | null;
  onStatusChange?: ((statusText: string) => void) | null;
  onEventHighlight?: ((data: EventHighlightData) => void) | null;
  onTimeIndicatorHighlight?: ((data: TimeIndicatorHighlightData) => void) | null;
}
interface TimelineEvent {
  id: number;
  startTime: number;
  endTime: number;
  duration: number;
  title: string;
  description: string;
  color: string;
  readonly?: boolean;
  customData?: Record<string, unknown>;
  media?: {
    images?: Array<{
      src: string;
      fit?: "cover" | "contain" | "stretch";
      opacity?: number;
    }>;
    waveform?: {
      data: Float32Array | number[];
      color?: string;
      backgroundColor?: string;
      opacity?: number;
    };
  };
}
interface Track {
  id: number;
  events: TimelineEvent[];
}
interface SelectedEvent {
  trackIndex: number;
  eventIndex: number;
}
interface DraggingEvent {
  trackIndex: number;
  eventIndex: number;
  eventX: number;
  eventY: number;
  originalTrackIndex: number;
  originalEventIndex: number;
  originalStartTime: number;
  startX: number;
  startY: number;
  isDragging: boolean;
  currentMouseX?: number;
  currentMouseY?: number;
  canMove?: boolean;
}
interface ResizingEvent {
  trackIndex: number;
  eventIndex: number;
  edge: "left" | "right";
  startX: number;
  originalStartTime: number;
  originalDuration: number;
}
interface GuideLine {
  time: number;
  type: "start" | "end";
  trackIndices: number[];
}
interface HoveredResizeHandle {
  trackIndex: number;
  eventIndex: number;
  edge: "left" | "right";
}
interface HoveredSplitLine {
  trackIndex: number;
  eventIndex: number;
  splitTime: number;
}
/**
 * 统一命中：一次查询同时返回 resize handle 和事件体的命中信息
 */
interface InteractionTarget {
  /** 鼠标所在的轨道索引，若不在任何轨道上则为 null */
  trackIndex: number | null;
  /** 命中的事件索引（z-order 最高），若未命中任何事件则为 null */
  eventIndex: number | null;
  /** 若命中了 resize handle，标识是左边还是右边；否则为 null */
  resizeEdge: "left" | "right" | null;
}
interface ContextMenuEvent {
  trackIndex: number;
  eventIndex: number;
}
interface ContextMenuData {
  menuType: string;
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
}
interface TimelineState {
  tracks: Track[];
  selectedTrack: number | null;
  selectedEvent: SelectedEvent | null;
  highlightedEvent: SelectedEvent | null;
  draggingEvent: DraggingEvent | null;
  dragOffsetX: number;
  dragOffsetY: number;
  resizingEvent: ResizingEvent | null;
  draggingTimeIndicator: boolean;
  timeIndicatorDragOffsetX: number;
  draggingScrollbar: boolean;
  scrollbarDragOffset: number;
  draggingHorizontalScrollbar: boolean;
  horizontalScrollbarDragOffset: number;
  zoomLevel: number;
  scrollX: number;
  scrollY: number;
  snapEnabled: boolean;
  timeIndicatorSnapEnabled: boolean;
  contextMenuEvent: ContextMenuEvent | null;
  contextMenuVisible: boolean;
  contextMenuX: number;
  contextMenuY: number;
  hoveredContextMenuItem: number;
  timeIndicatorPosition: number;
  timeIndicatorHighlightedEvents: SelectedEvent[];
  isManualSelection: boolean;
  guideLines: GuideLine[];
  dragTimeReference: {
    time: number;
    y: number;
  } | null;
  hoveredResizeHandle: HoveredResizeHandle | null;
  lastClickTime: number;
  lastClickEvent: SelectedEvent | null;
  hoveredSplitLine: HoveredSplitLine | null;
  statusText: string;
  contextMenuBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    itemHeight: number;
    padding: number;
  } | null;
  lastDrawTime: number;
}
interface EventAddData {
  trackIndex: number;
  event: TimelineEvent;
}
interface EventEditData {
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  trackName: string;
  formattedTimeRange: string;
}
interface EventUpdateData {
  type?: "resize" | "split";
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  oldEvent?: TimelineEvent;
  firstEvent?: TimelineEvent;
  secondEvent?: TimelineEvent;
}
interface EventDeleteData {
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
}
interface EventMoveData {
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  fromTrackIndex: number;
}
interface EventClickData {
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  trackName: string;
  formattedTimeRange: string;
}
interface TimeIndicatorMoveData {
  position: number;
  time: string;
}
interface ZoomData {
  zoomLevel: number;
  percentage: number;
}
interface EventHighlightData {
  trackIndex: number | null;
  eventIndex: number | null;
  event: TimelineEvent | null;
}
interface TimeIndicatorHighlightData {
  position: number;
  highlightedEvents: Array<{
    trackIndex: number;
    eventIndex: number;
    event: TimelineEvent;
  }>;
}
interface LoadDataFormat {
  timeIndicatorPosition?: number;
  tracks: Array<{
    events: Array<{
      startTime?: number;
      endTime?: number;
      duration?: number;
      title: string;
      description?: string;
      color?: string;
      readonly?: boolean;
      customData?: Record<string, unknown>;
      media?: {
        images?: Array<{
          src: string;
          fit?: "cover" | "contain" | "stretch";
          opacity?: number;
        }>;
        waveform?: {
          data: Float32Array | number[];
          color?: string;
          backgroundColor?: string;
          opacity?: number;
        };
      };
    }>;
  }>;
}
interface TimelineOptions {
  canvasHeight?: number;
  locale?: TimelineLocale;
  messages?: Partial<TimelineI18nMessages>;
  startTime?: number;
  endTime?: number;
  startPaddingTime?: number;
  endPaddingTime?: number;
  secondWidth?: number;
  autoFitOnInit?: boolean;
  minAutoFitZoom?: number;
  maxAutoFitZoom?: number;
  trackHeight?: number;
  trackMargin?: number;
  firstTrackTopMargin?: number;
  timelineHeight?: number;
  snapInterval?: number;
  snapToSeconds?: boolean;
  secondPrecisionZoomThreshold?: number;
  enableTimeIndicator?: boolean;
  edgeScrollThrottle?: number;
  edgeScrollTriggerMargin?: number;
  edgeScrollViewportMargin?: number;
  enableEventResize?: boolean;
  enableEventSplit?: boolean;
  enableContextMenu?: boolean;
  minEventDuration?: number;
  resizeHandleWidth?: number;
  debug?: boolean;
  enablePerformanceMonitor?: boolean;
  autoAddTrack?: boolean;
  autoRemoveEmptyLastTrack?: boolean;
  readOnly?: boolean;
  showEventDurationLabel?: boolean;
  eventDurationPrefix?: string;
  formatEventDuration?: (duration: number) => string;
  /** 主刻度时间间隔（秒），>0。设置后启用自定义刻度模式 */
  scale?: number;
  /** 每个主刻度之间的细分数，>0 整数 */
  scaleSplitCount?: number;
  /** 自定义刻度标签渲染回调，参数为该刻度对应的时间（秒） */
  getScaleRender?: (time: number) => string;
  eventTextStyle?: Partial<EventTextStyle>;
  eventBlockStyle?: Partial<EventBlockStyle>;
  colors?: Partial<TimelineColors>;
  contextMenuItems?: ContextMenuItem[];
  contextMenuStyle?: Partial<ContextMenuStyle>;
  contextMenuHtml?: string | HTMLElement;
  theme?: TimelinePlugin;
  onEventAdd?: (data: EventAddData) => void;
  onEventUpdate?: (data: EventUpdateData) => void;
  onEventDelete?: (data: EventDeleteData) => void;
  onEventMove?: (data: EventMoveData) => void;
  onEventClick?: (data: EventClickData) => void;
  onEventEdit?: (data: EventEditData) => void;
  onContextMenu?: (data: ContextMenuData) => void;
  onTrackAdd?: (track: Track) => void;
  onTrackRemove?: (track: Track) => void;
  onTimeIndicatorMove?: (data: TimeIndicatorMoveData) => void;
  onZoom?: (data: ZoomData) => void;
  onStatusChange?: (statusText: string) => void;
  onEventHighlight?: (data: EventHighlightData) => void;
  onTimeIndicatorHighlight?: (data: TimeIndicatorHighlightData) => void;
}
declare global {
  interface CanvasRenderingContext2D {
    roundRect?: (x: number, y: number, w: number, h: number, radii: number | [number, number, number, number]) => void;
  }
}
//#endregion
//#region src/utils/time.d.ts
declare function formatTime(seconds: number, showSeconds?: boolean): string;
declare function getCurrentTime(): number;
//#endregion
//#region src/utils/i18n.d.ts
type TimelineMessageKey = keyof TimelineI18nMessages;
declare function createTimelineMessages(locale?: string, overrides?: Partial<TimelineI18nMessages>): TimelineI18nMessages;
//#endregion
//#region src/utils/performanceMonitor.d.ts
interface PerformanceStats {
  average: number;
  min: number;
  max: number;
  count: number;
  total: number;
}
//#endregion
//#region src/core/managers/ChangeScheduler.d.ts
/**
 * 状态变更类型
 */
type ChangeType = "events:add" | "events:update" | "events:delete" | "events:move" | "events:split" | "tracks:add" | "tracks:remove" | "timeIndicator:move" | "timeIndicator:drag" | "scroll:x" | "scroll:y" | "zoom:change" | "selection:change" | "highlight:change" | "canvas:resize" | "data:load" | "theme:change" | "interaction:hover" | "interaction:contextMenu" | "interaction:splitLine" | "config:debug" | "config:timeIndicator" | "config:endTime" | "config:readOnly";
//#endregion
//#region src/core/Timeline.d.ts
declare class Timeline {
  private canvas;
  private ctx;
  config: TimelineConfig;
  callbacks: TimelineCallbacks;
  state: TimelineState;
  private mouseHandler;
  private wheelHandler;
  private renderManager;
  private eventListeners;
  private pluginManager;
  private logger;
  private errorHandler;
  private stateManager;
  private eventIndexManager;
  private eventMutationService;
  private guideLineService;
  private hitTestService;
  private changeScheduler;
  private currentThemePluginId;
  constructor(canvasId: string, options?: TimelineOptions);
  getCanvas(): HTMLCanvasElement;
  usePlugin(plugin: TimelinePlugin): Promise<boolean>;
  getLoadedPlugins(): TimelinePlugin[];
  isPluginLoaded(pluginName: string): boolean;
  removePlugin(pluginId: string): Promise<boolean>;
  setTheme(theme: "light" | "dark"): Promise<boolean>;
  private switchTheme;
  private init;
  getContentWidthForZoom(zoomLevel: number): number;
  hasHorizontalScrollbar(): boolean;
  getAvailableHeight(): number;
  /**
   * 通知状态变更，由调度器自动处理脏层标记、派生状态计算和回调触发
   */
  notifyChange(change: ChangeType): void;
  /**
   * 开始批量变更操作
   */
  beginChangeBatch(): void;
  /**
   * 结束批量变更操作
   */
  endChangeBatch(): void;
  setDebug(enabled: boolean): void;
  setEnableTimeIndicator(enabled: boolean): void;
  markDirty(layers: Array<"background" | "tracks" | "timeline" | "guideLines" | "indicator" | "scrollbar" | "overlay" | "interaction">): void;
  getLastLayerTimes(): Record<string, number>;
  beginIndexBatch(): void;
  endIndexBatch(): void;
  invalidateIndexTrack(trackIndex: number): void;
  invalidateIndexAll(): void;
  private autoFitZoomToCanvas;
  private setupEventListeners;
  private setInitialCanvasSize;
  setCanvasSize(width: number, height: number): void;
  getCanvasLogicalHeight(): number;
  getCachedLogicalHeight(): number;
  adjustCanvasSize(): void;
  addTrack(): void;
  removeTrack(): void;
  autoRemoveEmptyLastTrack(): void;
  addEvent(trackIndex: number, startTime: number, endTime: number, title: string, description?: string, customData?: Record<string, unknown>, readonly?: boolean): void;
  updateEvent(trackIndex: number, eventIndex: number, updates: Partial<TimelineEvent>): boolean;
  updateEventData(trackIndex: number, eventIndex: number, eventData: {
    title?: string;
    startTime?: number;
    duration?: number;
    description?: string;
  }): boolean;
  deleteEvent(trackIndex: number, eventIndex: number): boolean;
  loadData(data: LoadDataFormat): boolean;
  setTimeIndicator(seconds: number, applySnap?: boolean): boolean;
  /**
   * 拖拽过程中的轻量时间指示器更新
   *
   * 与 setTimeIndicator 的区别：
   * - 触发 "timeIndicator:drag" 而非 "timeIndicator:move"（不触发 onTimeIndicatorMove / emitTimeIndicatorHighlight 回调）
   * - 不调用 setStatus
   * - 使用节流的边界滚动而非每帧滚动
   */
  setTimeIndicatorDuringDrag(seconds: number): void;
  private _lastEdgeScrollTime;
  private scrollToTimeIndicatorThrottled;
  private scrollToTimeIndicator;
  zoom(factor: number): void;
  setZoomLevel(zoomLevel: number): boolean;
  getZoomLevel(): number;
  setEndTime(endTime: number): boolean;
  getEndTime(): number;
  formatTime(seconds: number): string;
  t(key: TimelineMessageKey, params?: TimelineMessageParams): string;
  setStatus(text: string): void;
  getStatus(): string;
  /**
   * 统一命中：一次查询同时检测 resize handle 和事件体命中
   * 内部使用 O(n) max-scan 代替排序，降低 CPU 开销
   * @param canvasX 画布坐标 X（不含 scroll 偏移）
   * @param canvasY 画布坐标 Y（不含 scroll 偏移）
   */
  getInteractionTarget(canvasX: number, canvasY: number): InteractionTarget;
  getEventAtPosition(x: number, y: number): {
    trackIndex: number;
    eventIndex: number;
  } | null;
  getResizeHandle(x: number, y: number): {
    trackIndex: number;
    eventIndex: number;
    edge: "left" | "right";
  } | null;
  private getEdgeScrollThrottle;
  private getEdgeScrollTriggerMargin;
  private getEdgeScrollViewportMargin;
  private resolveEdgeScrollValue;
  calculateGuideLines(fromTrackIndex: number, eventIndex: number, toTrackIndex: number, newStartTime: number, duration: number): Array<{
    time: number;
    type: "start" | "end";
    trackIndices: number[];
  }>;
  snapToGuideLines(newStartTime: number, duration: number): number | null;
  /**
   * Resize 边缘辅助线吸附 - 仅检查单侧边缘
   * @param edgeTime 正在调整的边缘时间（左边缘的 startTime 或右边缘的 endTime）
   * @returns 吸附后的边缘时间，或 null
   */
  snapEdgeToGuideLines(edgeTime: number): number | null;
  canMoveEvent(fromTrackIndex: number, fromEventIndex: number, toTrackIndex: number, newStartTime: number, duration: number): boolean;
  showSplitLine(trackIndex: number, eventIndex: number, splitTime: number): void;
  hideSplitLine(): void;
  splitEvent(trackIndex: number, eventIndex: number, splitTime: number): boolean;
  draw(): void;
  setReadOnly(readOnly: boolean): void;
  highlightEvent(trackIndex: number, eventIndex: number): boolean;
  clearHighlight(): void;
  getHighlightedEvent(): {
    trackIndex: number;
    eventIndex: number;
  } | null;
  isReadOnly(): boolean;
  destroy(): void;
  private clearGuideLineCache;
  private getPluginId;
  private isThemePlugin;
  private redrawAfterPluginChange;
}
//#endregion
//#region src/plugins/types.d.ts
type PluginLocalizedText = Partial<Record<TimelineLocale, string>>;
declare enum PluginType {
  RENDER = "render",
  EVENT_HANDLER = "event_handler",
  DATA_SOURCE = "data_source",
  THEME = "theme",
  TOOL = "tool",
  EXTENSION = "extension"
}
declare enum PluginPriority {
  LOW = 0,
  NORMAL = 50,
  HIGH = 100,
  CRITICAL = 200
}
interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  descriptionI18n?: PluginLocalizedText;
  author?: string;
  type: PluginType;
  priority?: PluginPriority;
  dependencies?: string[];
}
type RenderLayerPosition = "background" | "overlay";
interface RenderLayer {
  name: string;
  position: RenderLayerPosition;
  render: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, config: TimelineConfig, state: TimelineState) => void;
}
/**
 * 可被插件钩子拦截的核心渲染层
 */
type CoreRenderTarget = "tracks" | "timeline" | "guideLines" | "indicator" | "scrollbar" | "interaction";
/**
 * 核心层钩子 — 允许插件拦截、修改或替换核心渲染层的行为
 *
 * `handler` 中调用 `next()` 执行默认渲染，不调用则完全替换默认行为。
 * 多个钩子按注册顺序形成中间件链。
 *
 * @example
 * ```ts
 * // 修改轨道渲染：添加自定义背景后执行默认渲染
 * registerCoreLayerHook({
 *   name: "custom-track-bg",
 *   target: "tracks",
 *   handler(ctx, canvas, config, state, next) {
 *     ctx.save();
 *     ctx.fillStyle = "rgba(0,0,255,0.05)";
 *     ctx.fillRect(0, 0, canvas.width, canvas.height);
 *     ctx.restore();
 *     next(); // 执行默认轨道渲染
 *   }
 * });
 *
 * // 完全替换时间轴刻度渲染
 * registerCoreLayerHook({
 *   name: "custom-timeline",
 *   target: "timeline",
 *   handler(ctx, canvas, config, state, _next) {
 *     // 不调用 next()，完全自定义绘制
 *     drawMyCustomTimeline(ctx, canvas, config, state);
 *   }
 * });
 * ```
 */
interface CoreLayerHook {
  /** 钩子名称，唯一标识 */
  name: string;
  /** 目标核心渲染层 */
  target: CoreRenderTarget;
  /** 钩子处理函数 */
  handler: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, config: TimelineConfig, state: TimelineState, next: () => void) => void;
}
type PluginEventHandler = (...args: unknown[]) => unknown;
interface PluginAPI {
  registerRenderLayer: (layer: RenderLayer) => void;
  unregisterRenderLayer: (name: string) => void;
  registerCoreLayerHook: (hook: CoreLayerHook) => void;
  unregisterCoreLayerHook: (name: string) => void;
  registerEventHandler: (event: string, handler: PluginEventHandler) => void;
  unregisterEventHandler: (event: string, handler: PluginEventHandler) => void;
  showNotification: (message: string, type?: "info" | "warning" | "error") => void;
  getData: (key: string) => unknown;
  setData: (key: string, value: unknown) => void;
  setPerformanceProvider: (provider: PerformanceProvider) => void;
  getPerformanceStats: () => Map<string, PerformanceStats>;
  getFPS: () => number;
}
interface PluginContext {
  timeline: Timeline;
  config: TimelineConfig;
  state: TimelineState;
  api: PluginAPI;
}
interface TimelinePlugin {
  metadata: PluginMetadata;
  init?: (context: PluginContext) => Promise<void> | void;
  activate?: (context: PluginContext) => Promise<void> | void;
  deactivate?: (context: PluginContext) => Promise<void> | void;
  destroy?: (context: PluginContext) => Promise<void> | void;
}
interface PerformanceProvider {
  startMeasurement: (name: string) => void;
  endMeasurement: (name: string) => void;
  getAllStats: () => Map<string, PerformanceStats>;
  getFPS: () => number;
}
//#endregion
export { TimelineCallbacks as A, ZoomData as B, EventEditData as C, InteractionTarget as D, EventUpdateData as E, TimelineLocale as F, TimelineMessageParams as I, TimelineOptions as L, TimelineConfig as M, TimelineEvent as N, LoadDataFormat as O, TimelineI18nMessages as P, TimelineState as R, EventDeleteData as S, EventTextStyle as T, ContextMenuData as _, PluginLocalizedText as a, EventAddData as b, PluginType as c, TimelinePlugin as d, Timeline as f, getCurrentTime as g, formatTime as h, PluginContext as i, TimelineColors as j, TimeIndicatorMoveData as k, RenderLayer as l, createTimelineMessages as m, CoreRenderTarget as n, PluginMetadata as o, ChangeType as p, PluginAPI as r, PluginPriority as s, CoreLayerHook as t, RenderLayerPosition as u, ContextMenuItem as v, EventMoveData as w, EventClickData as x, ContextMenuStyle as y, Track as z };