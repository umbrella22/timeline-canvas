# 配置项

## TimelineConfig 接口

Timeline Canvas 使用秒制时间系统，所有时间值都是从时间起点开始的相对秒数。

```typescript
interface TimelineConfig {
  // 基础时间配置
  startTime: number;
  endTime: number;
  startPaddingTime: number;
  endPaddingTime: number;
  secondWidth: number;

  // 尺寸与布局
  canvasHeight?: number;
  timelineHeight: number;
  trackHeight: number;
  trackMargin: number;
  firstTrackTopMargin: number;

  // 功能开关
  enableEventResize: boolean;
  enableEventSplit: boolean;
  enableTimeIndicator: boolean;
  enableContextMenu: boolean;
  debug: boolean;
  enablePerformanceMonitor: boolean;
  readOnly: boolean;

  // 轨道自动管理
  autoAddTrack: boolean;
  autoRemoveEmptyLastTrack: boolean;

  // 事件配置
  minEventDuration: number;
  resizeHandleWidth: number;
  showEventDurationLabel: boolean;
  formatEventDuration: ((duration: number) => string) | null;

  // 自动缩放
  autoFitOnInit: boolean;
  minAutoFitZoom: number;
  maxAutoFitZoom: number;

  // 吸附配置
  snapInterval: number;
  snapToSeconds: boolean;
  secondPrecisionZoomThreshold: number;

  // 时间指示器配置
  timeIndicatorWidth: number;
  timeIndicatorSnapThreshold: number;
  timeIndicatorHeadSize: number;
  timeIndicatorTriangleHeight: number;

  // 辅助线配置
  guideLineSnapThreshold: number;

  // 文本与块样式
  eventTextStyle: EventTextStyle;
  eventBlockStyle: EventBlockStyle;
  colors: TimelineColors;

  // 右键菜单配置
  contextMenuItems: ContextMenuItem[];
  contextMenuStyle: ContextMenuStyle;
  contextMenuHtml?: string | HTMLElement;

  // 回调事件
  onEventAdd?: (data: EventAddData) => void;
  onEventUpdate?: (data: EventUpdateData) => void;
  onEventDelete?: (data: EventDeleteData) => void;
  onEventMove?: (data: EventMoveData) => void;
  onEventClick?: (data: EventClickData) => void;
  onEventEdit?: (data: EventEditData) => void;
  onTimeIndicatorHighlight?: (data: TimeIndicatorHighlightData) => void;
  onContextMenu?: (data: ContextMenuData) => void;
  onTrackAdd?: (track: Track) => void;
  onTrackRemove?: (track: Track) => void;
  onTimeIndicatorMove?: (data: TimeIndicatorMoveData) => void;
  onZoom?: (data: ZoomData) => void;
  onStatusChange?: (statusText: string) => void;
  onEventHighlight?: (data: EventHighlightData) => void;
}
```

## 样式配置接口

### EventTextStyle

```typescript
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
```

### EventBlockStyle

```typescript
interface EventBlockStyle {
  borderRadius: number;
  enableSelectionGlow: boolean;
  selectionGlowBlur: number;
}
```

### TimelineColors

```typescript
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
```

## 完整配置示例（与 Demo 一致）

```javascript
const timeline = new Timeline("timelineCanvas", {
  // 时间范围（秒）
  startTime: 0,
  endTime: 3600,
  endPaddingTime: 60,

  // 尺寸与布局
  secondWidth: 0.022,
  canvasHeight: 600,
  trackHeight: 46,
  trackMargin: 10,
  firstTrackTopMargin: 16,
  timelineHeight: 60,

  // 功能开关
  enableEventResize: true,
  enableEventSplit: true,
  enableTimeIndicator: true,
  enableContextMenu: true,
  debug: false,

  // 轨道自动管理
  autoAddTrack: true,
  autoRemoveEmptyLastTrack: true,

  // 事件配置
  minEventDuration: 0.25,
  resizeHandleWidth: 8,
  minAutoFitZoom: 14.0,

  // 吸附配置
  snapInterval: 15,
  snapToSeconds: true,
  secondPrecisionZoomThreshold: 1.0,

  // 文本与块样式（示例）
  eventTextStyle: { showTitle: true, showTime: false },
  eventBlockStyle: { borderRadius: 2, enableSelectionGlow: false },

  // 回调事件（示例）
  onEventClick: (data) => console.log("事件点击", data),
  onZoom: (data) => console.log("缩放", data),
});
```
