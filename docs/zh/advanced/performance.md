---
title: 性能与监控
---

Timeline Canvas 的性能主要来自三部分：分层渲染、索引查询和批量调度。

## 性能面板

### PerformanceOverlayPlugin

> 面板是否显示由 `enablePerformanceMonitor` 或 `debug` 控制。

```ts
import { Timeline, PerformanceOverlayPlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  enablePerformanceMonitor: true,
});

await timeline.usePlugin(PerformanceOverlayPlugin);

console.log(timeline.getLastLayerTimes());
```

当前面板会显示：

- FPS
- 各逻辑层最近一次耗时
- 性能采样统计

## 分层渲染与脏检查

源码里的 `RenderPipeline` 会按以下顺序渲染逻辑层：

- `background`
- `tracks`
- `timeline`
- `guideLines`
- `indicator`
- `interaction`
- `scrollbar`
- `overlay`

只有被标记为脏的图层才会重绘。

### 手动标记脏层

```ts
timeline.markDirty(["tracks", "indicator"]);
```

### 更推荐的方式：通知变更

```ts
timeline.config.readOnly = true;
timeline.notifyChange("config:readOnly");
```

这样可以让调度器同时处理：

- 派生状态更新
- 脏层标记
- 必要回调

## 批量更新

### 批量变更

```ts
timeline.beginChangeBatch();

timeline.addTrack();
for (let i = 0; i < 1000; i++) {
  timeline.addEvent(0, i * 10, i * 10 + 5, `Event ${i}`);
}

timeline.endChangeBatch();
```

### 批量索引

当你直接修改底层数据结构或进行大量外部写入时，可以手动包裹索引批处理：

```ts
timeline.beginIndexBatch();
// 外部批量写入 timeline.state.tracks ...
timeline.endIndexBatch();
```

## 媒体渲染的缓存策略

`EventMediaPlugin` 会在事件块内部渲染图片和波形，并在源码中使用多级缓存减少重复开销。

```ts
import { EventMediaPlugin } from "timeline-canvas";

await timeline.usePlugin(EventMediaPlugin());
```

当前实现会做这些优化：

- 图片缓存为 `ImageBitmap`
- 波形缓存为 `Float32Array`
- 支持时优先使用 `OffscreenCanvas` 预渲染波形位图

