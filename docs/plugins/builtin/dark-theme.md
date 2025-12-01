# DarkThemePlugin

暗色主题插件，设置时间轴的暗色配色并绘制背景层。

## 基本用法

```javascript
import { DarkThemePlugin } from "timeline-canvas/plugins";

timeline.usePlugin(DarkThemePlugin);
```

## 动态切换主题

```javascript
// 初始化时指定默认主题
const timeline = new Timeline("timelineCanvas", { theme: LightThemePlugin });

// 运行时动态切换
timeline.setTheme("dark");
// 切回亮色
timeline.setTheme("light");
```

提示：如需自定义主题，可参考插件开发指南实现自定义主题插件。
