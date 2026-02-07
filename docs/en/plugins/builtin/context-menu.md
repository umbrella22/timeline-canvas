---
title: ContextMenuPlugin
---

> Context menu plugin. Menu items are driven by `TimelineConfig.contextMenuItems`. Optionally, you can take over rendering with an HTML template.

## Basic Usage

```ts
import { ContextMenuPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(ContextMenuPlugin());
```

## Enable & Menu Items

```ts
import { Timeline } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  enableContextMenu: true,
  contextMenuItems: [
    { type: "edit", name: "Edit" },
    { type: "delete", name: "Delete" },
    { type: "export", name: "Export" },
  ],
  onContextMenu: ({ menuType, trackIndex, eventIndex, event }) => {
    console.log(menuType, trackIndex, eventIndex, event);
  },
});
```

## HTML Override (Optional)

```ts
await timeline.usePlugin(ContextMenuPlugin({ htmlTemplate: "<div>...</div>" }));
```
