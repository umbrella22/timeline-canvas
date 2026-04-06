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
