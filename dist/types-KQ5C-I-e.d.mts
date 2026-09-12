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
  /** 分钟吸附间隔；仅在关闭秒级吸附且未设置自定义刻度时使用 */
  snapInterval: number;
  /** 开启后在任意缩放级别按 1 秒吸附，优先于自定义刻度 */
  snapToSeconds: boolean;
  /** 仅在关闭秒级吸附时控制自定义刻度从主刻度切换为细分刻度 */
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
  /** 统一事件内容绘制入口（由 TimelineOptions 传入） */
  renderEventContent?: (context: EventContentRenderContext) => void;
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
  /** 可选业务身份；string 按原值比较，number 必须 finite；实例内事件唯一 */
  businessId?: BusinessId;
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
  /** 可选业务身份；实例内资源唯一，可与事件业务 ID 同名（独立命名空间） */
  businessId?: BusinessId;
  /** 资源元数据（名称/状态/利用率等），随数据一起导出 */
  customData?: Record<string, unknown>;
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
  /** M2：动作开始时的事件快照（legacy 回调扩展） */
  oldEvent?: TimelineEvent;
  /** M2：手势开始时的事件业务身份；索引漂移检测用 */
  originBusinessId?: BusinessId;
}
interface ResizingEvent {
  trackIndex: number;
  eventIndex: number;
  edge: "left" | "right";
  startX: number;
  originalStartTime: number;
  originalDuration: number;
  /** M2：动作开始时的事件快照（legacy 回调扩展） */
  oldEvent?: TimelineEvent;
  /** M2：手势开始时的事件业务身份；索引漂移检测用 */
  originBusinessId?: BusinessId;
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
  /** M2 编辑协议：进行中的候选草稿投影（businessId → draft）；非确认事实 */
  editDrafts: Map<BusinessId, ScheduleEditDraft>;
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
  /** M2：动作开始时的事件快照（新协议确认后回调同样附带） */
  oldEvent?: TimelineEvent;
  /** M2：源/目标资源业务身份 */
  fromResourceBusinessId?: BusinessId;
  toResourceBusinessId?: BusinessId;
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
    businessId?: BusinessId;
    customData?: Record<string, unknown>;
    events: Array<{
      businessId?: BusinessId;
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
/**
 * 业务身份：string 按原值比较（不 trim/normalize），number 必须 finite。
 * `1` 与 `"1"` 是不同身份；数值 `-0` 与 `0` 按 JS 数值相等规则视为同一身份。
 */
type BusinessId = string | number;
type ScheduleErrorCode = "invalid_input" | "duplicate_business_id" | "not_found" | "missing_business_id" | "destroyed" | "busy" | "reconciliation_required" | "invalid_server_result" | "stale_operation";
interface ScheduleError {
  code: ScheduleErrorCode;
  /** 指向输入中出错字段的路径，如 `tracks[0].events[2].startTime` */
  path?: string;
  message: string;
}
type ScheduleResult<T> = {
  ok: true;
  value: T;
} | {
  ok: false;
  error: ScheduleError;
};
interface ScheduleEventInput {
  businessId: BusinessId;
  startTime: number;
  endTime: number;
  title: string;
  description?: string;
  color?: string;
  readonly?: boolean;
  customData?: Record<string, unknown>;
  media?: TimelineEvent["media"];
}
/** patch 不允许改写 id/businessId/duration；起止取合并后的值验证 */
type ScheduleEventPatch = Partial<Omit<ScheduleEventInput, "businessId">>;
interface ScheduleTrackInput {
  businessId: BusinessId;
  customData?: Record<string, unknown>;
  events: ScheduleEventInput[];
}
interface ScheduleDataFormat {
  tracks: ScheduleTrackInput[];
  timeIndicatorPosition?: number;
}
interface ScheduleEventLocation {
  trackIndex: number;
  eventIndex: number;
  resourceBusinessId: BusinessId;
  /** 与内存隔离的快照；customData 深拷贝，waveform.data 保留引用（大媒体复制策略见文档） */
  event: TimelineEvent;
}
interface ScheduleEventUpsert {
  resourceBusinessId: BusinessId;
  event: ScheduleEventInput;
}
/** 统一内容绘制的阶段：普通显示 / 拖动预览 / 拉伸 */
type EventContentPhase = "normal" | "drag" | "resize";
/** 以 Canvas 左上角为原点的 CSS px 矩形（已扣 scrollX/Y） */
interface EventContentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
/**
 * TimelineOptions.renderEventContent 的绘制上下文。
 * rect 为事件块完整矩形（含 eventVerticalPadding，宽度=duration*secondWidth*zoomLevel）；
 * clipRect 为事件内容与可绘制视口的交集（排除固定时间轴与滚动条区域）。
 * drawDefaultContent 在一次调用中至多执行一次；所有数据只读。
 */
interface EventContentRenderContext {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  config: TimelineConfig;
  state: TimelineState;
  event: TimelineEvent;
  track: Track;
  trackIndex: number;
  eventIndex: number;
  rect: EventContentRect;
  clipRect: EventContentRect;
  phase: EventContentPhase;
  selected: boolean;
  highlighted: boolean;
  readonly: boolean;
  dpr: number;
  drawDefaultContent: () => void;
  /** M2：编辑协议下的提交状态（idle=无事务；preview=手势候选；pending=保存中；待核对） */
  commitState: "idle" | "preview" | "pending" | "reconciliation_required";
  /** M2：进行中的操作 id（仅非 idle 存在） */
  operationId?: string;
}
/** 视口快照：逻辑像素几何，读取与订阅通知使用同一份数据 */
interface TimelineViewportSnapshot {
  width: number;
  height: number;
  dpr: number;
  scrollX: number;
  scrollY: number;
  zoomLevel: number;
  trackHeight: number;
  trackMargin: number;
  timelineHeight: number;
  firstTrackTopMargin: number;
  contentRect: EventContentRect;
  /** 当前轨道总数；拖拽自动加轨等结构变化会体现在此字段 */
  trackCount: number;
  /** 可见行索引范围（含端点）；无轨道时为 null */
  visibleTrackRange: [number, number] | null;
  /** 仅在布局相关状态实际变化时递增 */
  revision: number;
}
interface TrackRect {
  businessId: BusinessId;
  trackIndex: number;
  /** 完整行矩形；已存在但完全离屏的行仍返回完整 rect */
  rect: EventContentRect;
  /** 与可绘制视口的交集；完全不可见时为 null */
  visibleRect: EventContentRect | null;
}
type ViewportListener = (snapshot: TimelineViewportSnapshot) => void;
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
  /** 分钟吸附间隔；仅在关闭秒级吸附且未设置自定义刻度时使用 */
  snapInterval?: number;
  /** 开启后在任意缩放级别按 1 秒吸附，优先于自定义刻度 */
  snapToSeconds?: boolean;
  /** 仅在关闭秒级吸附时控制自定义刻度从主刻度切换为细分刻度 */
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
  /** M2：可选排程编辑协议；配置时必须同时提供 onBeforeCommit */
  scheduleEditing?: ScheduleEditingOptions;
  /** M2：编辑提交状态变化回调（pending/accepted/rejected/cancelled/validation_failed/reconciliation_required/invalidated/reconciled） */
  onScheduleCommitStateChange?: (data: ScheduleCommitStateData) => void;
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
  /**
   * 统一事件内容绘制入口：普通/拖动/拉伸阶段的所有可见任务内容都经过此回调；
   * 未配置时使用核心默认内容绘制。绘制异常会以固定错误码记录并回退默认内容。
   */
  renderEventContent?: (context: EventContentRenderContext) => void;
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
/** 一次编辑后的目标位置（资源业务身份 + 起止秒） */
interface SchedulePlacement {
  resourceBusinessId: BusinessId;
  startTime: number;
  endTime: number;
}
/** 编辑快照：资源业务身份 + 事件快照（运行时深拷贝，与内部事实脱离引用） */
interface ScheduleEditSnapshot {
  resourceBusinessId: BusinessId;
  event: Readonly<TimelineEvent>;
}
/** 一次用户编辑意图：预览与提交沿用同一 operationId */
interface ScheduleChange {
  operationId: string;
  eventBusinessId: BusinessId;
  action: "move" | "resize";
  /** 仅 resize 存在；move 不得携带 */
  resizeEdge?: "left" | "right";
  before: ScheduleEditSnapshot;
  after: ScheduleEditSnapshot;
}
/** 同步业务校验结果：拒绝必须带稳定 code 与可展示 reason */
type ScheduleValidationResult = {
  allowed: true;
} | {
  allowed: false;
  code: string;
  reason: string;
};
/** 提交端结果：accepted 携带可选服务器修正；rejected 携带安全原因 */
type ScheduleCommitResult = {
  accepted: true;
  placement?: SchedulePlacement;
} | {
  accepted: false;
  code?: string;
  reason: string;
};
/** 排程编辑协议配置；onBeforeCommit 必填 */
interface ScheduleEditingOptions {
  /** 同步业务校验；返回 Promise/非法结构一律按 validation_error 拒绝 */
  validate?: (change: Readonly<ScheduleChange>) => ScheduleValidationResult;
  /** 唯一保存入口；同一操作只调用一次 */
  onBeforeCommit: (change: Readonly<ScheduleChange>, context: {
    signal: AbortSignal;
  }) => Promise<ScheduleCommitResult>;
  /** 客户端等待上限，默认 30000ms；有限正数且 ≤ 2147483647 */
  commitTimeoutMs?: number;
}
/** 单事件编辑状态查询结果；null 表示事件不存在 */
interface ScheduleEditState {
  state: "idle" | "preview" | "pending" | "reconciliation_required";
  operationId?: string;
  action?: "move" | "resize";
  /** pending/preview 的候选位置 */
  placement?: SchedulePlacement;
  /** reconciliation_required 的待核对原因码 */
  reasonCode?: string;
}
/** 提交结算状态种类 */
type ScheduleCommitStateKind = "pending" | "accepted" | "rejected" | "cancelled" | "validation_failed" | "reconciliation_required" | "invalidated" | "reconciled";
/** 提交状态变化通知（独立于旧成功回调，不是第二个保存入口） */
interface ScheduleCommitStateData {
  state: ScheduleCommitStateKind;
  operationId: string;
  eventBusinessId: BusinessId;
  action: "move" | "resize";
  before: ScheduleEditSnapshot;
  /** accepted 为服务器修正后的最终值；reconciled 且权威删除时为 null */
  after?: ScheduleEditSnapshot | null;
  /** 安全文本原因；核心不解释业务含义 */
  reason?: string;
  /** 核心固定错误码（readonly/busy/overlap/validation_error 等） */
  reasonCode?: string;
}
/** 渲染中的候选草稿投影（内存派生，不写入 tracks 事实） */
interface ScheduleEditDraft {
  operationId: string;
  eventBusinessId: BusinessId;
  sourceTrackIndex: number;
  targetTrackIndex: number;
  startTime: number;
  endTime: number;
  action: "move" | "resize";
  resizeEdge?: "left" | "right";
  /** 候选的提交状态：preview=手势候选预览；pending=保存中；reconciliation_required=待核对 */
  commitState: "preview" | "pending" | "reconciliation_required";
}
//#endregion
//#region src/utils/i18n.d.ts
type TimelineMessageKey = keyof TimelineI18nMessages;
type ResolvedTimelineLocale = Exclude<TimelineLocale, "zh">;
declare function normalizeTimelineLocale(locale?: string): ResolvedTimelineLocale;
declare function createTimelineMessages(locale?: string, overrides?: Partial<TimelineI18nMessages>): TimelineI18nMessages;
declare function translateTimelineMessage(messages: TimelineI18nMessages, key: TimelineMessageKey, params?: TimelineMessageParams): string;
declare function translateTimelineConfig(config: Pick<TimelineConfig, "locale" | "messages">, key: TimelineMessageKey, params?: TimelineMessageParams): string;
declare function createDefaultContextMenuItems(localeOrMessages?: string | TimelineI18nMessages, overrides?: Partial<TimelineI18nMessages>): ContextMenuItem[];
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
//#region src/core/managers/BusinessIdentityIndex.d.ts
interface BusinessEventLocation {
  trackIndex: number;
  eventIndex: number;
}
/**
 * 业务身份索引：`state.tracks` 的 derived projection。
 * 覆盖 load/add/update/delete/split/跨轨道/自动轨道等全部结构写路径；
 * 写路径只做失效标记（惰性重建），读取时同步收敛，避免拖动等热路径全量重建。
 * 全局 Map 提供按身份 O(1) 定位；按轨道的桶让单轨重建只需 O(轨道大小)。
 * 业务 ID 采用 Map（SameValueZero）：`1` 与 `"1"` 不同键，`-0` 与 `0` 同键。
 */
declare class BusinessIdentityIndex {
  private readonly state;
  private eventLocations;
  private trackIndices;
  private trackEventIds;
  private trackIdsByIndex;
  private dirtyTracks;
  private allDirty;
  constructor(state: TimelineState);
  markAllDirty(): void;
  markTrackDirty(trackIndex: number): void;
  getEventLocation(businessId: BusinessId): BusinessEventLocation | null;
  hasEvent(businessId: BusinessId): boolean;
  getTrackIndex(businessId: BusinessId): number | null;
  private sync;
  private rebuildAll;
  private rebuildTrack;
  private collectTrack;
}
//#endregion
//#region src/core/managers/EditTransactionController.d.ts
interface EditTransaction {
  operationId: string;
  eventBusinessId: BusinessId;
  action: "move" | "resize";
  resizeEdge?: "left" | "right";
  before: ScheduleEditSnapshot;
  beforeTrackIndex: number;
  beforeEventIndex: number;
  draft: SchedulePlacement;
  /** 最后一次候选评估是否有效；无效落点在提交时按 validation_failed 丢弃 */
  lastCandidateValid: boolean;
  state: "preview" | "pending" | "reconciliation_required";
  /** 待核对原因码（timeout/transport_error/invalid_response/reconciliation_required） */
  reasonCode?: string;
  abort: AbortController;
}
type EditBeginResult = {
  ok: true;
} | {
  ok: false;
  code: "busy" | "missing_business_id" | "inactive";
  reason: string;
};
/**
 * M2 编辑协议事务控制器：
 * 管理候选草稿投影（state.editDrafts）、before/after 快照与 operationId；
 * 提交端 Promise 的超时/结算/epoch 在 W3 由 ScheduleCommitCoordinator 承接。
 */
declare class EditTransactionController {
  private static instanceCounter;
  private readonly state;
  private readonly businessIdentityIndex;
  private readonly notify;
  private options;
  private readonly transactions;
  /** 由 ScheduleCommitCoordinator 接线：提交结果（null=未知） */
  commitSink: ((result: ScheduleCommitResult | null, change: ScheduleChange) => void) | null;
  private operationSeq;
  private readonly instanceSeq;
  constructor(state: TimelineState, businessIdentityIndex: BusinessIdentityIndex, notify: (data: ScheduleCommitStateData) => void);
  /** 构造期校验：非法配置必须在监听/观察器注册前抛出明确配置错误 */
  static validateOptions(options: ScheduleEditingOptions | undefined): void;
  configure(options: ScheduleEditingOptions): void;
  /** 未配置协议时所有编辑入口保持 legacy 同步语义 */
  get active(): boolean;
  /** 该事件是否存在进行中的事务（preview/pending） */
  hasActiveTransaction(businessId: BusinessId): boolean;
  /**
   * 动作开始（拖动/拉伸越阈值）时捕获 before 快照并登记预览事务。
   * 零快照失败安全：cloneEvent 不会抛错，但业务身份缺失/忙返回 typed 结果。
   */
  tryBegin(params: {
    event: TimelineEvent;
    trackIndex: number;
    eventIndex: number;
    action: "move" | "resize";
    resizeEdge?: "left" | "right";
  }): EditBeginResult;
  /** 更新候选位置；仅 preview 可更新，pending 期间事实与候选都冻结 */
  updateDraft(businessId: BusinessId, placement: SchedulePlacement, targetTrackIndex: number): void;
  /** 当前事务（若只要求未终态） */
  getTransaction(businessId: BusinessId): EditTransaction | undefined;
  /** 用最终候选构建 ScheduleChange（after 为独立快照） */
  buildChange(businessId: BusinessId): ScheduleChange | null;
  /** 记录最后一次候选评估无效：提交时丢弃编辑而不是隐式提交上一个有效位置 */
  markCandidateInvalid(businessId: BusinessId): void;
  /** 同步业务校验：Promise/抛错/非法结构一律 validation_error */
  runBusinessValidate(change: ScheduleChange): ScheduleValidationResult;
  /**
   * 提交入口：标记 pending、通知 pending、调用一次 onBeforeCommit。
   * 结算（accept/reject/unknown 发布）在 W3 ScheduleCommitCoordinator 实现；
   * W2 仅保证单次调用与 busy 互斥。
   */
  beginCommit(businessId: BusinessId, change: ScheduleChange): boolean;
  /** 同步业务校验拒绝/落点无效：丢弃候选并恢复（无请求发出） */
  cancelPreview(businessId: BusinessId, reason: string, code: string, state: "cancelled" | "validation_failed"): void;
  /**
   * 仅取消 preview 事务（pointercancel、只读切换）。
   * pending/reconciliation_required 代表"保存可能已到达服务器"，
   * 只能经明确拒绝结算、权威恢复（reconcile/整批 load）或 destroy 解除。
   */
  cancelAll(reason: string): void;
  /** 整批权威数据替换：作废全部预览与待定事务；在途操作 id 交协调器停表并标记 settled */
  handleDatasetReplaced(): string[];
  /** 提交结果未知：保留 before/候选预约与同任务锁，停止 pending，等待权威恢复 */
  enterReconciliation(businessId: BusinessId, reason: string, reasonCode: string): void;
  /** 接受结算：释放事务/草稿/预约；发布由调用方在释放前完成 */
  releaseForAccept(businessId: BusinessId): void;
  hasTransaction(businessId: BusinessId): boolean;
  /** 全部事务的 before/候选预约区间（排除指定事务自身） */
  getReservations(excludeBusinessId?: BusinessId): Array<{
    resourceBusinessId: BusinessId;
    startTime: number;
    endTime: number;
  }>;
  /** 实例销毁：清空全部事务与计时引用，不发任何通知（销毁后回调被抑制） */
  destroyAll(): void;
  /** 权威恢复入口使用：作废指定事务并清理草稿（不发成功类通知） */
  invalidateTransaction(businessId: BusinessId, reason: string): void;
  /** 提交端明确拒绝：移除候选与锁定，事实未变，不发旧成功回调 */
  rejectPending(businessId: BusinessId, reason: string, code?: string): void;
  /** 事件编辑状态查询；事件不存在返回 null */
  getEditState(businessId: BusinessId): ScheduleEditState | null;
  /** 草稿投影与事务表保持一致（预览期间渲染器读取 state.editDrafts） */
  private syncDraftProjection;
}
//#endregion
//#region src/core/managers/ChangeScheduler.d.ts
/**
 * 状态变更类型
 */
type ChangeType = "events:add" | "events:update" | "events:delete" | "events:move" | "events:split" | "tracks:add" | "tracks:update" | "tracks:remove" | "timeIndicator:move" | "timeIndicator:drag" | "scroll:x" | "scroll:y" | "zoom:change" | "selection:change" | "highlight:change" | "canvas:resize" | "data:load" | "theme:change" | "interaction:hover" | "interaction:contextMenu" | "interaction:splitLine" | "config:debug" | "config:timeIndicator" | "config:endTime" | "config:readOnly";
//#endregion
//#region src/core/Timeline.d.ts
declare class Timeline {
  private canvas;
  private ctx;
  config: TimelineConfig;
  callbacks: TimelineCallbacks;
  state: TimelineState;
  private renderManager;
  private canvasController;
  private interactionManager;
  private pluginManager;
  private pluginController;
  private logger;
  private errorHandler;
  private stateManager;
  private eventIndexManager;
  private businessIdentityIndex;
  private scheduleDataService;
  private eventMutationService;
  private trackManager;
  private timeIndicatorController;
  private viewportController;
  private guideLineService;
  private hitTestService;
  private changeScheduler;
  editTransactions: EditTransactionController;
  private commitCoordinator;
  /** M2：编辑提交状态变化回调（独立于旧成功回调） */
  onScheduleCommitStateChange: ((data: ScheduleCommitStateData) => void) | null;
  private destroyed;
  /** 数据集代数：整批权威替换（loadData/loadScheduleData）成功时自增，供提交协调器检测 accepted 通知内的重入刷新 */
  private datasetEpoch;
  private destroyPromise;
  constructor(canvasId: string, options?: TimelineOptions);
  getCanvas(): HTMLCanvasElement;
  usePlugin(plugin: TimelinePlugin): Promise<boolean>;
  getLoadedPlugins(): TimelinePlugin[];
  isPluginLoaded(pluginName: string): boolean;
  removePlugin(pluginId: string): Promise<boolean>;
  setTheme(theme: "light" | "dark"): Promise<boolean>;
  private init;
  getContentWidthForZoom(zoomLevel: number): number;
  hasHorizontalScrollbar(): boolean;
  getAvailableHeight(): number;
  /**
   * 通知状态变更，由调度器自动处理脏层标记、派生状态计算和回调触发
   */
  notifyChange(change: ChangeType): void;
  private static readonly VIEWPORT_RELEVANT_CHANGES;
  private viewportBatching;
  private handleViewportRelevantChange;
  /** 视口快照：逻辑像素几何；与订阅通知共享同一入口 */
  getViewport(): TimelineViewportSnapshot;
  /** 订阅视口变化：立即同步收到当前快照；返回幂等取消函数 */
  subscribeViewport(listener: ViewportListener): () => void;
  /** 按业务身份查询资源行几何；完全离屏的行仍返回完整 rect，未知身份返回 null */
  getTrackRectByBusinessId(businessId: BusinessId): TrackRect | null;
  /** 时间→X 坐标（CSS px）；不 clamp，视口外允许负值；非法输入返回 null */
  timeToX(time: number): number | null;
  /** X 坐标→时间；与 timeToX 互逆；非法输入返回 null */
  xToTime(x: number): number | null;
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
  private autoFitViewport;
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
  /** 事件被进行中的编辑事务锁定时的 typed 拒绝 */
  private lockedEditError;
  /** 查询事件当前的编辑事务状态；事件不存在返回 null */
  getScheduleEditState(id: BusinessId): ScheduleEditState | null;
  /**
   * 权威单事件恢复：以业务查询到的事实作废进行中的事务并原子替换/删除事件。
   * operationId 必须匹配当前事务；事务缺失/已终结返回 stale_operation（零写入）。
   */
  reconcileScheduleEvent(id: BusinessId, snapshot: {
    resourceBusinessId: BusinessId;
    event: ScheduleEventUpsert["event"];
  } | null, options: {
    operationId: string;
  }): ScheduleResult<void>;
  /**
   * 编辑候选的核心同步校验（typed）：只做本地约束，业务校验由
   * scheduleEditing.validate 在提交前单独执行，二者不允许互相替代。
   */
  validateScheduleEditCandidate(params: {
    eventBusinessId: BusinessId;
    fromTrackIndex: number;
    fromEventIndex: number;
    toTrackIndex: number;
    startTime: number;
    endTime: number;
  }, options?: {
    forPublish?: boolean;
  }): ScheduleValidationResult;
  /**
   * 落点提交：最终候选校验 → 业务 validate → 通知 pending → 调用一次 onBeforeCommit。
   * 返回 false 表示未发起提交（typed 原因已通过状态回调/状态文本给出）。
   */
  commitScheduleEdit(businessId: BusinessId): boolean;
  /** 接受结果的原子发布：身份/资源/时间/重叠（排除自身与预约）逐项校验后落盘 */
  private publishAcceptedPlacement;
  /** 旧成功回调：确认后发送一次（move→onEventMove / resize→onEventUpdate） */
  private fireLegacySuccessCallback;
  /**
   * 严格排程导入：整批验证通过后单次原子发布；失败时零写入且旧态保持。
   * 输入必须携带业务身份；需要保留选择的增量刷新请改用 upsert/patch。
   */
  loadScheduleData(data: ScheduleDataFormat): ScheduleResult<void>;
  /** 导出与内存隔离的严格快照；含无数值 id、选中态或运行时缓存。legacy 事件返回 missing_business_id */
  exportScheduleData(): ScheduleResult<ScheduleDataFormat>;
  /** 按业务身份查询事件位置；返回与内存隔离的快照，未知身份返回 null */
  getEventByBusinessId(businessId: BusinessId): ScheduleEventLocation | null;
  /** 按业务身份查询资源；返回与内存隔离的轨道快照，未知身份返回 null */
  getTrackByBusinessId(businessId: BusinessId): {
    trackIndex: number;
    track: Track;
  } | null;
  /** 按业务身份合并式 patch；customData 顶层整体替换；不改写 id/businessId/duration */
  updateEventByBusinessId(businessId: BusinessId, patch: ScheduleEventPatch): ScheduleResult<void>;
  /** 按业务身份的完整事件替换批次；整批验证通过后按序应用，重复身份幂等 */
  upsertScheduleEvents(items: ScheduleEventUpsert[]): ScheduleResult<void>;
  /** 按业务身份删除；被选事件删除时清空相关交互指针，邻项删除不使选择漂移 */
  deleteEventByBusinessId(businessId: BusinessId): ScheduleResult<void>;
  /** 按业务身份高亮事件 */
  highlightEventByBusinessId(businessId: BusinessId): ScheduleResult<void>;
  /** 按业务身份更新资源元数据；customData 顶层整体替换 */
  updateTrackByBusinessId(businessId: BusinessId, patch: {
    customData?: Record<string, unknown>;
  }): ScheduleResult<void>;
  /** 交互层结构写路径（如跨轨道 splice）调用，保持业务身份索引一致 */
  invalidateBusinessIndexTrack(trackIndex: number): void;
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
  destroy(): Promise<void>;
  private clearGuideLineCache;
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
/**
 * 已知插件事件的载荷 tuple（与内部 emitEvent 实参一一对应）。
 * 已知键使用精确类型注册/注销/发射；自定义字符串扩展仍走宽泛 unknown 边界。
 */
interface PluginEventMap {
  "render:event:media": [ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, config: TimelineConfig, state: TimelineState, trackIndex: number, eventIndex: number, eventX: number, trackY: number, eventWidth: number, eventVerticalPadding: number, eventHeight: number];
  "validate:event:move": [payload: {
    fromTrackIndex: number;
    fromEventIndex: number;
    toTrackIndex: number;
    newStartTime: number;
    duration: number;
  }];
}
interface PluginAPI {
  registerRenderLayer: (layer: RenderLayer) => void;
  unregisterRenderLayer: (name: string) => void;
  registerCoreLayerHook: (hook: CoreLayerHook) => void;
  unregisterCoreLayerHook: (name: string) => void;
  registerEventHandler: {
    <K extends keyof PluginEventMap & string>(event: K, handler: (...args: PluginEventMap[K]) => unknown): void;
    (event: string, handler: PluginEventHandler): void;
  };
  unregisterEventHandler: {
    <K extends keyof PluginEventMap & string>(event: K, handler: (...args: PluginEventMap[K]) => unknown): void;
    (event: string, handler: PluginEventHandler): void;
  };
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
export { ScheduleValidationResult as $, EventMoveData as A, ScheduleEditDraft as B, EventAddData as C, EventContentRenderContext as D, EventContentRect as E, ScheduleChange as F, ScheduleErrorCode as G, ScheduleEditState as H, ScheduleCommitResult as I, ScheduleEventPatch as J, ScheduleEventInput as K, ScheduleCommitStateData as L, EventUpdateData as M, InteractionTarget as N, EventDeleteData as O, LoadDataFormat as P, ScheduleTrackInput as Q, ScheduleCommitStateKind as R, ContextMenuStyle as S, EventContentPhase as T, ScheduleEditingOptions as U, ScheduleEditSnapshot as V, ScheduleError as W, SchedulePlacement as X, ScheduleEventUpsert as Y, ScheduleResult as Z, translateTimelineConfig as _, PluginLocalizedText as a, TimelineI18nMessages as at, ContextMenuData as b, PluginType as c, TimelineOptions as ct, TimelinePlugin as d, Track as dt, TimeIndicatorMoveData as et, Timeline as f, TrackRect as ft, normalizeTimelineLocale as g, createTimelineMessages as h, PluginContext as i, TimelineEvent as it, EventTextStyle as j, EventEditData as k, RenderLayer as l, TimelineState as lt, createDefaultContextMenuItems as m, ZoomData as mt, CoreRenderTarget as n, TimelineColors as nt, PluginMetadata as o, TimelineLocale as ot, ChangeType as p, ViewportListener as pt, ScheduleEventLocation as q, PluginAPI as r, TimelineConfig as rt, PluginPriority as s, TimelineMessageParams as st, CoreLayerHook as t, TimelineCallbacks as tt, RenderLayerPosition as u, TimelineViewportSnapshot as ut, translateTimelineMessage as v, EventClickData as w, ContextMenuItem as x, BusinessId as y, ScheduleDataFormat as z };