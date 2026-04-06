暗色主题插件。它和 `LightThemePlugin` 一样，都是直接传入的插件对象。

## 基本用法

```ts
import { DarkThemePlugin } from "timeline-canvas";

await timeline.usePlugin(DarkThemePlugin);
```

更常见的运行时切换方式：

```ts
await timeline.setTheme("dark");
await timeline.setTheme("light");
```

## 初始化时指定默认主题

```ts
import { Timeline, DarkThemePlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  theme: DarkThemePlugin,
});
```

## 当前实现行为

* 会把内置暗色调色板合并进 `timeline.config.colors`
* 会注册一个 `background` 层来绘制暗色背景
* 通过 `setTheme()` 切换时，旧主题会先卸载，再加载新主题

## 插件 ID

```ts
"theme-dark@1.0.0"
```

提示：如需自定义主题，可参考插件开发指南实现自定义 `PluginType.THEME` 插件。
