---
title: 内置插件总览
---

Timeline Canvas 内置了一组可直接复用的插件。

## 导入方式

推荐直接从包根导入：

```ts
import {
  ContextMenuPlugin,
  EventTooltipPlugin,
  EventMediaPlugin,
  LightThemePlugin,
  DarkThemePlugin,
  PerformanceOverlayPlugin,
  MutexGuardPlugin,
} from "timeline-canvas";
```

如果你希望按稳定子路径单独导入，也可以使用：

```ts
import { ContextMenuPlugin } from "timeline-canvas/builtin-plugin/ContextMenuPlugin";
```

## 先分清两种使用方式

### 直接传插件对象

- `LightThemePlugin`
- `DarkThemePlugin`
- `PerformanceOverlayPlugin`

### 调用工厂函数后再传入

- `ContextMenuPlugin()`
- `EventTooltipPlugin()`
- `EventMediaPlugin()`
- `MutexGuardPlugin()`

## 插件目录

### 基础插件

- [ContextMenuPlugin](./context-menu) - 右键菜单与 HTML 接管
- [EventTooltipPlugin](./event-tooltip) - 标题截断时的提示层
- [LightThemePlugin](./light-theme) - 亮色主题
- [DarkThemePlugin](./dark-theme) - 暗色主题
- [PerformanceOverlayPlugin](./performance-overlay) - FPS 与图层耗时面板

### 媒体插件

- [EventMediaPlugin](./event-media) - 事件块内图片与波形渲染

### 功能插件

- [MutexGuardPlugin](./mutex-guard) - 基于互斥标签的移动/缩放约束
