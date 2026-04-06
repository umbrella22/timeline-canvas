亮色主题插件。它是一个插件对象，不是工厂函数。

## 基本用法

```ts
import { LightThemePlugin } from "timeline-canvas";

await timeline.usePlugin(LightThemePlugin);
```

更推荐的主题切换写法：

```ts
await timeline.setTheme("light");
```

## 初始化时指定主题

```ts
import { Timeline, LightThemePlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  theme: LightThemePlugin,
});
```

## 当前实现行为

* 会把内置亮色调色板合并进 `timeline.config.colors`
* 会注册一个 `background` 层用于绘制画布背景

## 插件 ID

```ts
"theme-light@1.0.0"
```
