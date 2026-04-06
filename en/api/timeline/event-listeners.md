## Recommended usage

Pass callbacks through `TimelineOptions` when you create the instance:

```ts
const timeline = new Timeline("timelineCanvas", {
  onEventAdd: (data) => console.log("Event added", data),
  onEventUpdate: (data) => console.log("Event updated", data),
  onEventDelete: (data) => console.log("Event deleted", data),
  onEventMove: (data) => console.log("Event moved", data),
  onEventClick: (data) => console.log("Event clicked", data),
  onEventEdit: (data) => console.log("Event edited", data),
  onContextMenu: (data) => console.log("Context menu action", data),
  onTrackAdd: (track) => console.log("Track added", track),
  onTrackRemove: (track) => console.log("Track removed", track),
  onTimeIndicatorMove: (data) => console.log("Time indicator moved", data),
  onZoom: (data) => console.log("Zoom changed", data),
  onStatusChange: (text) => console.log("Status", text),
  onEventHighlight: (data) => console.log("Event highlight changed", data),
  onTimeIndicatorHighlight: (data) =>
    console.log("Time-indicator highlight changed", data),
});
```

## Data-change callbacks

### onEventAdd(data: EventAddData)

```ts
interface EventAddData {
  trackIndex: number;
  event: TimelineEvent;
}
```

### onEventUpdate(data: EventUpdateData)

```ts
interface EventUpdateData {
  type?: "resize" | "split";
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  oldEvent?: TimelineEvent;
  firstEvent?: TimelineEvent;
  secondEvent?: TimelineEvent;
}
```

Notes:

* Normal updates include `oldEvent`
* `splitEvent()` reports through the same callback with `type: "split"` and includes `firstEvent` and `secondEvent`

### onEventDelete(data: EventDeleteData)

### onEventMove(data: EventMoveData)

### onEventEdit(data: EventEditData)

### onEventClick(data: EventClickData)

`onEventClick` and `onEventEdit` include:

* `trackName`
* `formattedTimeRange`

## Track and UI callbacks

### onTrackAdd(track: Track)

### onTrackRemove(track: Track)

### onZoom(data: ZoomData)

### onStatusChange(statusText: string)

### onContextMenu(data: ContextMenuData)

Fires when a context-menu item is activated. `menuType` matches the configured `ContextMenuItem.type`.

### onTimeIndicatorMove(data: TimeIndicatorMoveData)

```ts
interface TimeIndicatorMoveData {
  position: number;
  time: string;
}
```

## Highlight callbacks

### onEventHighlight(data: EventHighlightData)

```ts
interface EventHighlightData {
  trackIndex: number | null;
  eventIndex: number | null;
  event: TimelineEvent | null;
}
```

Notes:

* This currently fires mainly for user-driven selection and deselection
* Programmatic highlight methods such as `highlightEvent()` and `clearHighlight()` do not currently emit this callback

### onTimeIndicatorHighlight(data: TimeIndicatorHighlightData)

```ts
interface TimeIndicatorHighlightData {
  position: number;
  highlightedEvents: Array<{
    trackIndex: number;
    eventIndex: number;
    event: TimelineEvent;
  }>;
}
```

Notes:

* Fires only when the highlighted set actually changes
* `setTimeIndicator()` can trigger it
* `setTimeIndicatorDuringDrag()` does not
