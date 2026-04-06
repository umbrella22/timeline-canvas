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

* `canvasId`: the `id` of the target `<canvas>`
* `options`: constructor options, typed as `TimelineOptions`

### Public properties

* `config`: normalized runtime config
* `callbacks`: the current callback set
* `state`: the current runtime state

> If you mutate `timeline.config` or `timeline.state` directly, call `notifyChange()` afterward. When a public method exists, prefer the method over mutating internals.

## API map

### [Data Management](/timeline-canvas/en/api/timeline/data-management.md)

* `loadData`
* `addEvent`
* `updateEvent`
* `updateEventData`
* `deleteEvent`
* `addTrack` / `removeTrack`
* `autoRemoveEmptyLastTrack`
* `setEndTime` / `getEndTime`
* `beginIndexBatch` / `endIndexBatch`
* `invalidateIndexTrack` / `invalidateIndexAll`

### [View, Interaction, and State](/timeline-canvas/en/api/timeline/view-control.md)

* `setZoomLevel` / `zoom` / `getZoomLevel`
* `setTimeIndicator` / `setTimeIndicatorDuringDrag`
* `setCanvasSize` / `adjustCanvasSize` / `draw`
* `markDirty` / `notifyChange`
* `beginChangeBatch` / `endChangeBatch`
* `getInteractionTarget` / `getEventAtPosition` / `getResizeHandle`
* `calculateGuideLines` / `snapToGuideLines` / `snapEdgeToGuideLines`
* `canMoveEvent`
* `showSplitLine` / `hideSplitLine` / `splitEvent`
* `setReadOnly` / `isReadOnly`
* `highlightEvent` / `clearHighlight` / `getHighlightedEvent`
* `setDebug` / `setEnableTimeIndicator`
* `setStatus` / `getStatus`

### [Plugin Management](/timeline-canvas/en/api/timeline/plugin-management.md)

* `usePlugin`
* `removePlugin`
* `setTheme`
* `getLoadedPlugins`
* `isPluginLoaded`

### [Event Callbacks](/timeline-canvas/en/api/timeline/event-listeners.md)

* `onEventAdd`
* `onEventUpdate`
* `onEventDelete`
* `onEventMove`
* `onEventClick`
* `onEventHighlight`
* `onTimeIndicatorHighlight`
* `onStatusChange`

### [Type Definitions](/timeline-canvas/en/api/timeline/types.md)

* `TimelineOptions`
* `TimelineConfig`
* `TimelineEvent`
* `InteractionTarget`
* `LoadDataFormat`

## Destroying an instance

```ts
timeline.destroy();
```

Call `destroy()` when the canvas is going away, such as during component unmount or page teardown.
