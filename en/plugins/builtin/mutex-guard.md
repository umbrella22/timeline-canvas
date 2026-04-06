Prevents mutex-tagged events from overlapping in time.

## Basic usage

```ts
import { MutexGuardPlugin } from "timeline-canvas";

await timeline.usePlugin(MutexGuardPlugin());
```

## Configure mutex groups

Put a string array in `customData.mutex`:

```ts
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 100,
          title: "Task A",
          customData: { mutex: ["group1"] },
        },
        {
          startTime: 120,
          endTime: 180,
          title: "Task B",
          customData: { mutex: ["group1"] },
        },
      ],
    },
  ],
});
```

## How it works in the current implementation

The plugin registers this validation hook:

```ts
"validate:event:move"
```

That means it affects the interaction paths that call `canMoveEvent()`, including:

* dragging events
* resizing either event edge

If the target time range overlaps another event that shares any mutex tag, validation returns `false` and the interaction is blocked.

## Things to keep in mind

* `mutex` must be a string array
* The overlap check spans all tracks, not just the current one
* The plugin metadata name is currently `MutexGuardPlugin`

## Plugin ID

```ts
"MutexGuardPlugin@1.0.0"
```
