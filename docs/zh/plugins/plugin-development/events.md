---
title: 事件系统
---

## 当前源码里真正存在的核心插件事件

### render:event:media

在事件块绘制阶段发出，供媒体类插件在事件块内部追加内容。

处理器签名：

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

示例：

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

在事件移动或 resize 校验路径中发出。只要任意处理器返回 `false`，本次操作就会被阻止。

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

## 当前不应当写进文档的核心事件

下面这些名字在当前源码里并没有作为核心插件事件发出：

- `render:background`
- `render:overlay`
- `validate:event:add`
- `validate:event:split`
- `event:click`
- `event:highlight`

如果你需要插入背景/覆盖层绘制，请使用：

- `registerRenderLayer()`
- `registerCoreLayerHook()`

## 执行顺序

事件处理器会按插件优先级排序执行：

1. `CRITICAL (200)`
2. `HIGH (100)`
3. `NORMAL (50)`
4. `LOW (0)`

同优先级下，按注册先后顺序执行。
