性能监控插件，显示 FPS、内存使用等性能指标。

## 基本用法

```ts
import { PerformanceOverlayPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(PerformanceOverlayPlugin);
```

## 配置选项

```ts
import { Timeline } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  enablePerformanceMonitor: true,
  debug: true,
});

await timeline.usePlugin(PerformanceOverlayPlugin);
```

## 配置接口

性能监控插件目前不接受直接的配置对象，而是依赖 `TimelineConfig` 中的 `enablePerformanceMonitor` 和 `debug` 选项。
