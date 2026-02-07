`Timeline` is the core class that provides the primary capabilities of the timeline (data management, view control, plugins, and event callbacks).

## Constructor

```ts
class Timeline {
  constructor(canvasId: string, options?: TimelineOptions);
}
```

### Parameters

* `canvasId`: the `id` of the canvas element
* `options`: timeline config and callbacks (seconds-based, see [Type Definitions](/timeline-canvas/en/api/timeline/types.md))

### Example

```ts
const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  canvasHeight: 600,
  trackHeight: 46,
  trackMargin: 10,
});
```

## 📋 API Directory

### [Data Management](/timeline-canvas/en/api/timeline/data-management.md)

* `loadData` - load data
* `addEvent` - add an event
* `updateEvent` - update an event
* `deleteEvent` - delete an event
* `addTrack` - add a track
* `removeTrack` - remove a track
* `setEndTime` - set end time
* `beginIndexBatch` - start batch indexing
* `endIndexBatch` - end batch indexing

### [View Control](/timeline-canvas/en/api/timeline/view-control.md)

* `setZoomLevel` - set zoom level
* `zoom` - zoom
* `setTimeIndicator` - set time indicator
* `setCanvasSize` - set canvas size
* `markDirty` - trigger a redraw
* `notifyChange` - notify change
* `beginChangeBatch` - start batch changes
* `endChangeBatch` - end batch changes

### [Plugin Management](/timeline-canvas/en/api/timeline/plugin-management.md)

* `usePlugin` - use a plugin
* `removePlugin` - remove a plugin
* `setTheme` - switch theme
* `getLoadedPlugins` - get loaded plugins

### [Event Callbacks](/timeline-canvas/en/api/timeline/event-listeners.md)

* `onEventAdd`
* `onEventUpdate`
* `onEventClick`
* ...more callbacks

### [Type Definitions](/timeline-canvas/en/api/timeline/types.md)

* `TimelineEvent`
* `TimelineConfig`
* `LoadDataFormat`
