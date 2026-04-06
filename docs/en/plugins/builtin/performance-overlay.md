---
title: PerformanceOverlayPlugin
---

Displays FPS, per-layer render timings, and performance sampling data.

## Basic usage

```ts
import { Timeline, PerformanceOverlayPlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  enablePerformanceMonitor: true,
});

await timeline.usePlugin(PerformanceOverlayPlugin);
```

## How it is enabled

This plugin does not take factory options. Visibility is controlled by:

- `enablePerformanceMonitor`
- `debug`

```ts
const timeline = new Timeline("timelineCanvas", {
  enablePerformanceMonitor: true,
  debug: false,
});

await timeline.usePlugin(PerformanceOverlayPlugin);
```

## What the overlay shows

Based on the current source implementation, the panel includes:

- FPS
- per-layer timings from the latest render
- aggregated stats from `PerformanceMonitor`

```ts
const layerTimes = timeline.getLastLayerTimes();
console.log(layerTimes);
```

## Interaction details

- The panel renders in the `overlay` layer
- It can be dragged around with the mouse
- If both `enablePerformanceMonitor` and `debug` are off, the plugin may remain loaded while the panel stays hidden

## Plugin ID

```ts
"performance-overlay@1.0.0"
```

