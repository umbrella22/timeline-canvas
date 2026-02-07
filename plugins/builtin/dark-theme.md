暗色主题插件，设置时间轴的暗色配色并绘制背景层。

## 基本用法

```ts
import { DarkThemePlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(DarkThemePlugin);

// 或者使用便捷方法
await timeline.setTheme("dark");
```

## 动态切换主题

```ts
import { Timeline } from "timeline-canvas";
import { LightThemePlugin } from "timeline-canvas/plugins";

// 初始化时指定默认主题
const timeline = new Timeline("timelineCanvas", { theme: LightThemePlugin });

// 运行时动态切换
await timeline.setTheme("dark");
// 切回亮色
await timeline.setTheme("light");
```

提示：如需自定义主题，可参考插件开发指南实现自定义主题插件。
