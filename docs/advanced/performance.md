# 性能与监控

Timeline Canvas 提供了多种性能优化和监控功能，确保在处理大量数据时仍能保持流畅的用户体验。

## 性能监控插件

### PerformanceOverlayPlugin

PerformanceOverlayPlugin 提供了实时的性能监控面板，显示关键的性能指标。

#### 安装和使用

```javascript
import { PerformanceOverlayPlugin } from "timeline-canvas/plugins";

// 基础使用
timeline.usePlugin(PerformanceOverlayPlugin());

// 自定义配置
timeline.usePlugin(
  PerformanceOverlayPlugin({
    position: "top-right", // 位置：top-left, top-right, bottom-left, bottom-right
    updateInterval: 1000, // 更新间隔（毫秒）
    showFPS: true, // 显示 FPS
    showMemory: true, // 显示内存使用
    draggable: true, // 可拖拽
    backgroundColor: "rgba(0,0,0,0.8)",
    textColor: "#ffffff",
  })
);
```

#### 监控指标

- **FPS (Frames Per Second)**: 每秒渲染帧数
- **渲染时间**: 每帧渲染耗时
- **事件数量**: 当前可见的事件总数
- **内存使用**: 浏览器内存占用（如果可用）
- **缩放级别**: 当前的缩放比例
- **可视范围**: 当前显示的时间范围

### 性能配置

#### TimelineConfig 中的性能选项

```javascript
const timeline = new Timeline(container, {
  // ... 其他配置

  performance: {
    enableVirtualization: true, // 启用虚拟化（默认 true）
    maxVisibleEvents: 1000, // 最大可见事件数（默认 1000）
    renderDebounce: 16, // 渲染防抖（毫秒，默认 16）
    enableImageSmoothing: true, // 启用图像平滑（默认 true）
    enableTextAntialiasing: true, // 启用文本抗锯齿（默认 true）
    cacheSize: 100, // 缓存大小（默认 100）
  },
});
```

## 虚拟化

### 什么是虚拟化

虚拟化是一种性能优化技术，只渲染当前可视区域内的事件，而不是渲染所有事件。这在处理大量数据时特别有用。

### 虚拟化工作原理

1. **可视区域计算**: 计算当前画布的可视时间范围
2. **事件过滤**: 只选择在可视时间范围内的事件
3. **空间过滤**: 进一步过滤不在当前滚动位置的事件
4. **增量渲染**: 只重新渲染发生变化的部分

### 虚拟化配置

```javascript
const timeline = new Timeline(container, {
  performance: {
    enableVirtualization: true,
    maxVisibleEvents: 1000, // 超过这个数量时触发虚拟化

    // 高级虚拟化配置
    virtualization: {
      bufferSize: 100, // 缓冲区大小（像素）
      threshold: 50, // 触发虚拟化的阈值
    },
  },
});
```

## 渲染优化

### 渲染架构优化

Timeline Canvas 采用了基于 `RenderPipeline` 的分层渲染架构，以最大化性能：

1. **分层渲染**: 整个画布被分为多个逻辑层（背景、时间轴、轨道、辅助线、指示器、交互、滚动条、覆盖层）。
2. **脏图层检查**: 系统会跟踪每个图层的状态。当发生交互（如拖拽事件）时，只有受影响的图层（如交互层）会被标记为"脏"并重新渲染，而静态图层（如背景、时间轴刻度）则会跳过渲染。
3. **独立上下文**: 每个渲染器都接收只读的 `RenderContext`，确保渲染逻辑的纯粹性和可预测性。

### 防抖和节流

```javascript
// 渲染防抖配置
const timeline = new Timeline(container, {
  performance: {
    renderDebounce: 16, // 16ms 防抖，约 60fps
  },
});

// 或者使用自定义防抖函数
let renderTimeout;
function optimizedRender() {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    timeline.render();
  }, 16);
}
```

### 缓存策略

```javascript
// 启用事件缓存
const timeline = new Timeline(container, {
  performance: {
    cacheSize: 100, // 缓存最近渲染的 100 个事件
  },
});

// 手动清除缓存
timeline.clearCache();
```

### 图像优化

```javascript
// 图像渲染优化
const timeline = new Timeline(container, {
  performance: {
    enableImageSmoothing: false, // 关闭图像平滑以提高性能
    imageCache: {
      maxSize: 50, // 图像缓存最大数量
      ttl: 300000, // 缓存时间（毫秒）
    },
  },
});
```

## 内存管理

### 自动清理

```javascript
// 配置自动清理
const timeline = new Timeline(container, {
  performance: {
    autoCleanup: {
      enabled: true, // 启用自动清理
      interval: 30000, // 清理间隔（毫秒）
      maxAge: 600000, // 最大缓存时间（毫秒）
    },
  },
});
```

### 手动内存管理

```javascript
// 手动清理内存
timeline.cleanup();

// 销毁时间轴（释放所有资源）
timeline.destroy();

// 移除事件数据
timeline.clearData();
```

## 性能监控最佳实践

### 1. 监控关键指标

```javascript
// 自定义性能监控
class CustomPerformanceMonitor {
  constructor(timeline) {
    this.timeline = timeline;
    this.metrics = [];
    this.startMonitoring();
  }

  startMonitoring() {
    this.timeline.on("render:start", () => {
      this.renderStartTime = performance.now();
    });

    this.timeline.on("render:end", () => {
      const renderTime = performance.now() - this.renderStartTime;
      this.recordMetric("renderTime", renderTime);
    });

    this.timeline.on("data:loaded", (data) => {
      this.recordMetric("eventCount", data.events.length);
    });
  }

  recordMetric(name, value) {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
    });

    // 保持最近 100 条记录
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }
  }

  getReport() {
    const renderTimes = this.metrics
      .filter((m) => m.name === "renderTime")
      .map((m) => m.value);

    return {
      avgRenderTime:
        renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
      maxRenderTime: Math.max(...renderTimes),
      minRenderTime: Math.min(...renderTimes),
      totalEvents: this.timeline.getEvents().length,
    };
  }
}

// 使用自定义监控器
const monitor = new CustomPerformanceMonitor(timeline);

// 定期获取性能报告
setInterval(() => {
  const report = monitor.getReport();
  console.log("性能报告:", report);
}, 5000);
```

### 2. 性能阈值警告

```javascript
// 设置性能阈值
const PERFORMANCE_THRESHOLDS = {
  renderTime: 50, // 渲染时间超过 50ms 警告
  fps: 30, // FPS 低于 30 警告
  memory: 100 * 1024 * 1024, // 内存使用超过 100MB 警告
};

// 监控性能阈值
timeline.on("render:end", () => {
  const renderTime = performance.now() - renderStartTime;

  if (renderTime > PERFORMANCE_THRESHOLDS.renderTime) {
    console.warn(`渲染时间超过阈值: ${renderTime}ms`);
  }
});

// 监控 FPS
let lastFrameTime = performance.now();
let frameCount = 0;

function checkFPS() {
  const currentTime = performance.now();
  const deltaTime = currentTime - lastFrameTime;

  if (deltaTime >= 1000) {
    const fps = (frameCount * 1000) / deltaTime;

    if (fps < PERFORMANCE_THRESHOLDS.fps) {
      console.warn(`FPS 低于阈值: ${fps}`);
    }

    frameCount = 0;
    lastFrameTime = currentTime;
  }

  frameCount++;
  requestAnimationFrame(checkFPS);
}

checkFPS();
```

### 3. 性能优化建议

```javascript
// 性能优化建议生成器
class PerformanceAdvisor {
  constructor(timeline) {
    this.timeline = timeline;
  }

  generateAdvice() {
    const advice = [];
    const config = this.timeline.config;
    const state = this.timeline.state;

    // 检查事件数量
    if (state.events.length > 1000) {
      advice.push({
        type: "warning",
        message: "事件数量过多，建议启用虚拟化",
        solution: "启用 performance.enableVirtualization",
      });
    }

    // 检查图像使用
    if (this.hasManyImages()) {
      advice.push({
        type: "warning",
        message: "检测到大量图像使用，建议启用图像缓存",
        solution: "配置 performance.imageCache",
      });
    }

    // 检查渲染频率
    if (this.isHighRenderFrequency()) {
      advice.push({
        type: "info",
        message: "渲染频率较高，建议增加防抖时间",
        solution: "增加 performance.renderDebounce",
      });
    }

    return advice;
  }

  hasManyImages() {
    // 实现图像数量检查逻辑
    return false;
  }

  isHighRenderFrequency() {
    // 实现渲染频率检查逻辑
    return false;
  }
}
```

## 性能测试

### 基准测试

```javascript
// 性能基准测试
async function performanceBenchmark(timeline) {
  const results = {};

  // 测试数据加载性能
  const loadStart = performance.now();
  await timeline.loadData(generateLargeDataset(1000));
  results.loadTime = performance.now() - loadStart;

  // 测试渲染性能
  const renderStart = performance.now();
  timeline.render();
  results.renderTime = performance.now() - renderStart;

  // 测试交互性能
  const interactionStart = performance.now();
  timeline.zoomIn();
  timeline.zoomOut();
  results.interactionTime = performance.now() - interactionStart;

  return results;
}

// 生成测试数据
function generateLargeDataset(eventCount) {
  const events = [];
  const startDate = new Date("2024-01-01");

  for (let i = 0; i < eventCount; i++) {
    const eventStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const eventEnd = new Date(eventStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    events.push({
      id: `event-${i}`,
      trackId: "track1",
      startDate: eventStart,
      endDate: eventEnd,
      type: "default",
      title: `事件 ${i}`,
      description: `这是事件 ${i} 的描述`,
    });
  }

  return { events };
}
```

## 批量操作优化

当需要一次性添加或修改大量事件时，频繁触发索引更新可能会影响性能。Timeline Canvas 提供了批量操作 API 来优化这种情况。

### 批量更新索引

使用 `beginIndexBatch()` 和 `endIndexBatch()` 来暂停和恢复索引更新。

```javascript
// 开始批量操作
timeline.beginIndexBatch();

// 执行大量操作
for (let i = 0; i < 1000; i++) {
  timeline.addEvent(0, i * 100, i * 100 + 50, `Event ${i}`);
}

// 结束批量操作，触发一次性索引重建
timeline.endIndexBatch();
```
