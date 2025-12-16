# 使用与示例

## 基础配置

### 时间轴配置（秒制系统）

```javascript
const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  secondWidth: 0.022,
  trackHeight: 46,
  trackMargin: 10,
  enableEventResize: true,
  enableEventSplit: true,
  enableTimeIndicator: true,
});
```

### 事件类型

Timeline Canvas 使用秒-based 时间系统，所有时间值都是从时间起点开始的相对秒数，而不是绝对时间戳。

#### 时间系统说明

Timeline Canvas 使用相对时间系统（秒-based），而不是绝对时间戳：

* **startTime**: 时间轴起点，通常为 0 秒
* **endTime**: 时间轴终点，以秒为单位
* **事件时间**: 所有事件使用 `startTime` 和 `endTime` 属性，表示从时间起点开始的秒数

#### 时间转换示例

```javascript
// 时间配置示例（秒-based 系统）：
const timelineConfig = {
  startTime: 0, // 时间起点（0秒）
  endTime: 3600, // 时间终点（1小时 = 3600秒）
};

// 事件时间示例：
const events = [
  {
    startTime: 0, // 0秒开始
    endTime: 900, // 15分钟结束（15*60=900秒）
    title: "早班",
  },
  {
    startTime: 1800, // 30分钟开始（30*60=1800秒）
    endTime: 3600, // 1小时结束（1*3600=3600秒）
    title: "晚班",
  },
];
```

#### 常见时间换算

* 1 分钟 = 60 秒
* 1 小时 = 3600 秒
* 1 天 = 86400 秒
* 工作时间（9-18 点）：startTime: 32400, endTime: 64800 (9*3600, 18*3600)
* 跨午夜事件：startTime: 82800, endTime: 90000 (23 小时到次日 1 小时)

```javascript
// 加载数据（每个轨道包含 events 列表）
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: "开发阶段",
          description: "核心功能开发",
        },
      ],
    },
    { events: [{ startTime: 1800, endTime: 1800, title: "需求评审" }] },
  ],
});
```

## 交互功能

### 缩放与时间指示器

```javascript
// 按因子缩放
timeline.zoom(1.2);
timeline.zoom(0.8);

// 设置时间指示器位置（秒）
timeline.setTimeIndicator(600);
```

### 事件操作

```javascript
// 添加事件（轨道索引、开始/结束秒数、标题等）
timeline.addEvent(0, 1200, 1500, "新任务");

// 更新事件（轨道索引 + 事件索引）
timeline.updateEvent(0, 0, { title: "更新后的标题" });

// 删除事件（轨道索引 + 事件索引）
timeline.deleteEvent(0, 0);
```

## 插件使用示例

### 性能监控插件

```javascript
import { PerformanceOverlayPlugin } from "timeline-canvas/plugins";

// 基础使用
timeline.usePlugin(PerformanceOverlayPlugin);

// 性能监控的开关和调试模式由 TimelineConfig 控制
// enablePerformanceMonitor: true
// debug: true
```

### 上下文菜单插件

```javascript
import { ContextMenuPlugin } from "timeline-canvas/plugins";

timeline.usePlugin(
  ContextMenuPlugin({
    useHtml: true, // 是否使用 HTML 渲染菜单
    htmlTemplate: "<div>...</div>", // 可选的 HTML 模板
  })
);

// 菜单项内容目前主要通过 TimelineConfig.contextMenuItems 配置
```

### 主题插件

```javascript
import { LightThemePlugin, DarkThemePlugin } from "timeline-canvas/plugins";

// 使用亮色主题
timeline.usePlugin(LightThemePlugin);

// 或者使用暗色主题
timeline.usePlugin(DarkThemePlugin);
```

### 媒体插件

```javascript
import { EventMediaPlugin } from "timeline-canvas/plugins";

timeline.usePlugin(EventMediaPlugin());

// 加载带有媒体的事件
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 3600,
          title: "媒体事件",
          media: {
            images: [
              {
                src: "path/to/image.jpg",
                fit: "cover", // 'cover', 'contain', 'stretch'
                opacity: 0.8,
              },
            ],
            waveform: {
              data: [0.1, 0.5, -0.2], // 音频采样数据
              color: "#1890ff",
              opacity: 0.6,
            },
          },
        },
      ],
    },
  ],
});
```

## 事件监听（推荐：配置回调）

```javascript
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

### 回调参数参考

```typescript
// 事件添加回调数据
interface EventAddData {
  trackIndex: number;
  event: TimelineEvent;
}

// 事件更新回调数据
interface EventUpdateData {
  type?: "resize" | "split";
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  oldEvent?: TimelineEvent;
  firstEvent?: TimelineEvent; // 仅在 split 类型时存在
  secondEvent?: TimelineEvent; // 仅在 split 类型时存在
}

// 事件点击回调数据
interface EventClickData {
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
  trackName: string;
  formattedTimeRange: string;
}

// 右键菜单回调数据
interface ContextMenuData {
  menuType: string;
  trackIndex: number;
  eventIndex: number;
  event: TimelineEvent;
}
```

## 主题切换

```javascript
// 初始化为亮色主题
timeline.usePlugin(LightThemePlugin);

// 在运行时切换为暗色主题
timeline.setTheme("dark");

// 切回亮色
timeline.setTheme("light");
```

## 响应式配置

```javascript
// 手动调整大小
window.addEventListener("resize", () => {
  const container = document.getElementById("timeline-container");
  if (container) {
    timeline.setCanvasSize(container.clientWidth, container.clientHeight);
  }
});
```

```
```
