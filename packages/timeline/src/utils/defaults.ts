import type { TimelineColors, EventTextStyle, EventBlockStyle, TimelineConfig, ContextMenuItem, ContextMenuStyle } from "../types";

export const DEFAULT_COLORS: TimelineColors = {
  canvasBackground: "#1E1E2E",
  timelineBackground: "#2D2D3D",
  trackBackground: "#2A2A3A",
  trackBackgroundSelected: "#3A3A4A",
  timelineText: "#CCCCDD",
  timelineGrid: "#5A5A7A",
  timelineSubGrid: "#3A3A4A",
  trackText: "#CCCCDD",
  eventColors: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57", "#FF9FF3"],
  eventText: "#FFFFFF",
  eventBorder: "#FFFFFF",
  eventBorderSelected: "#FFD700",
  eventOverlay: "rgba(255, 255, 255, 0.2)",
  dragPreviewValid: "rgba(100, 255, 100, 0.5)",
  dragPreviewInvalid: "rgba(255, 100, 100, 0.5)",
  dragPreviewBorderValid: "#00FF00",
  dragPreviewBorderInvalid: "#FF0000",
  timeIndicator: "#FF6B6B",
  guideLine: "#00D9FF",
  guideLineLabel: "#00D9FF",
  dragTimeReferenceLine: "#FFD700",
  dragTimeReferenceLabel: "#FFD700",
  dragTimeReferenceLabelBackground: "rgba(0, 0, 0, 0)",
  scrollbarTrack: "rgba(255, 255, 255, 0.6)",
  scrollbarHandle: "rgba(150, 150, 150, 0.8)",
  scrollbarHandleHover: "rgba(0, 0, 0, 0.85)",
  scrollbarHandleHighlight: "rgba(255, 255, 255, 0.3)",
  scrollbarBorder: "rgba(255, 255, 255, 0.9)",
  contextMenuBackground: "#2D2D3D",
  contextMenuBorder: "#5A5A7A",
  contextMenuText: "#CCCCDD",
  contextMenuHoverBackground: "#3A3A4A",
  contextMenuHoverText: "#FFFFFF",
  eventDurationLabel: "#FFD700",
};

export const DEFAULT_EVENT_TEXT_STYLE: EventTextStyle = {
  titleFontSize: "auto",
  timeFontSize: "auto",
  titleFontFamily: "Arial",
  timeFontFamily: "Arial",
  titleFontWeight: "bold",
  timeFontWeight: "normal",
  titleColor: null,
  timeColor: null,
  textAlign: "left",
  verticalAlign: "middle",
  titleOffsetY: 0,
  timeOffsetY: 0,
  showTitle: true,
  showTime: true,
  minHeightForTitle: 40,
  minHeightForTime: 50,
};

export const DEFAULT_EVENT_BLOCK_STYLE: EventBlockStyle = {
  borderRadius: 2,
  enableSelectionGlow: false,
  selectionGlowBlur: 10,
};

export const DEFAULT_CONTEXT_MENU_ITEMS: ContextMenuItem[] = [
  { type: "edit", name: "编辑" },
  { type: "delete", name: "删除" },
  { type: "export", name: "导出" },
];

export const DEFAULT_CONTEXT_MENU_STYLE: ContextMenuStyle = {
  fontSize: 14,
  fontFamily: "Arial, sans-serif",
  fontWeight: "normal",
  padding: 8,
  itemHeight: 32,
  borderRadius: 6,
  borderWidth: 1,
  minWidth: 120,
};

export const DEFAULT_CONFIG: Omit<
  TimelineConfig,
  | "colors"
  | "eventTextStyle"
  | "eventBlockStyle"
  | "contextMenuItems"
  | "contextMenuStyle"
> = {
  timelineHeight: 40,
  trackHeight: 80,
  trackMargin: 10,
  firstTrackTopMargin: 10,
  secondWidth: 100 / 3600,
  startTime: 0,
  endTime: 86400,
  startPaddingTime: 0.5,
  endPaddingTime: 0,
  autoFitOnInit: true,
  minAutoFitZoom: 1.0,
  maxAutoFitZoom: 3.0,
  timeUnit: "second",
  timeFormat: "24h",
  snapInterval: 15,
  snapToSeconds: true,
  secondPrecisionZoomThreshold: 1.5,
  timeIndicatorWidth: 3,
  timeIndicatorSnapThreshold: 10,
  timeIndicatorHeadSize: 12,
  timeIndicatorTriangleHeight: 8,
  guideLineSnapThreshold: 1.0,
  enableTimeIndicator: true,
  enableEventResize: true,
  enableEventSplit: true,
  enableContextMenu: true,
  resizeHandleWidth: 8,
  minEventDuration: 0.25,
  debug: false,
  enablePerformanceMonitor: false,
  autoAddTrack: true,
  autoRemoveEmptyLastTrack: true,
  readOnly: false,
  showEventDurationLabel: true,
  formatEventDuration: null,
  scale: null,
  scaleSplitCount: 10,
  getScaleRender: null,
};