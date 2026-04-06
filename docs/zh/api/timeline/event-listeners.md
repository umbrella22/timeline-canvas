---
title: 事件监听 API
---

## 推荐方式

回调统一通过构造参数 `TimelineOptions` 传入：

```ts
const timeline = new Timeline("timelineCanvas", {
  onEventAdd: (data) => console.log("事件已添加", data),
  onEventUpdate: (data) => console.log("事件已更新", data),
  onEventDelete: (data) => console.log("事件已删除", data),
  onEventMove: (data) => console.log("事件已移动", data),
  onEventClick: (data) => console.log("事件已点击", data),
  onEventEdit: (data) => console.log("事件已编辑", data),
  onContextMenu: (data) => console.log("右键菜单触发", data),
  onTrackAdd: (track) => console.log("轨道已添加", track),
  onTrackRemove: (track) => console.log("轨道已删除", track),
  onTimeIndicatorMove: (data) => console.log("时间指示器移动", data),
  onZoom: (data) => console.log("缩放级别已改变", data),
  onStatusChange: (text) => console.log("状态", text),
  onEventHighlight: (data) => console.log("事件高亮变化", data),
  onTimeIndicatorHighlight: (data) =>
    console.log("时间指示器高亮变化", data),
});
```

## 数据变更回调

### onEventAdd(data: EventAddData)

```ts
interface EventAddData {
  trackIndex: number;
  event: TimelineEvent;
}
```

### onEventUpdate(data: EventUpdateData)

```ts
interface EventUpdateData {
  type?: "resize" | "split";
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  oldEvent?: TimelineEvent;
  firstEvent?: TimelineEvent;
  secondEvent?: TimelineEvent;
}
```

说明：

- 常规更新会带 `oldEvent`
- `splitEvent()` 成功后会通过同一个回调返回 `type: "split"`，并附带 `firstEvent` / `secondEvent`

### onEventDelete(data: EventDeleteData)

### onEventMove(data: EventMoveData)

### onEventEdit(data: EventEditData)

### onEventClick(data: EventClickData)

`onEventClick` / `onEventEdit` 的数据里会带上：

- `trackName`
- `formattedTimeRange`

## 轨道与界面回调

### onTrackAdd(track: Track)

### onTrackRemove(track: Track)

### onZoom(data: ZoomData)

### onStatusChange(statusText: string)

### onContextMenu(data: ContextMenuData)

当右键菜单项被触发时调用，`menuType` 对应配置项里的 `ContextMenuItem.type`。

### onTimeIndicatorMove(data: TimeIndicatorMoveData)

```ts
interface TimeIndicatorMoveData {
  position: number;
  time: string;
}
```

## 高亮相关回调

### onEventHighlight(data: EventHighlightData)

```ts
interface EventHighlightData {
  trackIndex: number | null;
  eventIndex: number | null;
  event: TimelineEvent | null;
}
```

说明：

- 当前实现主要在用户点击选中事件或清空选择时触发它
- `highlightEvent()` / `clearHighlight()` 这类程序化高亮接口目前不会自动触发该回调

### onTimeIndicatorHighlight(data: TimeIndicatorHighlightData)

```ts
interface TimeIndicatorHighlightData {
  position: number;
  highlightedEvents: Array<{
    trackIndex: number;
    eventIndex: number;
    event: TimelineEvent;
  }>;
}
```

说明：

- 只有高亮结果发生变化时才会触发
- `setTimeIndicator()` 会触发它
- `setTimeIndicatorDuringDrag()` 不会触发它
