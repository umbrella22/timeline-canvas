> Timeline Canvas 使用秒制相对时间系统。构造函数接收的是 `TimelineOptions`，不是完整的 `TimelineConfig`。`TimelineConfig` 是内部合并默认值后的运行时配置。

## 你在构造函数里真正传入的类型

```ts
const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  canvasHeight: 600,
  trackHeight: 46,
  enableTimeIndicator: true,
  theme: LightThemePlugin,
  onZoom: (data) => console.log(data),
});
```

也就是说：

* 初始化参数请看 `TimelineOptions`
* 运行时内部完整配置请看 `TimelineConfig`
* 详细字段定义见 [类型定义](/timeline-canvas/api/timeline/types.md)

## 常用配置分组

### 时间与布局

```ts
const options = {
  startTime: 0,
  endTime: 3600,
  startPaddingTime: 10,
  endPaddingTime: 60,
  secondWidth: 0.022,
  canvasHeight: 600,
  timelineHeight: 60,
  trackHeight: 46,
  trackMargin: 10,
  firstTrackTopMargin: 16,
};
```

### 自动缩放与刻度

```ts
const options = {
  autoFitOnInit: true,
  minAutoFitZoom: 1,
  maxAutoFitZoom: 3,
  snapInterval: 15,
  snapToSeconds: true,
  secondPrecisionZoomThreshold: 1.5,
  scale: null,
  scaleSplitCount: 10,
  getScaleRender: null,
};
```

### 交互行为

```ts
const options = {
  enableTimeIndicator: true,
  enableEventResize: true,
  enableEventSplit: true,
  enableContextMenu: true,
  minEventDuration: 0.25,
  resizeHandleWidth: 8,
  readOnly: false,
  autoAddTrack: true,
  autoRemoveEmptyLastTrack: true,
};
```

### 时间指示器与边缘滚动

```ts
const options = {
  timeIndicatorWidth: 3,
  timeIndicatorSnapThreshold: 10,
  timeIndicatorHeadSize: 12,
  timeIndicatorTriangleHeight: 8,
  edgeScrollThrottle: 80,
  edgeScrollTriggerMargin: 30,
  edgeScrollViewportMargin: 50,
  guideLineSnapThreshold: 1,
};
```

### 文字、块样式与颜色

```ts
const options = {
  eventTextStyle: {
    showTitle: true,
    showTime: false,
    textAlign: "left",
  },
  eventBlockStyle: {
    borderRadius: 2,
    enableSelectionGlow: false,
  },
  colors: {
    timeIndicator: "#3F76FC",
  },
};
```

### 右键菜单

```ts
const options = {
  enableContextMenu: true,
  contextMenuItems: [
    { type: "edit", name: "编辑" },
    { type: "delete", name: "删除" },
  ],
  contextMenuStyle: {
    minWidth: 140,
  },
  contextMenuHtml: "<div>自定义菜单模板</div>",
};
```

### 插件与回调

```ts
const options = {
  theme: LightThemePlugin,
  onEventClick: (data) => console.log("事件点击", data),
  onZoom: (data) => console.log("缩放", data),
  onStatusChange: (text) => console.log("状态", text),
};
```

## 当前默认值中的几个关键点

来自源码默认配置的常用默认值：

* `autoFitOnInit: true`
* `enableTimeIndicator: true`
* `enableEventResize: true`
* `enableEventSplit: true`
* `enableContextMenu: true`
* `enablePerformanceMonitor: false`
* `readOnly: false`
* `snapInterval: 15`
* `minEventDuration: 0.25`
* `trackHeight: 80`
* `timelineHeight: 40`

## 运行时修改配置

如果你在实例创建后直接改 `timeline.config`，请记得配合 `notifyChange()`：

```ts
timeline.config.readOnly = true;
timeline.notifyChange("config:readOnly");

timeline.config.debug = true;
timeline.notifyChange("config:debug");
```

如果存在对应的公开方法，优先使用方法：

```ts
timeline.setReadOnly(true);
timeline.setDebug(true);
timeline.setEnableTimeIndicator(false);
timeline.setEndTime(7200);
```

## 完整示例

```ts
import { Timeline, LightThemePlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  endPaddingTime: 60,
  secondWidth: 0.022,
  canvasHeight: 600,
  trackHeight: 46,
  trackMargin: 10,
  firstTrackTopMargin: 16,
  timelineHeight: 60,
  enableEventResize: true,
  enableEventSplit: true,
  enableTimeIndicator: true,
  enableContextMenu: true,
  autoAddTrack: true,
  autoRemoveEmptyLastTrack: true,
  minEventDuration: 0.25,
  resizeHandleWidth: 8,
  snapInterval: 15,
  snapToSeconds: true,
  eventTextStyle: { showTitle: true, showTime: false },
  eventBlockStyle: { borderRadius: 2, enableSelectionGlow: false },
  theme: LightThemePlugin,
  onEventClick: (data) => console.log("事件点击", data),
  onZoom: (data) => console.log("缩放", data),
});
```
