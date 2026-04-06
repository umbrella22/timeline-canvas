---
title: Timeline API Overview
---

`Timeline` is the runtime core of Timeline Canvas. It ties together data, interaction handling, rendering, and plugins.

## Constructor

```ts
import { Timeline, LightThemePlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  canvasHeight: 600,
  trackHeight: 46,
  trackMargin: 10,
  theme: LightThemePlugin,
});
```

### Parameters

- `canvasId`: the `id` of the target `<canvas>`
- `options`: constructor options, typed as `TimelineOptions`

### Public properties

- `config`: normalized runtime config
- `callbacks`: the current callback set
- `state`: the current runtime state

> If you mutate `timeline.config` or `timeline.state` directly, call `notifyChange()` afterward. When a public method exists, prefer the method over mutating internals.

## API map

### [Data Management](./data-management)

- `loadData`
- `addEvent`
- `updateEvent`
- `updateEventData`
- `deleteEvent`
- `addTrack` / `removeTrack`
- `autoRemoveEmptyLastTrack`
- `setEndTime` / `getEndTime`
- `beginIndexBatch` / `endIndexBatch`
- `invalidateIndexTrack` / `invalidateIndexAll`

### [View, Interaction, and State](./view-control)

- `setZoomLevel` / `zoom` / `getZoomLevel`
- `setTimeIndicator` / `setTimeIndicatorDuringDrag`
- `setCanvasSize` / `adjustCanvasSize` / `draw`
- `markDirty` / `notifyChange`
- `beginChangeBatch` / `endChangeBatch`
- `getInteractionTarget` / `getEventAtPosition` / `getResizeHandle`
- `calculateGuideLines` / `snapToGuideLines` / `snapEdgeToGuideLines`
- `canMoveEvent`
- `showSplitLine` / `hideSplitLine` / `splitEvent`
- `setReadOnly` / `isReadOnly`
- `highlightEvent` / `clearHighlight` / `getHighlightedEvent`
- `setDebug` / `setEnableTimeIndicator`
- `setStatus` / `getStatus`

### [Plugin Management](./plugin-management)

- `usePlugin`
- `removePlugin`
- `setTheme`
- `getLoadedPlugins`
- `isPluginLoaded`

### [Event Callbacks](./event-listeners)

- `onEventAdd`
- `onEventUpdate`
- `onEventDelete`
- `onEventMove`
- `onEventClick`
- `onEventHighlight`
- `onTimeIndicatorHighlight`
- `onStatusChange`

### [Type Definitions](./types)

- `TimelineOptions`
- `TimelineConfig`
- `TimelineEvent`
- `InteractionTarget`
- `LoadDataFormat`

## Destroying an instance

```ts
timeline.destroy();
```

Call `destroy()` when the canvas is going away, such as during component unmount or page teardown.
