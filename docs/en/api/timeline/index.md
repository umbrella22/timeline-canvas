---
title: Timeline API Overview
---

`Timeline` is the core class that provides the primary capabilities of the timeline (data management, view control, plugins, and event callbacks).

## Constructor

```ts
class Timeline {
  constructor(canvasId: string, options?: TimelineOptions);
}
```

### Parameters

- `canvasId`: the `id` of the canvas element
- `options`: timeline config and callbacks (seconds-based, see [Type Definitions](./types))

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

### [Data Management](./data-management)

- `loadData` - load data
- `addEvent` - add an event
- `updateEvent` - update an event
- `deleteEvent` - delete an event
- `addTrack` - add a track
- `removeTrack` - remove a track
- `setEndTime` - set end time
- `beginIndexBatch` - start batch indexing
- `endIndexBatch` - end batch indexing

### [View Control](./view-control)

- `setZoomLevel` - set zoom level
- `zoom` - zoom
- `setTimeIndicator` - set time indicator
- `setCanvasSize` - set canvas size
- `markDirty` - trigger a redraw
- `notifyChange` - notify change
- `beginChangeBatch` - start batch changes
- `endChangeBatch` - end batch changes

### [Plugin Management](./plugin-management)

- `usePlugin` - use a plugin
- `removePlugin` - remove a plugin
- `setTheme` - switch theme
- `getLoadedPlugins` - get loaded plugins

### [Event Callbacks](./event-listeners)

- `onEventAdd`
- `onEventUpdate`
- `onEventClick`
- ...more callbacks

### [Type Definitions](./types)

- `TimelineEvent`
- `TimelineConfig`
- `LoadDataFormat`
