---
title: 性能与监控
---

Timeline Canvas 的性能主要来自三点：分层渲染、索引加速、批量调度。

## 性能监控

### PerformanceOverlayPlugin

> 性能面板是否启用由 `TimelineOptions.enablePerformanceMonitor` 或 `TimelineOptions.debug` 控制。

```ts
import { Timeline } from "timeline-canvas";
import { PerformanceOverlayPlugin } from "timeline-canvas/plugins";

const timeline = new Timeline("timelineCanvas", {
  enablePerformanceMonitor: true,
  debug: true,
});

await timeline.usePlugin(PerformanceOverlayPlugin);

const layerTimes = timeline.getLastLayerTimes();
console.log(layerTimes);
```

## 分层渲染与脏检查

Timeline 内部使用 `RenderPipeline` 将画布拆分为多个逻辑层（background / timeline / tracks / guideLines / indicator / interaction / scrollbar / overlay），只重绘受影响的图层。

### 手动触发重绘

```ts
timeline.markDirty();
timeline.markDirty(["tracks", "indicator"]);
```

### 建议：通过变更通知驱动重绘

当你手动修改了 `timeline.config` 或 `timeline.state`，更推荐调用 `notifyChange(changeType)`，让调度器决定脏层标记、派生状态计算与回调触发。

```ts
timeline.config.readOnly = true;
timeline.notifyChange("config:readOnly");
```

## 批量更新

### 批量变更（减少重绘次数）

```ts
timeline.beginChangeBatch();

timeline.addTrack();
for (let i = 0; i < 1000; i++) {
  timeline.addEvent(0, i * 10, i * 10 + 5, `Event ${i}`);
}

timeline.endChangeBatch();
```

### 批量索引（大量写入）

> 对大量 add/update/delete 操作，使用索引批处理减少索引重建开销。

```ts
timeline.beginIndexBatch();
for (let i = 0; i < 1000; i++) {
  timeline.addEvent(0, i * 10, i * 10 + 5, `Event ${i}`);
}
timeline.endIndexBatch();
```

## 多媒体渲染（EventMediaPlugin）

EventMediaPlugin 在事件块内部渲染图片/波形，并使用缓存降低重复解码与绘制成本。

```ts
import { EventMediaPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(EventMediaPlugin());

timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 30,
          title: "Waveform",
          media: { waveform: { data: [0.1, 0.5, -0.2] } },
        },
      ],
    },
  ],
});
```
