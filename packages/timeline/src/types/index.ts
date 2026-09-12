export interface TimelineColors {
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

export interface EventTextStyle {
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

export interface EventBlockStyle {
  borderRadius: number;
  enableSelectionGlow: boolean;
  selectionGlowBlur: number;
}

export interface ContextMenuItem {
  type: string;
  name: string;
}

export interface ContextMenuStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  padding: number;
  itemHeight: number;
  borderRadius: number;
  borderWidth: number;
  minWidth: number;
}

export type TimelineLocale = "en" | "zh" | "zh-CN";

export type TimelineMessageParams = Record<string, string | number>;

export interface TimelineI18nMessages {
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

export interface TimelineConfig {
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

export interface TimelineCallbacks {
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
  onTimeIndicatorHighlight?:
    | ((data: TimeIndicatorHighlightData) => void)
    | null;
}

export interface TimelineEvent {
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

export interface Track {
  id: number;
  /** 可选业务身份；实例内资源唯一，可与事件业务 ID 同名（独立命名空间） */
  businessId?: BusinessId;
  /** 资源元数据（名称/状态/利用率等），随数据一起导出 */
  customData?: Record<string, unknown>;
  events: TimelineEvent[];
}

export interface SelectedEvent {
  trackIndex: number;
  eventIndex: number;
}

export interface DraggingEvent {
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

export interface ResizingEvent {
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

export interface GuideLine {
  time: number;
  type: "start" | "end";
  trackIndices: number[];
}

export interface HoveredResizeHandle {
  trackIndex: number;
  eventIndex: number;
  edge: "left" | "right";
}

export interface HoveredSplitLine {
  trackIndex: number;
  eventIndex: number;
  splitTime: number;
}

/**
 * 统一命中：一次查询同时返回 resize handle 和事件体的命中信息
 */
export interface InteractionTarget {
  /** 鼠标所在的轨道索引，若不在任何轨道上则为 null */
  trackIndex: number | null;
  /** 命中的事件索引（z-order 最高），若未命中任何事件则为 null */
  eventIndex: number | null;
  /** 若命中了 resize handle，标识是左边还是右边；否则为 null */
  resizeEdge: "left" | "right" | null;
}

export interface ContextMenuEvent {
  trackIndex: number;
  eventIndex: number;
}

export interface ContextMenuData {
  menuType: string;
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
}

export interface TimelineState {
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
  dragTimeReference: { time: number; y: number } | null;
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

export interface EventAddData {
  trackIndex: number;
  event: TimelineEvent;
}

export interface EventEditData {
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  trackName: string;
  formattedTimeRange: string;
}

export interface EventUpdateData {
  type?: "resize" | "split";
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  oldEvent?: TimelineEvent;
  firstEvent?: TimelineEvent;
  secondEvent?: TimelineEvent;
}

export interface EventDeleteData {
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
}

export interface EventMoveData {
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

export interface EventClickData {
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  trackName: string;
  formattedTimeRange: string;
}

export interface TimeIndicatorMoveData {
  position: number;
  time: string;
}

export interface ZoomData {
  zoomLevel: number;
  percentage: number;
}

export interface EventHighlightData {
  trackIndex: number | null;
  eventIndex: number | null;
  event: TimelineEvent | null;
}

export interface TimeIndicatorHighlightData {
  position: number;
  highlightedEvents: Array<{
    trackIndex: number;
    eventIndex: number;
    event: TimelineEvent;
  }>;
}

export interface LoadDataFormat {
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

import type { TimelinePlugin } from "../plugins/types";

/**
 * 业务身份：string 按原值比较（不 trim/normalize），number 必须 finite。
 * `1` 与 `"1"` 是不同身份；数值 `-0` 与 `0` 按 JS 数值相等规则视为同一身份。
 */
export type BusinessId = string | number;

export type ScheduleErrorCode =
  | "invalid_input"
  | "duplicate_business_id"
  | "not_found"
  | "missing_business_id"
  | "destroyed"
  // M2 编辑协议新增
  | "busy"
  | "reconciliation_required"
  | "invalid_server_result"
  | "stale_operation";

export interface ScheduleError {
  code: ScheduleErrorCode;
  /** 指向输入中出错字段的路径，如 `tracks[0].events[2].startTime` */
  path?: string;
  message: string;
}

export type ScheduleResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ScheduleError };

export interface ScheduleEventInput {
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
export type ScheduleEventPatch = Partial<Omit<ScheduleEventInput, "businessId">>;

export interface ScheduleTrackInput {
  businessId: BusinessId;
  customData?: Record<string, unknown>;
  events: ScheduleEventInput[];
}

export interface ScheduleDataFormat {
  tracks: ScheduleTrackInput[];
  timeIndicatorPosition?: number;
}

export interface ScheduleEventLocation {
  trackIndex: number;
  eventIndex: number;
  resourceBusinessId: BusinessId;
  /** 与内存隔离的快照；customData 深拷贝，waveform.data 保留引用（大媒体复制策略见文档） */
  event: TimelineEvent;
}

export interface ScheduleEventUpsert {
  resourceBusinessId: BusinessId;
  event: ScheduleEventInput;
}

/** 统一内容绘制的阶段：普通显示 / 拖动预览 / 拉伸 */
export type EventContentPhase = "normal" | "drag" | "resize";

/** 以 Canvas 左上角为原点的 CSS px 矩形（已扣 scrollX/Y） */
export interface EventContentRect {
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
export interface EventContentRenderContext {
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
export interface TimelineViewportSnapshot {
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

export interface TrackRect {
  businessId: BusinessId;
  trackIndex: number;
  /** 完整行矩形；已存在但完全离屏的行仍返回完整 rect */
  rect: EventContentRect;
  /** 与可绘制视口的交集；完全不可见时为 null */
  visibleRect: EventContentRect | null;
}

export type ViewportListener = (snapshot: TimelineViewportSnapshot) => void;

export interface TimelineOptions {
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
    roundRect?: (
      x: number,
      y: number,
      w: number,
      h: number,
      radii: number | [number, number, number, number]
    ) => void;
  }
}

// ===== M2：可选排程编辑协议（opt-in scheduleEditing）=====

/** 一次编辑后的目标位置（资源业务身份 + 起止秒） */
export interface SchedulePlacement {
  resourceBusinessId: BusinessId;
  startTime: number;
  endTime: number;
}

/** 编辑快照：资源业务身份 + 事件快照（运行时深拷贝，与内部事实脱离引用） */
export interface ScheduleEditSnapshot {
  resourceBusinessId: BusinessId;
  event: Readonly<TimelineEvent>;
}

/** 一次用户编辑意图：预览与提交沿用同一 operationId */
export interface ScheduleChange {
  operationId: string;
  eventBusinessId: BusinessId;
  action: "move" | "resize";
  /** 仅 resize 存在；move 不得携带 */
  resizeEdge?: "left" | "right";
  before: ScheduleEditSnapshot;
  after: ScheduleEditSnapshot;
}

/** 同步业务校验结果：拒绝必须带稳定 code 与可展示 reason */
export type ScheduleValidationResult =
  | { allowed: true }
  | { allowed: false; code: string; reason: string };

/** 提交端结果：accepted 携带可选服务器修正；rejected 携带安全原因 */
export type ScheduleCommitResult =
  | { accepted: true; placement?: SchedulePlacement }
  | { accepted: false; code?: string; reason: string };

/** 排程编辑协议配置；onBeforeCommit 必填 */
export interface ScheduleEditingOptions {
  /** 同步业务校验；返回 Promise/非法结构一律按 validation_error 拒绝 */
  validate?: (change: Readonly<ScheduleChange>) => ScheduleValidationResult;
  /** 唯一保存入口；同一操作只调用一次 */
  onBeforeCommit: (
    change: Readonly<ScheduleChange>,
    context: { signal: AbortSignal },
  ) => Promise<ScheduleCommitResult>;
  /** 客户端等待上限，默认 30000ms；有限正数且 ≤ 2147483647 */
  commitTimeoutMs?: number;
}

/** 单事件编辑状态查询结果；null 表示事件不存在 */
export interface ScheduleEditState {
  state: "idle" | "preview" | "pending" | "reconciliation_required";
  operationId?: string;
  action?: "move" | "resize";
  /** pending/preview 的候选位置 */
  placement?: SchedulePlacement;
  /** reconciliation_required 的待核对原因码 */
  reasonCode?: string;
}

/** 提交结算状态种类 */
export type ScheduleCommitStateKind =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "validation_failed"
  | "reconciliation_required"
  | "invalidated"
  | "reconciled";

/** 提交状态变化通知（独立于旧成功回调，不是第二个保存入口） */
export interface ScheduleCommitStateData {
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
export interface ScheduleEditDraft {
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
