# Timeline API 总览

Timeline 类是核心类，提供了时间轴的所有功能。

## 构造函数

```typescript
class Timeline {
  constructor(canvasOrId: string | HTMLCanvasElement, config: TimelineConfig);
}
```

### 参数

- `canvasOrId`: 画布元素或其 `id`
- `config`: 时间轴配置对象（秒制时间系统）

### 示例

```javascript
const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  canvasHeight: 600,
  trackHeight: 46,
  trackMargin: 10,
});
```

## 📋 API 目录

### [数据管理](./data-management)

- `loadData` - 加载数据
- `addEvent` - 添加事件
- `updateEvent` - 更新事件
- `deleteEvent` - 删除事件
- `addTrack` - 添加轨道
- `removeTrack` - 移除轨道
- `setEndTime` - 设置结束时间

### [视图控制](./view-control)

- `setZoomLevel` - 设置缩放级别
- `zoom` - 缩放
- `setTimeIndicator` - 设置时间指示器
- `setCanvasSize` - 设置画布尺寸
- `markDirty` - 触发重绘

### [插件管理](./plugin-management)

- `usePlugin` - 使用插件
- `removePlugin` - 移除插件
- `setTheme` - 切换主题
- `getLoadedPlugins` - 获取已加载插件

### [事件监听](./event-listeners)

- `onEventAdd`
- `onEventUpdate`
- `onEventClick`
- ...更多回调事件

### [类型定义](./types)

- `TimelineEvent`
- `TimelineConfig`
- `LoadDataFormat`
