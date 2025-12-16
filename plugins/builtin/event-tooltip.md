# EventTooltipPlugin

事件提示插件，当鼠标悬停在事件上时显示详细信息。

## 基本用法

```javascript
import { EventTooltipPlugin } from "timeline-canvas/plugins";

timeline.usePlugin(EventTooltipPlugin());
```

## 配置选项

```javascript
timeline.usePlugin(
  EventTooltipPlugin({
    showDelay: 300, // 显示延迟（毫秒）
    maxWidth: 300, // 最大宽度
    backgroundColor: "#333", // 背景色
    textColor: "#fff", // 文字颜色
    // 自定义 HTML 模板
    htmlTemplate: (title) => `<div><strong>${title}</strong></div>`,
  })
);
```
