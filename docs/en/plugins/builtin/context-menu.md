---
title: ContextMenuPlugin
---

> Adds a context menu for event interactions. Menu items come from `contextMenuItems`, and rendering can be handed off to custom HTML if needed.

## Basic usage

```ts
import { Timeline, ContextMenuPlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  enableContextMenu: true,
});

await timeline.usePlugin(ContextMenuPlugin());
```

If you prefer the stable subpath:

```ts
import { ContextMenuPlugin } from "timeline-canvas/builtin-plugin/ContextMenuPlugin";
```

## Menu items

```ts
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

await timeline.usePlugin(ContextMenuPlugin());
```

## HTML takeover

You can pass a template string through the factory:

```ts
await timeline.usePlugin(
  ContextMenuPlugin({
    htmlTemplate: "<div class='my-menu'>Custom menu</div>",
  })
);
```

Or through constructor config:

```ts
const timeline = new Timeline("timelineCanvas", {
  enableContextMenu: true,
  contextMenuHtml: "<div class='my-menu'>Custom menu</div>",
});
```

Notes:

- The factory `htmlTemplate` takes precedence over `contextMenuHtml`
- If the template is empty, the plugin falls back to canvas rendering
- Only string-valued `contextMenuHtml` is treated as a template by the current implementation

## Runtime behavior

- In canvas mode, the menu is drawn in the `overlay` layer
- In HTML mode, the plugin mounts an absolutely positioned container under the canvas parent
- When the menu closes, the plugin hides or removes that container automatically

## Plugin ID

```ts
"context-menu@1.0.0"
```

