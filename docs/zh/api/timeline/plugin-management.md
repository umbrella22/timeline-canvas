---
title: 插件管理 API
---

## 导入方式

内置插件有两种推荐导入方式：

```ts
import {
  Timeline,
  LightThemePlugin,
  DarkThemePlugin,
  PerformanceOverlayPlugin,
  ContextMenuPlugin,
} from "timeline-canvas";
```

或按稳定子路径导入：

```ts
import { ContextMenuPlugin } from "timeline-canvas/builtin-plugin/ContextMenuPlugin";
```

## 哪些插件需要调用，哪些直接传

### 直接传插件对象

- `LightThemePlugin`
- `DarkThemePlugin`
- `PerformanceOverlayPlugin`

### 先调用工厂函数再传入

- `ContextMenuPlugin()`
- `EventTooltipPlugin()`
- `EventMediaPlugin()`
- `MutexGuardPlugin()`

## usePlugin(plugin: TimelinePlugin): Promise<boolean>

加载插件并执行其生命周期。

```ts
await timeline.usePlugin(LightThemePlugin);
await timeline.usePlugin(PerformanceOverlayPlugin);
await timeline.usePlugin(ContextMenuPlugin());
```

说明：

- 返回 `true` 表示插件成功加载或主题切换成功
- 非主题插件若重复加载，当前实现会返回 `false`
- 主题插件会走专门的 `setTheme()` 流程（内部为私有的 `switchThemePlugin`）
- 如果插件声明了 `metadata.dependencies`，加载前会先检查依赖是否存在

## getLoadedPlugins(): TimelinePlugin[]

返回已加载的插件对象列表。

```ts
const plugins = timeline.getLoadedPlugins();
```

## isPluginLoaded(pluginName: string): boolean

按插件名判断是否已加载。

```ts
timeline.isPluginLoaded("performance-overlay");
timeline.isPluginLoaded("theme-dark");
```

说明：

- 这里传的是插件名，不是完整插件 ID
- 内部判断规则等价于“是否存在 `name@version` 前缀匹配的已加载插件”

## removePlugin(pluginId: string): Promise<boolean>

按完整插件 ID 卸载插件。

```ts
await timeline.removePlugin("performance-overlay@1.0.0");
await timeline.removePlugin("theme-light@1.0.0");
```

插件 ID 的格式是：

```ts
`${plugin.metadata.name}@${plugin.metadata.version}`
```

依赖可以指定精确的 `name@version`，也可以用 `name` 匹配任一已加载版本。当依赖方仍在初始化、运行或卸载时，手动移除最后一个匹配版本会返回 `false`。先卸载依赖方即可移除该版本。

## setTheme(theme: "light" | "dark"): Promise<boolean>

切换内置亮色/暗色主题。

```ts
const timeline = new Timeline("timelineCanvas", {
  theme: LightThemePlugin,
});

await timeline.setTheme("dark");
await timeline.setTheme("light");
```

构造时的初始主题、`setTheme()`、`usePlugin(theme)` 以及对当前或已排队主题的移除按调用顺序执行。切换成功时先卸载旧主题，再激活新主题并触发 `theme:change`。轮到当前已激活的主题时直接返回 `true`。

如果依赖方仍需要当前主题，切换返回 `false`，当前主题继续生效。新主题激活失败时，管理器清理本次注册、恢复调色板，并尝试重新激活旧主题，切换返回 `false`。如果旧主题也未能重新激活，`getLoadedPlugins()` 中没有活动主题，后续仍可切换。

## 构造时指定主题

```ts
const timeline = new Timeline("timelineCanvas", {
  theme: DarkThemePlugin,
});
```

构造器中的 `theme` 也是插件对象，当前实现会在初始化完成后异步加载它。
