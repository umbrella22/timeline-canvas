性能监控插件，用于显示 FPS、图层耗时和性能采样结果。

## 基本用法

```ts
import { Timeline, PerformanceOverlayPlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  enablePerformanceMonitor: true,
});

await timeline.usePlugin(PerformanceOverlayPlugin);
```

## 开关方式

该插件本身不接收工厂参数，显示与否由以下配置控制：

* `enablePerformanceMonitor`
* `debug`

```ts
const timeline = new Timeline("timelineCanvas", {
  enablePerformanceMonitor: true,
  debug: false,
});

await timeline.usePlugin(PerformanceOverlayPlugin);
```

## 当前面板里会显示什么

根据源码，面板会显示：

* FPS
* 最近一次渲染的各逻辑层耗时
* `PerformanceMonitor` 收集到的采样统计

```ts
const layerTimes = timeline.getLastLayerTimes();
console.log(layerTimes);
```

## 交互行为

* 面板绘制在 `overlay` 层
* 可以直接拖拽面板位置
* 当 `enablePerformanceMonitor` 和 `debug` 都关闭时，插件仍可保留加载状态，但面板会隐藏

## 插件 ID

```ts
"performance-overlay@1.0.0"
```
