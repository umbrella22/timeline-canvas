---
title: Data Management API
---

## loadData(data: LoadDataFormat): boolean

Loads a full timeline payload. The current implementation clears existing tracks and selection state, then normalizes the input into runtime `TimelineEvent` objects.

```ts
timeline.loadData({
  timeIndicatorPosition: 300,
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: "Day Shift",
          description: "Morning work block",
        },
        {
          startTime: 1200,
          duration: 600,
          title: "Review",
        },
      ],
    },
  ],
});
```

Notes:

- Events can use either `startTime + endTime` or `startTime + duration`
- If the payload ends up with no tracks, `Timeline` adds one empty track
- If `timeIndicatorPosition` is present, the runtime calls `setTimeIndicator()` internally

## addEvent(...)

```ts
timeline.addEvent(
  0,
  1200,
  1800,
  "Auto-generated event",
  "Example description",
  { note: "example" },
  false
);
```

Signature:

```ts
addEvent(
  trackIndex: number,
  startTime: number,
  endTime: number,
  title: string,
  description?: string,
  customData?: Record<string, unknown>,
  readonly?: boolean
): void
```

Notes:

- `trackIndex` must refer to an existing track
- In the public API, the third argument is documented as `endTime`
- The current implementation tolerates some duration-like inputs, but you should pass a real end time for clarity

## updateEvent(trackIndex, eventIndex, updates): boolean

Applies a `Partial<TimelineEvent>` directly to the runtime event object.

```ts
timeline.updateEvent(0, 1, {
  title: "Updated title",
  color: "#1890ff",
  customData: { owner: "alice" },
});
```

## updateEventData(trackIndex, eventIndex, eventData): boolean

A lighter-weight update API for form-driven edits.

```ts
timeline.updateEventData(0, 1, {
  title: "Edit complete",
  startTime: 2400,
  duration: 300,
  description: "Exported first cut",
});
```

## deleteEvent(trackIndex, eventIndex): boolean

Deletes an event.

```ts
timeline.deleteEvent(0, 1);
```

Notes:

- A successful delete triggers `events:delete`
- If `autoRemoveEmptyLastTrack` is enabled, the final empty track may be removed automatically

## addTrack(): void

Adds a new empty track.

```ts
timeline.addTrack();
```

## removeTrack(): void

Removes the last track.

```ts
timeline.removeTrack();
```

Notes:

- At least one track is always kept
- If removal is not allowed, the runtime updates the status text instead of throwing

## autoRemoveEmptyLastTrack(): void

Recursively removes the last track when it is empty and `autoRemoveEmptyLastTrack` is enabled.

```ts
timeline.autoRemoveEmptyLastTrack();
```

## setEndTime(endTime: number): boolean

Updates the timeline end time.

```ts
timeline.setEndTime(86400);
```

Notes:

- `endTime` must be greater than `startTime`
- If existing events extend beyond the new end time, the runtime warns but does not trim them
- If the time indicator falls out of range, it is clamped to the new `endTime`

## getEndTime(): number

Returns the current end time.

```ts
const endTime = timeline.getEndTime();
```

## Index batching

These APIs are mainly useful when you mutate `timeline.state.tracks` directly or perform large external writes.

### beginIndexBatch(): void

```ts
timeline.beginIndexBatch();
```

### endIndexBatch(): void

```ts
timeline.endIndexBatch();
```

### invalidateIndexTrack(trackIndex: number): void

```ts
timeline.invalidateIndexTrack(0);
```

### invalidateIndexAll(): void

```ts
timeline.invalidateIndexAll();
```

> If you use public APIs such as `addEvent`, `updateEvent`, `deleteEvent`, or `loadData`, index invalidation is already handled for you.
