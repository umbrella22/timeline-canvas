---
title: EventTooltipPlugin
---

事件提示插件，当鼠标悬停在事件上时显示详细信息。

## 基本用法

```ts
import { EventTooltipPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(EventTooltipPlugin());
```

## 配置选项

```ts
await timeline.usePlugin(
  EventTooltipPlugin({
    showDelay: 300,
    maxWidth: 300,
    backgroundColor: "#333",
    textColor: "#fff",
    htmlTemplate: (title) => `<div><strong>${title}</strong></div>`,
  })
);
```
