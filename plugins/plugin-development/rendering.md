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

### 回调绘图状态与注册名称

每个背景层、覆盖层和 `render:event:media` 处理器都有本次回调专用的 2D 上下文。回调返回时，渲染器恢复变换、样式和裁剪，即使 `save()` 与 `restore()` 次数不匹配。某个图层抛错后，其余回调和当前帧合成继续执行，已画出的像素保留。绘制应在回调内同步使用传入的 `ctx`。

核心层 hook 可以在 `next()` 外包裹变换或裁剪。每次回调的 `next()` 最多执行一次，回调返回即失效。在调用 `next()` 前抛错时，渲染器恢复当前 hook 的绘图状态，继续后续链。在调用后抛错时，后续绘制只保留已执行的一次。

图层和 hook 使用独立的名称表。在各自表内，同名项以最后一次注册为准。每个插件可注销自己的条目。覆盖项卸载或激活失败回滚时，恢复该名称下最近一次仍然有效的注册。不同名称之间按插件优先级降序执行，同优先级按注册顺序执行。

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

排程草稿的 `rect` 位于目标轨候选位置。媒体处理器和内容回调收到已确认事件及其源轨下标，即使源轨已经滚出视口。`commitState` 区分预览、等待确认和待核对状态。
