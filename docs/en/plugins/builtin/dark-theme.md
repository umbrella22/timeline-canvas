---
title: DarkThemePlugin
---

Dark theme plugin. Applies a dark color palette and draws the background layer.

## Basic Usage

```ts
import { DarkThemePlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(DarkThemePlugin);

// Or use the convenience method
await timeline.setTheme("dark");
```

## Switching Themes at Runtime

```ts
import { Timeline } from "timeline-canvas";
import { LightThemePlugin } from "timeline-canvas/plugins";

// Set default theme at initialization
const timeline = new Timeline("timelineCanvas", { theme: LightThemePlugin });

// Switch at runtime
await timeline.setTheme("dark");
// Switch back to light
await timeline.setTheme("light");
```

Tip: For a custom theme, follow the plugin development guide to implement your own theme plugin.
