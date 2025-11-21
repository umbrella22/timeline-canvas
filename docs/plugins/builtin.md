# 内置插件

Timeline Canvas 提供了多个内置插件，可以通过 `timeline.usePlugin()` 方法使用。

## 📋 插件目录

### [基础插件](#基础插件)

- [ContextMenuPlugin](#contextmenuplugin) - 右键菜单插件
- [LightThemePlugin](#lightthemeplugin) - 亮色主题插件
- [DarkThemePlugin](#darkthemeplugin) - 暗色主题插件
- [PerformanceOverlayPlugin](#performanceoverlayplugin) - 性能监控插件

### [媒体插件](#媒体插件)

- [EventMediaPlugin](#eventmediaplugin) - 事件媒体插件

### [功能插件](#功能插件)

- [MutexGuardPlugin](#mutexguardplugin) - 事件互斥插件

---

## 基础插件

### ContextMenuPlugin

右键菜单插件，支持 Canvas 和 HTML 两种渲染模式。

#### 基本用法

```javascript
import { ContextMenuPlugin } from "timeline-canvas/plugins";

timeline.usePlugin(ContextMenuPlugin());
```

#### 配置选项

```javascript
timeline.usePlugin(
  ContextMenuPlugin({
    useHtml: true, // 是否使用 HTML 渲染菜单
    htmlTemplate: "<div>...</div>", // 可选的 HTML 模板
  })
);
```

#### 菜单项配置

```typescript
interface MenuItem {
  type?: string; // 'separator' 等
  name: string; // 菜单项文本
}
```

#### 高级用法

```javascript
// 动态菜单项
timeline.usePlugin(
  ContextMenuPlugin({
    useHtml: true,
  })
);
// 菜单项内容目前主要通过 TimelineConfig.contextMenuItems 配置
```

---

### LightThemePlugin

亮色主题插件，设置时间轴的亮色配色并绘制背景层。

#### 基本用法

```javascript
import { LightThemePlugin } from "timeline-canvas/plugins";

timeline.usePlugin(LightThemePlugin);
```

---

### DarkThemePlugin

暗色主题插件，设置时间轴的暗色配色并绘制背景层。

#### 基本用法

```javascript
import { DarkThemePlugin } from "timeline-canvas/plugins";

timeline.usePlugin(DarkThemePlugin);
```

#### 动态切换主题

```javascript
// 初始化时指定默认主题
const timeline = new Timeline("timelineCanvas", { theme: LightThemePlugin });

// 运行时动态切换
timeline.setTheme("dark");
// 切回亮色
timeline.setTheme("light");
```

提示：如需自定义主题，可参考插件开发指南实现自定义主题插件。

---

### PerformanceOverlayPlugin

性能监控插件，显示 FPS、内存使用等性能指标。

#### 基本用法

```javascript
import { PerformanceOverlayPlugin } from "timeline-canvas/plugins";

timeline.usePlugin(PerformanceOverlayPlugin);
```

#### 配置选项

```javascript
timeline.usePlugin(PerformanceOverlayPlugin);
// 性能监控的开关和调试模式由 TimelineConfig 控制：
// enablePerformanceMonitor: true
// debug: true
```

#### 配置接口

性能监控插件目前不接受直接的配置对象，而是依赖 `TimelineConfig` 中的 `enablePerformanceMonitor` 和 `debug` 选项。

---

## 媒体插件

### EventMediaPlugin

事件媒体插件，在事件块内部渲染图片或波形。

#### 基本用法

```javascript
import { EventMediaPlugin } from "timeline-canvas/plugins";

timeline.usePlugin(EventMediaPlugin());
```

#### 数据格式

```javascript
timeline.loadData({
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: '媒体事件',
          media: {
            images: [
              { src: 'path/to/image.jpg', fit: 'cover', opacity: 0.8 }
            ],
            waveform: { data: [0.1, 0.5, -0.2, ...], color: '#1890ff', opacity: 0.6 }
          }
        }
      ]
    }
  ]
});
```

#### 媒体类型配置

```typescript
interface EventMedia {
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
}
```

#### 高级用法

```javascript
// 混合媒体类型
timeline.loadData({
  tracks: [
    {
      events: [
        {
          id: 1,
          startTime: 0,
          endTime: 100,
          title: "音视频事件",
          media: {
            images: [
              {
                src: "thumbnail.jpg",
                fit: "cover",
                opacity: 0.3,
              },
            ],
            waveform: {
              data: audioSamples, // Float32Array 或 number[]
              color: "#ff6b6b",
              opacity: 0.8,
            },
          },
        },
      ],
    },
  ],
});
```
