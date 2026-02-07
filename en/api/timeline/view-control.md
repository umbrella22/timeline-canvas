## setZoomLevel

`setZoomLevel(zoomLevel: number)`

Set the zoom level.

```ts
timeline.setZoomLevel(2);
```

## zoom

`zoom(factor: number)`

Zoom by a factor.

```ts
timeline.zoom(1.2); // zoom in by 20%
timeline.zoom(0.8); // zoom out by 20%
```

## setTimeIndicator

`setTimeIndicator(seconds: number, applySnap?: boolean)`

Set the time indicator position (seconds).

```ts
timeline.setTimeIndicator(18000);
```

## setCanvasSize

`setCanvasSize(width: number, height: number)`

Set canvas size.

```ts
timeline.setCanvasSize(800, 600);
```

## adjustCanvasSize

`adjustCanvasSize()`

Automatically adjust the canvas size based on the container.

```ts
timeline.adjustCanvasSize();
```

## getCanvas

`getCanvas(): HTMLCanvasElement`

Get the canvas element.

```ts
const canvas = timeline.getCanvas();
```

## markDirty

`markDirty(layerIds?: string[])`

Mark layers as dirty to trigger a redraw. If no layers are provided, all layers will be redrawn.

```ts
// Redraw all layers
timeline.markDirty();

// Redraw specific layers only
timeline.markDirty(["tracks", "indicator"]);
```

## notifyChange

`notifyChange(change: ChangeType)`

Notify a state change. The scheduler will handle dirty-layer marking, derived state computation, and callbacks.

```ts
timeline.notifyChange("data:load");
```

## beginChangeBatch

`beginChangeBatch()`

Begin a batch change session. Changes will not trigger redraws immediately until `endChangeBatch` is called.

```ts
timeline.beginChangeBatch();
// perform multiple changes...
timeline.endChangeBatch();
```

## endChangeBatch

`endChangeBatch()`

End a batch change session.

## getLastLayerTimes

`getLastLayerTimes(): Record<string, number>`

Get the last render timestamp for each layer.

```ts
const times = timeline.getLastLayerTimes();
console.log(times);
```

## getContentWidthForZoom

`getContentWidthForZoom(zoomLevel: number): number`

Get content width for a given zoom level.

```ts
const width = timeline.getContentWidthForZoom(1.0);
```

## hasHorizontalScrollbar

`hasHorizontalScrollbar(): boolean`

Check whether the horizontal scrollbar is shown.

```ts
if (timeline.hasHorizontalScrollbar()) {
  // ...
}
```

## getAvailableHeight

`getAvailableHeight(): number`

Get available height (minus scrollbars and other reserved space).

```ts
const height = timeline.getAvailableHeight();
```
