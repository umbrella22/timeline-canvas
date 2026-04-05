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
}

export interface ResizingEvent {
  trackIndex: number;
  eventIndex: number;
  edge: "left" | "right";
  startX: number;
  originalStartTime: number;
  originalDuration: number;
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

import type { TimelinePlugin } from "../plugins/types";

export interface TimelineOptions {
  canvasHeight?: number;
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
    roundRect?: (
      x: number,
      y: number,
      w: number,
      h: number,
      radii: number | [number, number, number, number]
    ) => void;
  }
}
