## 两种扩展方式

### 1. RenderLayer

用于在最底层或最顶层增加自定义绘制。

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

位置说明：

* `background`: 在核心层之前绘制
* `overlay`: 在核心层之后绘制

### 2. CoreLayerHook

用于包裹、修改或完全替换核心层的绘制行为。

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

说明：

* 调用 `next()` 表示继续执行默认渲染
* 不调用 `next()` 表示完全接管该核心层
* 多个 hook 会形成一条中间件链

## RenderLayer 示例

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

## CoreLayerHook 示例

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

## 当前核心层顺序

源码里的 `RenderPipeline` 渲染顺序是：

* `background`
* `tracks`
* `timeline`
* `guideLines`
* `indicator`
* `interaction`
* `scrollbar`
* `overlay`
