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

* `LightThemePlugin`
* `DarkThemePlugin`
* `PerformanceOverlayPlugin`

### 先调用工厂函数再传入

* `ContextMenuPlugin()`
* `EventTooltipPlugin()`
* `EventMediaPlugin()`
* `MutexGuardPlugin()`

## usePlugin(plugin: TimelinePlugin): Promise<boolean>

加载插件并执行其生命周期。

```ts
await timeline.usePlugin(LightThemePlugin);
await timeline.usePlugin(PerformanceOverlayPlugin);
await timeline.usePlugin(ContextMenuPlugin());
```

说明：

* 返回 `true` 表示插件成功加载或主题切换成功
* 非主题插件若重复加载，当前实现会返回 `false`
* 主题插件会走专门的 `switchTheme()` 流程
* 如果插件声明了 `metadata.dependencies`，加载前会先检查依赖是否存在

## getLoadedPlugins(): TimelinePlugin\[]

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

* 这里传的是插件名，不是完整插件 ID
* 内部判断规则等价于“是否存在 `name@version` 前缀匹配的已加载插件”

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

## setTheme(theme: "light" | "dark"): Promise<boolean>

切换内置亮色/暗色主题。

```ts
const timeline = new Timeline("timelineCanvas", {
  theme: LightThemePlugin,
});

await timeline.setTheme("dark");
await timeline.setTheme("light");
```

说明：

* `setTheme()` 内部会在 `LightThemePlugin` 和 `DarkThemePlugin` 之间切换
* 切换主题时会卸载旧主题并触发 `theme:change`

## 构造时指定主题

```ts
const timeline = new Timeline("timelineCanvas", {
  theme: DarkThemePlugin,
});
```

构造器中的 `theme` 也是插件对象，当前实现会在初始化完成后异步加载它。
