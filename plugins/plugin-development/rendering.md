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

## 统一事件内容绘制 renderEventContent（1.6 新增）

`TimelineOptions.renderEventContent` 是普通、拖动、拉伸阶段所有可见任务内容的统一入口；未配置时使用核心默认文字绘制。回调收到 `EventContentRenderContext`：ctx、event、track、trackIndex/eventIndex、`rect`（事件块完整矩形，CSS px，已扣 scroll，含 eventVerticalPadding）、`clipRect`（内容与可绘制视口交集，已排除时间轴与滚动条）、`phase: 'normal' | 'drag' | 'resize'`、selected/highlighted/readonly、dpr 与 `drawDefaultContent()`（一次调用内至多执行一次）。

```ts
const timeline = new Timeline("canvas", {
  renderEventContent(context) {
    const { ctx, rect, event } = context;
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.fillText(String(event.title), rect.x + 8, rect.y + 6, rect.width - 16);
    ctx.restore();
    // 不调用 drawDefaultContent() 即完全接管内容
  },
});
```

约束：所有上下文数据只读；绘制顺序为 背景 → 媒体 hook → 自定义/默认内容 → 选中边框/手柄等交互装饰；回调抛异常时以固定错误码记录并回退默认内容（不会重复绘制媒体），下一帧即可恢复；不允许通过该回调改变核心命中矩形或绕过 readOnly。
