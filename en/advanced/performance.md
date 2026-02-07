Timeline Canvas performance mainly comes from three areas: layered rendering, indexed queries, and batch scheduling.

## Monitoring

### PerformanceOverlayPlugin

> Whether the performance panel is enabled is controlled by `TimelineOptions.enablePerformanceMonitor` or `TimelineOptions.debug`.

```ts
import { Timeline } from "timeline-canvas";
import { PerformanceOverlayPlugin } from "timeline-canvas/plugins";

const timeline = new Timeline("timelineCanvas", {
  enablePerformanceMonitor: true,
  debug: true,
});

await timeline.usePlugin(PerformanceOverlayPlugin);

const layerTimes = timeline.getLastLayerTimes();
console.log(layerTimes);
```

## 分层渲染与脏检查

Internally, `Timeline` uses `RenderPipeline` to split the canvas into logical layers (background / timeline / tracks / guideLines / indicator / interaction / scrollbar / overlay) and redraw only the affected layers.

### Manual redraw

```ts
timeline.markDirty();
timeline.markDirty(["tracks", "indicator"]);
```

### Recommendation: drive redraw via change notifications

When you manually mutate `timeline.config` or `timeline.state`, prefer calling `notifyChange(changeType)` so the scheduler can decide dirty-layer marking, derived state computation, and callback triggering.

```ts
timeline.config.readOnly = true;
timeline.notifyChange("config:readOnly");
```

## Batch updates

### Batch changes (reduce redraws)

```ts
timeline.beginChangeBatch();

timeline.addTrack();
for (let i = 0; i < 1000; i++) {
  timeline.addEvent(0, i * 10, i * 10 + 5, `Event ${i}`);
}

timeline.endChangeBatch();
```

### Batch indexing (heavy writes)

> For large add/update/delete operations, use index batching to reduce index rebuild overhead.

```ts
timeline.beginIndexBatch();
for (let i = 0; i < 1000; i++) {
  timeline.addEvent(0, i * 10, i * 10 + 5, `Event ${i}`);
}
timeline.endIndexBatch();
```

## Media rendering (EventMediaPlugin)

EventMediaPlugin renders images/waveforms inside event blocks and uses caching to reduce repeated decoding and draw cost.

```ts
import { EventMediaPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(EventMediaPlugin());

timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 30,
          title: "Waveform",
          media: { waveform: { data: [0.1, 0.5, -0.2] } },
        },
      ],
    },
  ],
});
```
