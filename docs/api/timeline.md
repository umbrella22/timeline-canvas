# Timeline API

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

## 核心方法

### 数据管理

#### loadData(data: LoadDataFormat)

加载时间轴数据（秒制时间）。

```javascript
timeline.loadData({
  timeIndicatorPosition: 0,
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: "早班",
          description: "上午工作时段",
        },
      ],
    },
  ],
});
```

#### addEvent(trackIndex: number, startTime: number, endTime: number, title: string, description?: string, customData?: any, readonly?: boolean)

在指定轨道添加事件。

```javascript
timeline.addEvent(0, 1200, 1800, "自动生成的事件", "示例描述", {
  note: "示例",
});
```

#### updateEvent(trackIndex: number, eventIndex: number, updates: Partial<TimelineEvent>)

更新事件。

```javascript
timeline.updateEvent(0, 1, {
  title: "更新后的标题",
});
```

#### deleteEvent(trackIndex: number, eventIndex: number)

删除事件。

```javascript
timeline.deleteEvent(0, 1);
```

#### addTrack()

添加一个新的空轨道。

```javascript
timeline.addTrack();
```

#### removeTrack()

移除最后一个轨道。

```javascript
timeline.removeTrack();
```

#### autoRemoveEmptyLastTrack()

自动移除最后一个空轨道（如果存在）。

```javascript
timeline.autoRemoveEmptyLastTrack();
```

#### setEndTime(endTime: number)

设置时间轴结束时间（秒）。

```javascript
timeline.setEndTime(86400); // 设置结束时间为24小时
```

#### getEndTime(): number

获取时间轴结束时间（秒）。

```javascript
const endTime = timeline.getEndTime(); // 返回秒数
```

### 视图控制

#### setZoomLevel(zoomLevel: number)

设置缩放级别。

```javascript
timeline.setZoomLevel(2);
```

#### zoom(factor: number)

按因子缩放。

```javascript
timeline.zoom(1.2); // 放大 20%
timeline.zoom(0.8); // 缩小 20%
```

#### setTimeIndicator(seconds: number, applySnap?: boolean)

设置时间指示器位置（秒）。

```javascript
timeline.setTimeIndicator(18000);
```

#### setCanvasSize(width: number, height: number)

设置画布尺寸。

```javascript
timeline.setCanvasSize(800, 600);
```

#### adjustCanvasSize()

根据容器大小自动调整画布尺寸。

```javascript
timeline.adjustCanvasSize();
```

#### markDirty(layerIds?: string[])

标记画布图层为脏，触发重绘。如果不指定图层，将重绘所有图层。

```javascript
// 重绘所有图层
timeline.markDirty();

// 仅重绘特定图层
timeline.markDirty(["tracks", "indicator"]);
```

### 插件管理

#### usePlugin(plugin: any): Promise<boolean>

使用插件。

```javascript
// 某些内置插件是“工厂函数”（需要调用以传入配置）
timeline.usePlugin(ContextMenuPlugin());

// 某些内置插件是“插件对象”（直接传入）
timeline.usePlugin(PerformanceOverlayPlugin);
```

#### removePlugin(pluginId: string): Promise<boolean>

移除插件。

```javascript
timeline.removePlugin("performance-overlay@1.0.0");
```

#### setTheme(theme: 'light' | 'dark'): Promise<boolean>

在运行时切换内置主题。

```javascript
// 初始化时设置默认主题
const timeline = new Timeline("timelineCanvas", { theme: LightThemePlugin });

// 动态切换到暗色主题
await timeline.setTheme("dark");

// 切回亮色主题
await timeline.setTheme("light");
```

#### getLoadedPlugins(): any[]

获取已加载的插件列表。

```javascript
const plugins = timeline.getLoadedPlugins();
console.log("已加载插件:", plugins);
```

#### isPluginLoaded(pluginName: string): boolean

检查插件是否已加载。

```javascript
if (timeline.isPluginLoaded("performance-overlay")) {
  console.log("性能监控插件已加载");
}
```

### 事件监听

#### 回调事件（推荐，与 Demo 一致）

在初始化配置中传入回调：

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

## 配置属性

### 获取配置

```javascript
const config = timeline.config;
console.log("当前配置:", config);
```

### 获取状态

```javascript
const state = timeline.state;
console.log("当前状态:", state);
```

## 类型定义

### TimelineEvent

```typescript
interface TimelineEvent {
  id: number;
  startTime: number;
  endTime: number;
  duration: number;
  title: string;
  description: string;
  color: string;
  readonly?: boolean;
  customData?: Record<string, any>;
  media?: {
    images?: Array<{
      src: string;
      fit?: "cover" | "contain" | "stretch";
      opacity?: number;
    }>;
    waveform?: {
      data: Float32Array | number[];
      color?: string;
      backgroundColor?: string;
      opacity?: number;
    };
  };
}
```

### TimelineConfig（关键项）

```typescript
interface TimelineConfig {
  canvasHeight?: number;
  timelineHeight: number;
  trackHeight: number;
  trackMargin: number;
  firstTrackTopMargin: number;
  secondWidth: number;
  startTime: number;
  endTime: number;
  startPaddingTime: number;
  endPaddingTime: number;
  autoFitOnInit: boolean;
  minAutoFitZoom: number;
  maxAutoFitZoom: number;
  timeUnit: string;
  timeFormat: string;
  snapInterval: number;
  snapToSeconds: boolean;
  secondPrecisionZoomThreshold: number;
  enableTimeIndicator: boolean;
  enableEventResize: boolean;
  enableEventSplit: boolean;
  enableContextMenu: boolean;
  minEventDuration: number;
  resizeHandleWidth: number;
  debug: boolean;
  enablePerformanceMonitor: boolean;
  autoAddTrack: boolean;
  autoRemoveEmptyLastTrack: boolean;
  readOnly: boolean;
  showEventDurationLabel: boolean;
  eventTextStyle: EventTextStyle;
  eventBlockStyle: EventBlockStyle;
  colors: TimelineColors;
  contextMenuItems: ContextMenuItem[];
  contextMenuStyle: ContextMenuStyle;
  contextMenuHtml?: string | HTMLElement;
  // 回调事件...
}
```

### LoadDataFormat

```typescript
interface LoadDataFormat {
  timeIndicatorPosition?: number;
  tracks: Array<{
    events: Array<{
      startTime?: number;
      endTime?: number;
      duration?: number;
      title: string;
      description?: string;
      color?: string;
      readonly?: boolean;
      customData?: Record<string, any>;
    }>;
  }>;
}
```

## 完整示例

```javascript
// 创建时间轴（秒制系统）
const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  onEventClick: (data) => console.log("事件点击", data),
});

// 加载数据
timeline.loadData({
  tracks: [{ events: [{ startTime: 0, endTime: 900, title: "早班" }] }],
});

// 插件
timeline.usePlugin(ContextMenuPlugin());
timeline.usePlugin(PerformanceOverlayPlugin);

// 视图控制
timeline.zoom(1.2);
timeline.setTimeIndicator(600);
```
