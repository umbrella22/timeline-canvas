## Core plugin events that actually exist in the current source

### render:event:media

Fires during event rendering so media-style plugins can draw inside event blocks.

Handler signature:

```ts
type RenderEventMediaHandler = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  config: TimelineConfig,
  state: TimelineState,
  trackIndex: number,
  eventIndex: number,
  eventX: number,
  trackY: number,
  eventWidth: number,
  eventVerticalPadding: number,
  eventHeight: number
) => void;
```

Example:

```ts
context.api.registerEventHandler("render:event:media", (
  ctx,
  _canvas,
  _config,
  state,
  trackIndex,
  eventIndex,
  eventX,
  trackY,
  eventWidth,
  eventVerticalPadding,
  eventHeight
) => {
  const event = state.tracks[trackIndex].events[eventIndex];
  if (!event.customData?.badge) return;

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillText(
    String(event.customData.badge),
    eventX + 8,
    trackY + eventVerticalPadding + eventHeight / 2
  );
  ctx.restore();
});
```

### validate:event:move

Fires during move and resize validation. If any handler returns `false`, the interaction is blocked.

```ts
context.api.registerEventHandler("validate:event:move", (payload) => {
  if (!payload || typeof payload !== "object") {
    return true;
  }

  const data = payload as {
    newStartTime: number;
    duration: number;
  };

  return data.newStartTime >= 0 && data.duration > 0;
});
```

## Event names you should not rely on

These names are not emitted as core plugin events in the current source:

* `render:background`
* `render:overlay`
* `validate:event:add`
* `validate:event:split`
* `event:click`
* `event:highlight`

If you need background or overlay drawing, use:

* `registerRenderLayer()`
* `registerCoreLayerHook()`

## Execution order

Handlers run in plugin-priority order:

1. `CRITICAL (200)`
2. `HIGH (100)`
3. `NORMAL (50)`
4. `LOW (0)`

Within the same priority, handlers run in registration order.
