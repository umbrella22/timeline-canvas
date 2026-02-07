Event tooltip plugin. Shows details when you hover over an event.

## Basic Usage

```ts
import { EventTooltipPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(EventTooltipPlugin());
```

## Options

```ts
await timeline.usePlugin(
  EventTooltipPlugin({
    showDelay: 300,
    maxWidth: 300,
    backgroundColor: "#333",
    textColor: "#fff",
    htmlTemplate: (title) => `<div><strong>${title}</strong></div>`,
  })
);
```
