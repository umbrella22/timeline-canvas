# Timeline Canvas

一个基于 HTML5 Canvas 和 TypeScript 构建的强大、高性能时间轴组件。

[文档地址](https://umbrella22.github.io/timeline-canvas/index.html)

## 特性

- 🚀 **高性能**: 基于 Canvas API 构建，可流畅渲染大量数据。
- 🎨 **主题支持**: 内置亮色和暗色主题，支持自定义主题。
- 🖱️ **交互丰富**:
  - 拖拽移动事件。
  - 从两端调整事件大小。
  - 双击切割事件。
  - 缩放 (Ctrl/Cmd + 滚动) 和平移。
  - 支持右键菜单。
- 📏 **智能辅助线**: 对齐辅助线和吸附功能，实现精确的事件放置。
- ⏱️ **时间指示器**: 可拖动的时间头，支持吸附。
- 🔌 **插件系统**: 可扩展架构，内置主题、右键菜单等插件。
- 📝 **TypeScript**: 使用 TypeScript 编写，提供完整的类型定义。

## 安装

```bash
npm install timeline-canvas
# or
pnpm add timeline-canvas
# or
yarn add timeline-canvas
```

## 基础用法

1. 在 HTML 中创建一个包含 canvas 元素的容器：

```html
<div style="width: 100%; height: 500px;">
  <canvas id="timeline-canvas"></canvas>
</div>
```

1. 初始化 Timeline：

```typescript
import { Timeline } from "timeline-canvas";

// 初始化
const timeline = new Timeline("timeline-canvas", {
  startTime: 0,
  endTime: 100,
  trackHeight: 40,
  // ... 其他选项
});

// 添加一个轨道
timeline.addTrack();

// 添加一个事件 (轨道索引, 开始时间, 结束时间, 标题)
timeline.addEvent(0, 10, 30, "我的事件", "描述信息");
```

## 配置

`Timeline` 构造函数接受一个配置对象：

```typescript
interface TimelineOptions {
  // 尺寸设置
  canvasHeight?: number;
  trackHeight?: number;
  trackMargin?: number;
  timelineHeight?: number;

  // 时间设置
  startTime?: number;
  endTime?: number;
  secondWidth?: number; // 每秒对应的像素宽度
  snapInterval?: number;
  snapToSeconds?: boolean;

  // 功能开关
  enableTimeIndicator?: boolean;
  enableEventResize?: boolean;
  enableEventSplit?: boolean;
  enableContextMenu?: boolean;
  readOnly?: boolean;
  autoAddTrack?: boolean;

  // 样式设置
  colors?: Partial<TimelineColors>;
  eventTextStyle?: Partial<EventTextStyle>;
  theme?: TimelinePlugin; // 初始主题

  // 回调函数
  onEventAdd?: (data: EventAddData) => void;
  onEventUpdate?: (data: EventUpdateData) => void;
  onEventClick?: (data: EventClickData) => void;
  // ... 更多回调
}
```

## API 参考

### 核心方法

- **`addTrack()`**: 添加一个新的空轨道。
- **`removeTrack()`**: 移除最后一个轨道。
- **`addEvent(trackIndex, startTime, endTime, title, ...)`**: 向指定轨道添加事件。
- **`updateEvent(trackIndex, eventIndex, updates)`**: 更新现有事件。
- **`deleteEvent(trackIndex, eventIndex)`**: 删除事件。
- **`loadData(data)`**: 从 JSON 对象加载轨道和事件数据。
- **`setZoomLevel(level)`**: 设置缩放级别 (默认为 1.0)。
- **`setTimeIndicator(seconds)`**: 将时间指示器移动到指定时间。
- **`setTheme('light' | 'dark')`**: 切换内置主题。

### 插件

本库自带几个内置插件：

- **`DarkThemePlugin`**: 暗色模式主题。
- **`LightThemePlugin`**: 亮色模式主题 (默认)。
- **`ContextMenuPlugin`**: 添加右键菜单支持。
- **`PerformanceOverlayPlugin`**: 显示 FPS 和渲染时间，用于调试。
- **`EventMediaPlugin`**: 支持在事件内渲染媒体内容（图片、波形图）。

使用方法：

```typescript
import { Timeline, PerformanceOverlayPlugin } from "timeline-canvas";

const timeline = new Timeline("canvas-id");
timeline.usePlugin(new PerformanceOverlayPlugin());
```

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建库
pnpm build

# 运行文档站点
pnpm docs:dev
```

## 许可证

MIT
