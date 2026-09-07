`Timeline` 是时间轴运行时的核心类，负责把数据、交互、渲染调度和插件系统组织在一起。

## 构造函数

```ts
import { Timeline, LightThemePlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  canvasHeight: 600,
  trackHeight: 46,
  trackMargin: 10,
  theme: LightThemePlugin,
});
```

### 参数

* `canvasId`: 目标 `<canvas>` 元素的 `id`
* `options`: 构造参数，类型为 `TimelineOptions`

### 公开属性

* `config`: 归一化后的运行时配置
* `callbacks`: 当前回调集合
* `state`: 当前运行时状态

> 如果你直接修改了 `timeline.config` 或 `timeline.state`，请配合调用 `notifyChange()`；如果已有对应方法，优先使用公开方法而不是直接改内部状态。

## API 目录

### [数据管理](/timeline-canvas/api/timeline/data-management.md)

* `loadData`
* `addEvent`
* `updateEvent`
* `updateEventData`
* `deleteEvent`
* `addTrack` / `removeTrack`
* `autoRemoveEmptyLastTrack`
* `setEndTime` / `getEndTime`
* `beginIndexBatch` / `endIndexBatch`
* `invalidateIndexTrack` / `invalidateIndexAll`

### [视图、交互与状态](/timeline-canvas/api/timeline/view-control.md)

* `setZoomLevel` / `zoom` / `getZoomLevel`
* `setTimeIndicator` / `setTimeIndicatorDuringDrag`
* `setCanvasSize` / `adjustCanvasSize` / `draw`
* `markDirty` / `notifyChange`
* `beginChangeBatch` / `endChangeBatch`
* `getInteractionTarget` / `getEventAtPosition` / `getResizeHandle`
* `calculateGuideLines` / `snapToGuideLines` / `snapEdgeToGuideLines`
* `canMoveEvent`
* `showSplitLine` / `hideSplitLine` / `splitEvent`
* `setReadOnly` / `isReadOnly`
* `highlightEvent` / `clearHighlight` / `getHighlightedEvent`
* `setDebug` / `setEnableTimeIndicator`
* `setStatus` / `getStatus`

### [插件管理](/timeline-canvas/api/timeline/plugin-management.md)

* `usePlugin`
* `removePlugin`
* `setTheme`
* `getLoadedPlugins`
* `isPluginLoaded`

### [事件回调](/timeline-canvas/api/timeline/event-listeners.md)

* `onEventAdd`
* `onEventUpdate`
* `onEventDelete`
* `onEventMove`
* `onEventClick`
* `onEventHighlight`
* `onTimeIndicatorHighlight`
* `onStatusChange`

### [类型定义](/timeline-canvas/api/timeline/types.md)

* `TimelineOptions`
* `TimelineConfig`
* `TimelineEvent`
* `InteractionTarget`
* `LoadDataFormat`

## 销毁实例

```ts
await timeline.destroy();
```

`destroy()` 会立即停止输入和绘制、释放画布缓冲，并返回一个等待插件清理完成的 Promise，包括尚未结束的初始化。重复调用返回相同的 Promise。在同步组件清理函数中，可以使用 `void timeline.destroy()` 发起清理。
