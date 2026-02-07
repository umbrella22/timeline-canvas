Timeline 类是核心类，提供了时间轴的主要能力（数据管理、视图控制、插件与事件回调）。

## 构造函数

```ts
class Timeline {
  constructor(canvasId: string, options?: TimelineOptions);
}
```

### 参数

* `canvasId`: 画布元素的 `id`
* `options`: 时间轴配置与回调（秒制时间系统，见 [类型定义](/timeline-canvas/api/timeline/types.md)）

### 示例

```ts
const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  canvasHeight: 600,
  trackHeight: 46,
  trackMargin: 10,
});
```

## 📋 API 目录

### [数据管理](/timeline-canvas/api/timeline/data-management.md)

* `loadData` - 加载数据
* `addEvent` - 添加事件
* `updateEvent` - 更新事件
* `deleteEvent` - 删除事件
* `addTrack` - 添加轨道
* `removeTrack` - 移除轨道
* `setEndTime` - 设置结束时间
* `beginIndexBatch` - 开始批量索引
* `endIndexBatch` - 结束批量索引

### [视图控制](/timeline-canvas/api/timeline/view-control.md)

* `setZoomLevel` - 设置缩放级别
* `zoom` - 缩放
* `setTimeIndicator` - 设置时间指示器
* `setCanvasSize` - 设置画布尺寸
* `markDirty` - 触发重绘
* `notifyChange` - 通知变更
* `beginChangeBatch` - 开始批量变更
* `endChangeBatch` - 结束批量变更

### [插件管理](/timeline-canvas/api/timeline/plugin-management.md)

* `usePlugin` - 使用插件
* `removePlugin` - 移除插件
* `setTheme` - 切换主题
* `getLoadedPlugins` - 获取已加载插件

### [事件监听](/timeline-canvas/api/timeline/event-listeners.md)

* `onEventAdd`
* `onEventUpdate`
* `onEventClick`
* ...更多回调事件

### [类型定义](/timeline-canvas/api/timeline/types.md)

* `TimelineEvent`
* `TimelineConfig`
* `LoadDataFormat`
