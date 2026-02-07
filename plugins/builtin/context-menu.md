> 右键菜单插件。菜单项由 `TimelineConfig.contextMenuItems` 驱动，可选用 HTML 模板接管渲染。

## 基本用法

```ts
import { ContextMenuPlugin } from "timeline-canvas/plugins";

await timeline.usePlugin(ContextMenuPlugin());
```

## 开启与菜单项

```ts
import { Timeline } from "timeline-canvas";

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
```

## HTML 接管（可选）

```ts
await timeline.usePlugin(ContextMenuPlugin({ htmlTemplate: "<div>...</div>" }));
```
