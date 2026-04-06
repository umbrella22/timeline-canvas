---
title: Configuration
---

> Timeline Canvas uses a seconds-based relative time model. The constructor takes `TimelineOptions`, not the full `TimelineConfig`. `TimelineConfig` is the fully resolved runtime config after defaults are applied.

## What you actually pass to the constructor

```ts
const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  canvasHeight: 600,
  trackHeight: 46,
  enableTimeIndicator: true,
  theme: LightThemePlugin,
  onZoom: (data) => console.log(data),
});
```

In other words:

- Use `TimelineOptions` for constructor input
- Use `TimelineConfig` to reason about the normalized runtime state
- See [Type Definitions](../api/timeline/types) for the exact field definitions

## Common config groups

### Time range and layout

```ts
const options = {
  startTime: 0,
  endTime: 3600,
  startPaddingTime: 10,
  endPaddingTime: 60,
  secondWidth: 0.022,
  canvasHeight: 600,
  timelineHeight: 60,
  trackHeight: 46,
  trackMargin: 10,
  firstTrackTopMargin: 16,
};
```

### Auto-fit and scale

```ts
const options = {
  autoFitOnInit: true,
  minAutoFitZoom: 1,
  maxAutoFitZoom: 3,
  snapInterval: 15,
  snapToSeconds: true,
  secondPrecisionZoomThreshold: 1.5,
  scale: null,
  scaleSplitCount: 10,
  getScaleRender: null,
};
```

### Interaction behavior

```ts
const options = {
  enableTimeIndicator: true,
  enableEventResize: true,
  enableEventSplit: true,
  enableContextMenu: true,
  minEventDuration: 0.25,
  resizeHandleWidth: 8,
  readOnly: false,
  autoAddTrack: true,
  autoRemoveEmptyLastTrack: true,
};
```

### Time indicator and edge scrolling

```ts
const options = {
  timeIndicatorWidth: 3,
  timeIndicatorSnapThreshold: 10,
  timeIndicatorHeadSize: 12,
  timeIndicatorTriangleHeight: 8,
  edgeScrollThrottle: 80,
  edgeScrollTriggerMargin: 30,
  edgeScrollViewportMargin: 50,
  guideLineSnapThreshold: 1,
};
```

### Text, block styling, and colors

```ts
const options = {
  eventTextStyle: {
    showTitle: true,
    showTime: false,
    textAlign: "left",
  },
  eventBlockStyle: {
    borderRadius: 2,
    enableSelectionGlow: false,
  },
  colors: {
    timeIndicator: "#3F76FC",
  },
};
```

### Context menu

```ts
const options = {
  enableContextMenu: true,
  contextMenuItems: [
    { type: "edit", name: "Edit" },
    { type: "delete", name: "Delete" },
  ],
  contextMenuStyle: {
    minWidth: 140,
  },
  contextMenuHtml: "<div>Custom menu template</div>",
};
```

### Plugins and callbacks

```ts
const options = {
  theme: LightThemePlugin,
  onEventClick: (data) => console.log("Event clicked", data),
  onZoom: (data) => console.log("Zoom", data),
  onStatusChange: (text) => console.log("Status", text),
};
```

## A few notable defaults from the source

Some of the most important runtime defaults are:

- `autoFitOnInit: true`
- `enableTimeIndicator: true`
- `enableEventResize: true`
- `enableEventSplit: true`
- `enableContextMenu: true`
- `enablePerformanceMonitor: false`
- `readOnly: false`
- `snapInterval: 15`
- `minEventDuration: 0.25`
- `trackHeight: 80`
- `timelineHeight: 40`

## Updating config at runtime

If you change `timeline.config` directly after construction, follow it with `notifyChange()`:

```ts
timeline.config.readOnly = true;
timeline.notifyChange("config:readOnly");

timeline.config.debug = true;
timeline.notifyChange("config:debug");
```

If a dedicated public method exists, prefer that instead:

```ts
timeline.setReadOnly(true);
timeline.setDebug(true);
timeline.setEnableTimeIndicator(false);
timeline.setEndTime(7200);
```

## Full example

```ts
import { Timeline, LightThemePlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  endPaddingTime: 60,
  secondWidth: 0.022,
  canvasHeight: 600,
  trackHeight: 46,
  trackMargin: 10,
  firstTrackTopMargin: 16,
  timelineHeight: 60,
  enableEventResize: true,
  enableEventSplit: true,
  enableTimeIndicator: true,
  enableContextMenu: true,
  autoAddTrack: true,
  autoRemoveEmptyLastTrack: true,
  minEventDuration: 0.25,
  resizeHandleWidth: 8,
  snapInterval: 15,
  snapToSeconds: true,
  eventTextStyle: { showTitle: true, showTime: false },
  eventBlockStyle: { borderRadius: 2, enableSelectionGlow: false },
  theme: LightThemePlugin,
  onEventClick: (data) => console.log("Event clicked", data),
  onZoom: (data) => console.log("Zoom", data),
});
```
