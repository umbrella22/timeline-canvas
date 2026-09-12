---
title: Rendering
---

## Two extension points

### 1. RenderLayer

Use this when you want to draw at the very bottom or very top of the stack.

```ts
interface RenderLayer {
  name: string;
  position: "background" | "overlay";
  render: (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: TimelineConfig,
    state: TimelineState
  ) => void;
}
```

Position meanings:

- `background`: before the core layers
- `overlay`: after the core layers

### 2. CoreLayerHook

Use this when you want to wrap, modify, or replace core-layer rendering.

```ts
interface CoreLayerHook {
  name: string;
  target: "tracks" | "timeline" | "guideLines" | "indicator" | "scrollbar" | "interaction";
  handler: (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: TimelineConfig,
    state: TimelineState,
    next: () => void
  ) => void;
}
```

Notes:

- Call `next()` to continue the default render path
- Skip `next()` to fully replace that core layer
- Multiple hooks form a middleware-style chain

## RenderLayer example

```ts
context.api.registerRenderLayer({
  name: "grid-background",
  position: "background",
  render(ctx, canvas) {
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
    ctx.lineWidth = 1;

    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    ctx.restore();
  },
});
```

## CoreLayerHook example

```ts
context.api.registerCoreLayerHook({
  name: "timeline-watermark",
  target: "timeline",
  handler(ctx, canvas, _config, _state, next) {
    next();

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.font = "12px sans-serif";
    ctx.fillText("Preview", canvas.width - 64, 18);
    ctx.restore();
  },
});
```

## Current core-layer order

The source render order is:

- `background`
- `tracks`
- `timeline`
- `guideLines`
- `indicator`
- `interaction`
- `scrollbar`
- `overlay`

## Unified event content rendering renderEventContent (added in 1.6)

`TimelineOptions.renderEventContent` is the single entry point for the content of every visible event across normal, drag and resize phases; when omitted the core default text rendering is used. The callback receives an `EventContentRenderContext`: ctx, event, track, trackIndex/eventIndex, `rect` (full event block in CSS px, scroll-adjusted, including eventVerticalPadding), `clipRect` (intersection of the content with the drawable viewport, excluding the timeline axis and scrollbars), `phase: 'normal' | 'drag' | 'resize'`, selected/highlighted/readonly, dpr and `drawDefaultContent()` (executed at most once per invocation).

```ts
const timeline = new Timeline("canvas", {
  renderEventContent(context) {
    const { ctx, rect, event } = context;
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.fillText(String(event.title), rect.x + 8, rect.y + 6, rect.width - 16);
    ctx.restore();
    // skipping drawDefaultContent() takes over the content completely
  },
});
```

Constraints: context data is read-only; the order is background → media hook → custom/default content → selection border/handles and other decorations; a throwing callback is logged with a fixed error code and falls back to the default content (the media hook is not drawn twice) and rendering recovers on the next frame; the callback must not change the core hit rectangle or bypass readOnly.
