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
  formatEventDuration: ((duration: number) => string) | null;
  eventTextStyle: EventTextStyle;
  eventBlockStyle: EventBlockStyle;
  colors: TimelineColors;
  contextMenuItems: ContextMenuItem[];
  contextMenuStyle: ContextMenuStyle;
  contextMenuHtml?: string | HTMLElement;
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
  customData?: Record<string, any>;
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
      customData?: Record<string, any>;
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
  formatEventDuration?: (duration: number) => string;
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
  private guideLinesCache;
  private guideLinesCacheTimestamp;
  private readonly GUIDE_LINES_CACHE_TTL;
  private eventListeners;
  private pluginManager;
  private logger;
  private errorHandler;
  private stateManager;
  private eventIndexManager;
  private changeScheduler;
  private currentThemePluginId;
  constructor(canvasId: string, options?: TimelineOptions);
  getCanvas(): HTMLCanvasElement;
  usePlugin(plugin: any): Promise<boolean>;
  getLoadedPlugins(): any[];
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
  private validateEventTime;
  addEvent(trackIndex: number, startTime: number, endTime: number, title: string, description?: string, customData?: Record<string, any>, readonly?: boolean): void;
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
  private scrollToTimeIndicator;
  zoom(factor: number): void;
  setZoomLevel(zoomLevel: number): boolean;
  getZoomLevel(): number;
  setEndTime(endTime: number): boolean;
  getEndTime(): number;
  formatTime(seconds: number): string;
  setStatus(text: string): void;
  getStatus(): string;
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
}
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
//#region src/plugins/types.d.ts
declare enum PluginType {
  RENDER = "render",
  EVENT_HANDLER = "event_handler",
  DATA_SOURCE = "data_source",
  THEME = "theme",
  TOOL = "tool",
  EXTENSION = "extension",
}
declare enum PluginPriority {
  LOW = 0,
  NORMAL = 50,
  HIGH = 100,
  CRITICAL = 200,
}
interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  type: PluginType;
  priority?: PluginPriority;
  dependencies?: string[];
}
type RenderLayerPosition = "background" | "overlay";
interface RenderLayer {
  name: string;
  position: RenderLayerPosition;
  render: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, config: any, state: any) => void;
}
interface PluginAPI {
  registerRenderLayer: (layer: RenderLayer) => void;
  unregisterRenderLayer: (name: string) => void;
  registerEventHandler: (event: string, handler: Function) => void;
  unregisterEventHandler: (event: string, handler: Function) => void;
  showNotification: (message: string, type?: "info" | "warning" | "error") => void;
  getData: (key: string) => any;
  setData: (key: string, value: any) => void;
  setPerformanceProvider: (provider: PerformanceProvider) => void;
  getPerformanceStats: () => Map<string, PerformanceStats>;
  getFPS: () => number;
}
interface PluginContext {
  timeline: Timeline;
  config: any;
  state: any;
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
export { ZoomData as C, Track as S, TimelineColors as _, ContextMenuItem as a, TimelineOptions as b, EventClickData as c, EventMoveData as d, EventTextStyle as f, TimelineCallbacks as g, TimeIndicatorMoveData as h, ContextMenuData as i, EventDeleteData as l, LoadDataFormat as m, Timeline as n, ContextMenuStyle as o, EventUpdateData as p, ChangeType as r, EventAddData as s, TimelinePlugin as t, EventEditData as u, TimelineConfig as v, TimelineState as x, TimelineEvent as y };