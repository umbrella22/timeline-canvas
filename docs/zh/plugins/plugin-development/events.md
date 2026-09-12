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

## 已知事件的强类型注册（1.6 新增）

`registerEventHandler` / `unregisterEventHandler` / `emitEvent` / `validateEvent` 现在对已知事件键提供精确 tuple 类型（`PluginEventMap`）；自定义字符串扩展仍走宽泛 `(...args: unknown[]) => unknown` 边界。对变量事件名的动态路径，类型保证上限是 `unknown` 扩展。

```ts
// 已知键：载荷类型精确（错误形状会被编译器拒绝）
context.api.registerEventHandler("validate:event:move", (payload) => {
  return Number.isFinite(payload.toTrackIndex); // 载荷必含 toTrackIndex
});

// 自定义扩展：保持 unknown 边界
context.api.registerEventHandler("my:custom:event", (payload: unknown) => payload !== null);
```

当前已知键与载荷：

- `render:event:media`：`(ctx, canvas, config, state, trackIndex, eventIndex, eventX, trackY, eventWidth, eventVerticalPadding, eventHeight)`（11 元组，与 `EventsRenderer` 的发射一致；拖动帧中拖动事件的可见表示由 `InteractionRenderer` 发射一次）
- `validate:event:move`：单个载荷对象 `{ fromTrackIndex, fromEventIndex, toTrackIndex, newStartTime, duration }`
