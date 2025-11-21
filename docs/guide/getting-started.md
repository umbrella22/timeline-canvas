# 快速开始

## 安装

```bash
npm install timeline-canvas
# 或者
yarn add timeline-canvas
# 或者
pnpm add timeline-canvas
```

## 基础使用

### 1. 创建画布

```html
<canvas id="timelineCanvas" style="width: 100%; height: 600px;"></canvas>
```

### 2. 初始化时间轴（秒制时间系统）

```javascript
import { Timeline } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  startTime: 0,
  endTime: 3600,
  canvasHeight: 600,
  trackHeight: 46,
  trackMargin: 10,
});
```

### 3. 加载数据（秒制时间）

```javascript
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: "前端开发",
          description: "完成用户界面开发",
        },
      ],
    },
    {
      events: [
        {
          startTime: 1800,
          endTime: 2700,
          title: "设计评审",
          description: "UI/UX 设计评审会议",
        },
      ],
    },
  ],
});
```

### 4. 添加插件

````javascript
import { PerformanceOverlayPlugin, ContextMenuPlugin } from 'timeline-canvas/plugins';

// 添加性能监控插件（部分内置插件可直接传入实例）
timeline.usePlugin(PerformanceOverlayPlugin);

// 添加右键菜单插件（工厂函数形式）
timeline.usePlugin(ContextMenuPlugin({
  items: [
    {
      label: '查看详情',
      onClick: (event) => {
        console.log('查看事件:', event);
      }
    },
    {
      label: '删除事件',
      onClick: (event) => {
        // 使用轨道索引和事件索引删除
        timeline.deleteEvent(event.trackIndex, event.eventIndex);
      }
    }
  ]
}));

### 5. 回调参数参考

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
````

````

## 完整示例（与 Demo 一致的秒制用法）

```html
<!DOCTYPE html>
<html>
<head>
  <title>Timeline Canvas 示例</title>
  <style>
    #timeline-container {
      width: 100%;
      height: 600px;
      border: 1px solid #ccc;
    }
  </style>
</head>
<body>
  <canvas id="timelineCanvas"></canvas>

  <script type="module">
    import { Timeline } from 'timeline-canvas';
    import { PerformanceOverlayPlugin, ContextMenuPlugin } from 'timeline-canvas/plugins';

    const timeline = new Timeline('timelineCanvas', {
      startTime: 0,
      endTime: 3600
    });

    // 加载示例数据（秒制）
    timeline.loadData({
      tracks: [{ events: [{ startTime: 0, endTime: 900, title: '第一阶段开发' }] }]
    });

    // 添加插件
    timeline.usePlugin(PerformanceOverlayPlugin);
    timeline.usePlugin(ContextMenuPlugin());

    // 动态切换主题
    // 初始化为亮色主题
    timeline.usePlugin(LightThemePlugin);
    // 切换到暗色主题
    setTimeout(() => timeline.setTheme('dark'), 1000);
  </script>
</body>
</html>
````
