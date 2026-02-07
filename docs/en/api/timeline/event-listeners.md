---
title: Event Callbacks API
---

## Callbacks (Recommended)

Pass callbacks in the initialization options:

```ts
const timeline = new Timeline("timelineCanvas", {
  onEventAdd: (data) => console.log("Event added", data),
  onEventUpdate: (data) => console.log("Event updated", data),
  onEventDelete: (data) => console.log("Event deleted", data),
  onEventMove: (data) => console.log("Event moved", data),
  onEventClick: (data) => console.log("Event clicked", data),
  onEventEdit: (data) => console.log("Event edited", data),
  onTimeIndicatorHighlight: (data) => console.log("Time indicator highlight", data),
  onContextMenu: (data) => console.log("Context menu triggered", data),
  onTrackAdd: (track) => console.log("Track added", track),
  onTrackRemove: (track) => console.log("Track removed", track),
  onTimeIndicatorMove: (data) => console.log("Time indicator moved", data),
  onZoom: (data) => console.log("Zoom changed", data),
  onStatusChange: (text) => console.log("Status", text),
});
```
