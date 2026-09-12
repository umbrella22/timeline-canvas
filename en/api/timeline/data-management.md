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

* Events can use either `startTime + endTime` or `startTime + duration`
* If the payload ends up with no tracks, `Timeline` adds one empty track
* If `timeIndicatorPosition` is present, the runtime calls `setTimeIndicator()` internally

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

* `trackIndex` must refer to an existing track
* In the public API, the third argument is documented as `endTime`
* The current implementation tolerates some duration-like inputs, but you should pass a real end time for clarity

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

* A successful delete triggers `events:delete`
* If `autoRemoveEmptyLastTrack` is enabled, the final empty track may be removed automatically

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

* At least one track is always kept
* If removal is not allowed, the runtime updates the status text instead of throwing

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

* `endTime` must be greater than `startTime`
* If existing events extend beyond the new end time, the runtime warns but does not trim them
* If the time indicator falls out of range, it is clamped to the new `endTime`

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

## Business identity and strict schedule data (added in 1.6)

The new methods revolve around the optional `businessId` (`string | number`): strings compare verbatim (no trimming), numbers must be finite; `1` and `"1"` are different identities. The legacy `number` ids and their generation semantics are unchanged.

### loadScheduleData(data: ScheduleDataFormat): ScheduleResult<void>

Strict schedule import: the whole batch is validated first and published atomically in one shot; on failure nothing is written and previous tracks/selection/indexes stay intact. Every track and event must carry a `businessId`; empty `tracks` yields `invalid_input`, duplicate identities yield `duplicate_business_id`, out-of-window times yield `invalid_input` with `path` pointing at the field. A successful import clears selection (same as `loadData`); use `upsertScheduleEvents` / `updateEventByBusinessId` for refreshes that must preserve selection.

### exportScheduleData(): ScheduleResult<ScheduleDataFormat>

Exports an isolated strict snapshot: no numeric ids, selection, scrolling or caches; `customData` is deep-copied; `Float32Array` waveform data becomes `number[]`. Events or tracks without a business identity produce `missing_business_id` — identities are never fabricated.

### Queries, patch, upsert, delete, highlight, track metadata

* `getEventByBusinessId(id)` / `getTrackByBusinessId(id)` return isolated snapshots (`null` when unknown).
* `updateEventByBusinessId(id, patch)` validates merged times and recomputes duration; `customData` is replaced wholesale; `id` / `businessId` / `duration` cannot be patched.
* `upsertScheduleEvents(items)` replaces complete business events; existing identities are replaced or moved atomically after whole-batch validation.
* `deleteEventByBusinessId(id)` re-resolves interaction pointers by identity, so deleting a neighbour never drifts the selection.
* `highlightEventByBusinessId(id)` mirrors `highlightEvent`.
* `updateTrackByBusinessId(id, patch)` updates resource metadata only.

### Compatibility notes

* Legacy `loadData` / `addEvent` / `updateEvent` signatures and behaviour are unchanged; `LoadDataFormat` tracks and events now accept an optional `businessId` (tracks also accept `customData`), preserved through clones and callbacks.
* Legacy `updateEvent` validates uniqueness before writing when `businessId` is supplied; conflicts return `false`.
* `splitEvent` keeps the business id on the first segment and clears it on the second.

## M2: optional editing protocol (scheduleEditing)

The async editing protocol is enabled by `TimelineOptions.scheduleEditing`; without it every
interaction keeps M1 synchronous semantics. The object must provide `onBeforeCommit` (the single
save entry), with optional `validate` (synchronous business validation) and `commitTimeoutMs`
(default 30000, finite positive, <= 2147483647); invalid configuration throws at construction.

* **Flow**: a drag/resize captures a `before` snapshot at gesture start; the candidate passes core
  validation (readonly/missing\_business\_id/busy/invalid\_time/invalid\_resource/overlap/
  reservation\_conflict/plugin\_rejected) plus business `validate`, then commits; `onBeforeCommit` is
  called once per operation with an `AbortSignal`.
* **Settlement**: `{accepted:true}` (optionally with a server-corrected `placement`) publishes once
  and fires the legacy callback once (with `oldEvent` and from/to resource ids); `{accepted:false,
  reason}` restores the original display without retry; timeout/network error/hook throw/invalid
  result enter `reconciliation_required` — candidate and same-task lock are kept, late results are
  never written back, and `reconcileScheduleEvent(id, snapshot|null, {operationId})` is the only way
  to settle with authoritative facts.
* **Concurrency**: while an event is pending/unknown, further edits and programmatic writes are
  rejected (`updateEventByBusinessId` / whole-batch `upsertScheduleEvents` / `deleteEventByBusinessId`
  / `splitEvent` return `busy` or `reconciliation_required`; legacy boolean entries return `false`);
  other events stay editable but cannot take any transaction's before/candidate slot
  (`reservation_conflict`); resources referenced by a transaction cannot be `removeTrack`ed.
* **State notification**: `onScheduleCommitStateChange` reports pending/accepted/rejected/cancelled/
  validation\_failed/reconciliation\_required/invalidated/reconciled; `getScheduleEditState(id)`
  returns null for unknown events and `idle` without a transaction.
* **Boundaries**: drafts are render projections only — `tracks`, `getEventByBusinessId` and
  `exportScheduleData` always contain confirmed facts; split and interactive auto track-add are
  disabled in this mode; a successful `loadScheduleData`/`loadData` invalidates in-flight operations
  (invalidated); the core never performs network I/O — transport/auth live in the `onBeforeCommit`
  adapter.
