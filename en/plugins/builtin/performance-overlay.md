Performance overlay plugin. Displays FPS, memory usage, and other metrics.

## Basic Usage

```ts
import { PerformanceOverlayPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(PerformanceOverlayPlugin);
```

## Configuration

```ts
import { Timeline } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  enablePerformanceMonitor: true,
  debug: true,
});

await timeline.usePlugin(PerformanceOverlayPlugin);
```

## Notes

This plugin does not currently take a direct options object. It relies on `TimelineConfig.enablePerformanceMonitor` and `TimelineConfig.debug`.
