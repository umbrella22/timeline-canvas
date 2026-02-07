---
title: Configuration
---

> Timeline Canvas uses a seconds-based relative time model. For the most accurate configuration types, refer to the TypeScript definitions: see [Type Definitions](../api/timeline/types).

## TimelineConfig Interface

Timeline Canvas uses a seconds-based time model. All time values are relative seconds from the timeline start.

```typescript
interface TimelineConfig {
  // Time range
  startTime: number;
  endTime: number;
  startPaddingTime: number;
  endPaddingTime: number;
  secondWidth: number;

  // Layout & sizing
  canvasHeight?: number;
  timelineHeight: number;
  trackHeight: number;
  trackMargin: number;
  firstTrackTopMargin: number;

  // Feature toggles
  enableEventResize: boolean;
  enableEventSplit: boolean;
  enableTimeIndicator: boolean;
  enableContextMenu: boolean;
  debug: boolean;
  enablePerformanceMonitor: boolean;
  readOnly: boolean;

  // Track auto-management
  autoAddTrack: boolean;
  autoRemoveEmptyLastTrack: boolean;

  // Event config
  minEventDuration: number;
  resizeHandleWidth: number;
  showEventDurationLabel: boolean;
  formatEventDuration: ((duration: number) => string) | null;

  // Auto-fit
  autoFitOnInit: boolean;
  minAutoFitZoom: number;
  maxAutoFitZoom: number;

  // Snapping
  snapInterval: number;
  snapToSeconds: boolean;
  secondPrecisionZoomThreshold: number;

  // Time indicator
  timeIndicatorWidth: number;
  timeIndicatorSnapThreshold: number;
  timeIndicatorHeadSize: number;
  timeIndicatorTriangleHeight: number;

  // Guide lines
  guideLineSnapThreshold: number;

  // Text & block styles
  eventTextStyle: EventTextStyle;
  eventBlockStyle: EventBlockStyle;
  colors: TimelineColors;

  // Context menu
  contextMenuItems: ContextMenuItem[];
  contextMenuStyle: ContextMenuStyle;
  contextMenuHtml?: string | HTMLElement;

  // Callbacks
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

## Style Interfaces

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

## Full Configuration Example (Same as the Demo)

```javascript
const timeline = new Timeline("timelineCanvas", {
  // Time range (seconds)
  startTime: 0,
  endTime: 3600,
  endPaddingTime: 60,

  // Layout & sizing
  secondWidth: 0.022,
  canvasHeight: 600,
  trackHeight: 46,
  trackMargin: 10,
  firstTrackTopMargin: 16,
  timelineHeight: 60,

  // Feature toggles
  enableEventResize: true,
  enableEventSplit: true,
  enableTimeIndicator: true,
  enableContextMenu: true,
  debug: false,

  // Track auto-management
  autoAddTrack: true,
  autoRemoveEmptyLastTrack: true,

  // Event config
  minEventDuration: 0.25,
  resizeHandleWidth: 8,
  minAutoFitZoom: 14.0,

  // Snapping
  snapInterval: 15,
  snapToSeconds: true,
  secondPrecisionZoomThreshold: 1.0,

  // Text & block styles (example)
  eventTextStyle: { showTitle: true, showTime: false },
  eventBlockStyle: { borderRadius: 2, enableSelectionGlow: false },

  // Callbacks (example)
  onEventClick: (data) => console.log("Event click", data),
  onZoom: (data) => console.log("Zoom", data),
});
```
