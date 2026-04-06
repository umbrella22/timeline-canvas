Timeline Canvas performance comes from three main areas: layered rendering, indexed lookups, and batched state changes.

## Performance overlay

### PerformanceOverlayPlugin

> The overlay is controlled by `enablePerformanceMonitor` or `debug`.

```ts
import { Timeline, PerformanceOverlayPlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  enablePerformanceMonitor: true,
});

await timeline.usePlugin(PerformanceOverlayPlugin);

console.log(timeline.getLastLayerTimes());
```

The current overlay shows:

* FPS
* timing for each logical render layer
* aggregated sampling data from `PerformanceMonitor`

## Layered rendering and dirty checks

The source code uses `RenderPipeline` with this render order:

* `background`
* `tracks`
* `timeline`
* `guideLines`
* `indicator`
* `interaction`
* `scrollbar`
* `overlay`

Only dirty layers are redrawn.

### Mark layers dirty manually

```ts
timeline.markDirty(["tracks", "indicator"]);
```

### Prefer change notifications when possible

```ts
timeline.config.readOnly = true;
timeline.notifyChange("config:readOnly");
```

That lets the scheduler handle:

* derived state updates
* dirty-layer tracking
* any related callbacks

## Batch updates

### Batch state changes

```ts
timeline.beginChangeBatch();

timeline.addTrack();
for (let i = 0; i < 1000; i++) {
  timeline.addEvent(0, i * 10, i * 10 + 5, `Event ${i}`);
}

timeline.endChangeBatch();
```

### Batch index work

If you mutate low-level structures directly or perform large external writes, wrap the work in index batching:

```ts
timeline.beginIndexBatch();
// bulk mutations against timeline.state.tracks ...
timeline.endIndexBatch();
```

## Media-rendering cache strategy

`EventMediaPlugin` renders images and waveforms inside event blocks and uses multiple cache layers to reduce repeated work.

```ts
import { EventMediaPlugin } from "timeline-canvas";

await timeline.usePlugin(EventMediaPlugin());
```

The current implementation includes:

* `ImageBitmap` caching for images
* `Float32Array` caching for waveform data
* `OffscreenCanvas` pre-rendering for waveforms when supported
