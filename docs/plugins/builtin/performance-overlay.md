# PerformanceOverlayPlugin

性能监控插件，显示 FPS、内存使用等性能指标。

## 基本用法

```javascript
import { PerformanceOverlayPlugin } from "timeline-canvas/plugins";

timeline.usePlugin(PerformanceOverlayPlugin);
```

## 配置选项

```javascript
timeline.usePlugin(PerformanceOverlayPlugin);
// 性能监控的开关和调试模式由 TimelineConfig 控制：
// enablePerformanceMonitor: true
// debug: true
```

## 配置接口

性能监控插件目前不接受直接的配置对象，而是依赖 `TimelineConfig` 中的 `enablePerformanceMonitor` 和 `debug` 选项。
