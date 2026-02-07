---
title: MutexGuardPlugin
---

Event mutex plugin. Prevents events in the same mutex group from overlapping in time.

## Basic Usage

```ts
import { MutexGuardPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(MutexGuardPlugin());
```

## Configure Mutex Groups

Set `customData.mutex` on an event to specify which mutex group(s) it belongs to.

```ts
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 100,
          title: "Task A",
          customData: { mutex: ["group1"] }, // belongs to group1
        },
        {
          startTime: 50,
          endTime: 150,
          title: "Task B",
          customData: { mutex: ["group1"] }, // also in group1; cannot overlap with Task A
        },
      ],
    },
  ],
});
```

## How It Works

When the user moves or resizes an event, the plugin checks whether the target range overlaps with other events in the same mutex group. If it does, the action will be blocked or rolled back.
