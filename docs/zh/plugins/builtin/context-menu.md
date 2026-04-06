---
title: ContextMenuPlugin
---

> 右键菜单插件。菜单项由 `contextMenuItems` 驱动，可选用 HTML 模板接管渲染。

## 基本用法

```ts
import { Timeline, ContextMenuPlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  enableContextMenu: true,
});

await timeline.usePlugin(ContextMenuPlugin());
```

如果你更喜欢稳定子路径导入：

```ts
import { ContextMenuPlugin } from "timeline-canvas/builtin-plugin/ContextMenuPlugin";
```

## 菜单项配置

```ts
const timeline = new Timeline("timelineCanvas", {
  enableContextMenu: true,
  contextMenuItems: [
    { type: "edit", name: "编辑" },
    { type: "delete", name: "删除" },
    { type: "export", name: "导出" },
  ],
  onContextMenu: ({ menuType, trackIndex, eventIndex, event }) => {
    console.log(menuType, trackIndex, eventIndex, event);
  },
});

await timeline.usePlugin(ContextMenuPlugin());
```

## HTML 接管

可以通过工厂参数传入模板字符串：

```ts
await timeline.usePlugin(
  ContextMenuPlugin({
    htmlTemplate: "<div class='my-menu'>自定义菜单</div>",
  })
);
```

也可以通过构造配置传入：

```ts
const timeline = new Timeline("timelineCanvas", {
  enableContextMenu: true,
  contextMenuHtml: "<div class='my-menu'>自定义菜单</div>",
});
```

说明：

- 工厂参数 `htmlTemplate` 的优先级高于 `contextMenuHtml`
- 模板为空字符串时，当前实现会回退到 Canvas 菜单渲染
- 当前内置插件只会把 `contextMenuHtml` 的字符串值当作模板使用

## 渲染行为

当前实现的行为特点：

- Canvas 模式下，菜单绘制在 `overlay` 层
- HTML 模式下，会在画布父容器内挂一个绝对定位的菜单容器
- 当菜单隐藏时，插件会自动隐藏或移除对应容器

## 插件 ID

```ts
"context-menu@1.0.0"
```

