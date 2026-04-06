## Zoom and time indicator

### setZoomLevel(zoomLevel: number): boolean

Sets an absolute zoom level. Valid values are `1.0` through `1000.0`.

```ts
timeline.setZoomLevel(2);
```

### zoom(factor: number): void

Scales the current zoom level by a factor while trying to keep the viewport centered on the same time position.

```ts
timeline.zoom(1.2);
timeline.zoom(0.8);
```

### getZoomLevel(): number

```ts
const zoom = timeline.getZoomLevel();
```

### setTimeIndicator(seconds: number, applySnap = false): boolean

Moves the time indicator and scrolls it into view when needed.

```ts
timeline.setTimeIndicator(1800);
timeline.setTimeIndicator(1813, true);
```

Notes:

* The value is clamped between `startTime` and `endTime`
* When `applySnap` is `true`, snapping uses the current zoom and scale settings
* This method triggers `onTimeIndicatorMove`

### setTimeIndicatorDuringDrag(seconds: number): void

Lightweight variant used during dragging.

```ts
timeline.setTimeIndicatorDuringDrag(1813);
```

Notes:

* Triggers `timeIndicator:drag`
* Does not trigger `onTimeIndicatorMove`
* Does not trigger `onTimeIndicatorHighlight`
* Uses throttled edge scrolling

### setEnableTimeIndicator(enabled: boolean): void

```ts
timeline.setEnableTimeIndicator(false);
```

## Canvas sizing and rendering

### setCanvasSize(width: number, height: number): void

Sets the logical canvas size explicitly.

```ts
timeline.setCanvasSize(800, 600);
```

### adjustCanvasSize(): void

Recomputes scroll bounds and runs the `canvas:resize` redraw pipeline.

```ts
timeline.adjustCanvasSize();
```

> If the container size changes, call `setCanvasSize()` first to update the canvas dimensions, then `adjustCanvasSize()` if you need to recompute layout state explicitly.

### draw(): void

Forces an immediate draw.

```ts
timeline.draw();
```

### getCanvas(): HTMLCanvasElement

```ts
const canvas = timeline.getCanvas();
```

### getCanvasLogicalHeight(): number

```ts
const height = timeline.getCanvasLogicalHeight();
```

### getCachedLogicalHeight(): number

Returns the cached logical height from the render manager.

```ts
const cachedHeight = timeline.getCachedLogicalHeight();
```

### getContentWidthForZoom(zoomLevel: number): number

```ts
const width = timeline.getContentWidthForZoom(1.0);
```

### hasHorizontalScrollbar(): boolean

```ts
const visible = timeline.hasHorizontalScrollbar();
```

### getAvailableHeight(): number

```ts
const availableHeight = timeline.getAvailableHeight();
```

### getLastLayerTimes(): Record\<string, number>

Returns the per-layer timings from the most recent render.

```ts
const times = timeline.getLastLayerTimes();
```

### markDirty(layers): void

Marks specific layers as dirty. The current public signature expects an explicit array of layer names.

```ts
timeline.markDirty(["tracks", "indicator", "overlay"]);
```

Available layer names:

* `background`
* `tracks`
* `timeline`
* `guideLines`
* `indicator`
* `scrollbar`
* `overlay`
* `interaction`

### notifyChange(change: ChangeType): void

Use this after direct internal mutations so the scheduler can recompute derived state, mark dirty layers, and trigger any related callbacks.

```ts
timeline.config.readOnly = true;
timeline.notifyChange("config:readOnly");
```

Common `ChangeType` values:

* `events:add` / `events:update` / `events:delete` / `events:move` / `events:split`
* `zoom:change`
* `timeIndicator:move` / `timeIndicator:drag`
* `canvas:resize`
* `data:load`
* `theme:change`
* `interaction:hover` / `interaction:contextMenu` / `interaction:splitLine`
* `config:debug` / `config:timeIndicator` / `config:endTime` / `config:readOnly`

### beginChangeBatch(): void

### endChangeBatch(): void

Batches multiple state changes into a single redraw cycle.

```ts
timeline.beginChangeBatch();
timeline.setReadOnly(true);
timeline.setTimeIndicator(600);
timeline.endChangeBatch();
```

## Hit testing and guide lines

### getInteractionTarget(canvasX, canvasY): InteractionTarget

Returns track, event, and resize-handle hit information in a single query.

```ts
const target = timeline.getInteractionTarget(120, 48);
```

### getEventAtPosition(x, y)

```ts
const hit = timeline.getEventAtPosition(120, 48);
```

### getResizeHandle(x, y)

```ts
const handle = timeline.getResizeHandle(120, 48);
```

### calculateGuideLines(...)

Computes candidate guide lines for a drag target.

```ts
const guideLines = timeline.calculateGuideLines(0, 1, 0, 120, 30);
```

### snapToGuideLines(newStartTime, duration): number | null

```ts
const snapped = timeline.snapToGuideLines(120, 30);
```

### snapEdgeToGuideLines(edgeTime): number | null

Single-edge snapping for resize interactions.

```ts
const snappedEdge = timeline.snapEdgeToGuideLines(150);
```

### canMoveEvent(...): boolean

Checks whether an event can move to a target position. The current implementation validates:

* whether the time range is legal
* whether the destination track would overlap another event
* whether any plugin rejects the move via `validate:event:move`

```ts
const ok = timeline.canMoveEvent(0, 1, 0, 240, 60);
```

### showSplitLine(trackIndex, eventIndex, splitTime): void

### hideSplitLine(): void

### splitEvent(trackIndex, eventIndex, splitTime): boolean

Used to preview and execute event splitting.

```ts
timeline.showSplitLine(0, 1, 300);
timeline.splitEvent(0, 1, 300);
timeline.hideSplitLine();
```

Notes:

* The split point must leave both resulting events longer than `minEventDuration`
* A successful split reports through `onEventUpdate` with `type: "split"`

## State, highlight, and debugging

### setReadOnly(readOnly: boolean): void

```ts
timeline.setReadOnly(true);
```

Entering read-only mode clears current selection, drag state, guide lines, and context-menu state.

### isReadOnly(): boolean

```ts
const readonly = timeline.isReadOnly();
```

### highlightEvent(trackIndex, eventIndex): boolean

Highlights an event programmatically.

```ts
timeline.highlightEvent(0, 1);
```

### clearHighlight(): void

```ts
timeline.clearHighlight();
```

### getHighlightedEvent(): { trackIndex: number; eventIndex: number } | null

```ts
const highlighted = timeline.getHighlightedEvent();
```

> `highlightEvent()` and `clearHighlight()` update state and rendering, but they do not currently trigger `onEventHighlight`. That callback mainly comes from user-driven selection in the interaction layer.

### setDebug(enabled: boolean): void

```ts
timeline.setDebug(true);
```

### setStatus(text: string): void

### getStatus(): string

```ts
timeline.setStatus("Ready");
console.log(timeline.getStatus());
```
