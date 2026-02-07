---
title: 事件监听 API
---

## 回调事件（推荐）

在初始化配置中传入回调：

```ts
const timeline = new Timeline("timelineCanvas", {
  onEventAdd: (data) => console.log("事件已添加", data),
  onEventUpdate: (data) => console.log("事件已更新", data),
  onEventDelete: (data) => console.log("事件已删除", data),
  onEventMove: (data) => console.log("事件已移动", data),
  onEventClick: (data) => console.log("事件已点击", data),
  onEventEdit: (data) => console.log("事件已编辑", data),
  onTimeIndicatorHighlight: (data) => console.log("时间指示器高亮", data),
  onContextMenu: (data) => console.log("右键菜单触发", data),
  onTrackAdd: (track) => console.log("轨道已添加", track),
  onTrackRemove: (track) => console.log("轨道已删除", track),
  onTimeIndicatorMove: (data) => console.log("时间指示器移动", data),
  onZoom: (data) => console.log("缩放级别已改变", data),
  onStatusChange: (text) => console.log("状态", text),
});
```
