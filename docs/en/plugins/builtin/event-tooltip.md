---
title: EventTooltipPlugin
---

Shows a tooltip when an event title is truncated inside the event block.

## Basic usage

```ts
import { EventTooltipPlugin } from "timeline-canvas";

await timeline.usePlugin(EventTooltipPlugin());
```

## Options

```ts
await timeline.usePlugin(
  EventTooltipPlugin({
    showDelay: 300,
    maxWidth: 300,
    padding: 8,
    borderRadius: 4,
    backgroundColor: "#333",
    textColor: "#fff",
    borderColor: "#555",
    fontSize: 12,
    fontFamily: "Arial, sans-serif",
    htmlTemplate: (title) => {
      const label = document.createElement("strong");
      label.textContent = title;
      return label.outerHTML;
    },
  })
);
```

## Current behavior

- The tooltip appears only when the title text is actually truncated
- The default delay is `300ms`
- Hover hit-testing is throttled with `mousemove` plus `requestAnimationFrame`
- In HTML mode, an empty `htmlTemplate(title)` result falls back to canvas rendering
- Showing, moving or hiding a tooltip invalidates the overlay so the change appears on an otherwise idle timeline.
- `htmlTemplate` returns trusted markup. Insert external titles with `textContent` as in the example.

## Good fit for

- narrow event blocks
- dense timelines where full titles do not fit inline
- custom hover content rendered as HTML

## Plugin ID

```ts
"event-tooltip@1.0.0"
```

