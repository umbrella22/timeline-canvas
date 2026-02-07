## loadData(data: LoadDataFormat)

Load timeline data (seconds-based).

```ts
timeline.loadData({
  timeIndicatorPosition: 0,
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: "Day Shift",
          description: "Morning work block",
        },
      ],
    },
  ],
});
```

## addEvent

`addEvent(trackIndex: number, startTime: number, endTime: number, title: string, description?: string, customData?: any, readonly?: boolean)`

Add an event to the specified track.

```ts
timeline.addEvent(0, 1200, 1800, "Auto-generated event", "Example description", {
  note: "example",
});
```

## updateEvent

`updateEvent(trackIndex: number, eventIndex: number, updates: Partial<TimelineEvent>)`

Update an event.

```ts
timeline.updateEvent(0, 1, {
  title: "Updated title",
});
```

## deleteEvent

`deleteEvent(trackIndex: number, eventIndex: number)`

Delete an event.

```ts
timeline.deleteEvent(0, 1);
```

## addTrack

`addTrack()`

Add a new empty track.

```ts
timeline.addTrack();
```

## removeTrack

`removeTrack()`

Remove the last track.

```ts
timeline.removeTrack();
```

## autoRemoveEmptyLastTrack

`autoRemoveEmptyLastTrack()`

Automatically remove the last empty track (if any).

```ts
timeline.autoRemoveEmptyLastTrack();
```

## setEndTime

`setEndTime(endTime: number)`

Set the timeline end time (seconds).

```ts
timeline.setEndTime(86400); // set end time to 24 hours
```

## getEndTime

`getEndTime(): number`

Get the timeline end time (seconds).

```ts
const endTime = timeline.getEndTime(); // returns seconds
```

## beginIndexBatch

`beginIndexBatch()`

Begin batch index updates. Useful when adding/updating many events to improve performance.

```ts
timeline.beginIndexBatch();
// bulk add/update events...
timeline.endIndexBatch();
```

## endIndexBatch

`endIndexBatch()`

End batch index updates and rebuild the index.

## invalidateIndexTrack

`invalidateIndexTrack(trackIndex: number)`

Invalidate the index for a given track; it will be rebuilt on the next query.

```ts
timeline.invalidateIndexTrack(0);
```

## invalidateIndexAll

`invalidateIndexAll()`

Invalidate the index for all tracks.

```ts
timeline.invalidateIndexAll();
```
