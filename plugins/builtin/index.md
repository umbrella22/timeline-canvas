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

* `LightThemePlugin`
* `DarkThemePlugin`
* `PerformanceOverlayPlugin`

### 调用工厂函数后再传入

* `ContextMenuPlugin()`
* `EventTooltipPlugin()`
* `EventMediaPlugin()`
* `MutexGuardPlugin()`

## 插件目录

### 基础插件

* [ContextMenuPlugin](/timeline-canvas/plugins/builtin/context-menu.md) - 右键菜单与 HTML 接管
* [EventTooltipPlugin](/timeline-canvas/plugins/builtin/event-tooltip.md) - 标题截断时的提示层
* [LightThemePlugin](/timeline-canvas/plugins/builtin/light-theme.md) - 亮色主题
* [DarkThemePlugin](/timeline-canvas/plugins/builtin/dark-theme.md) - 暗色主题
* [PerformanceOverlayPlugin](/timeline-canvas/plugins/builtin/performance-overlay.md) - FPS 与图层耗时面板

### 媒体插件

* [EventMediaPlugin](/timeline-canvas/plugins/builtin/event-media.md) - 事件块内图片与波形渲染

### 功能插件

* [MutexGuardPlugin](/timeline-canvas/plugins/builtin/mutex-guard.md) - 基于互斥标签的移动/缩放约束
