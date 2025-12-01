# ContextMenuPlugin

右键菜单插件，支持 Canvas 和 HTML 两种渲染模式。

## 基本用法

```javascript
import { ContextMenuPlugin } from "timeline-canvas/plugins";

timeline.usePlugin(ContextMenuPlugin());
```

## 配置选项

```javascript
timeline.usePlugin(
  ContextMenuPlugin({
    useHtml: true, // 是否使用 HTML 渲染菜单
    htmlTemplate: "<div>...</div>", // 可选的 HTML 模板
  })
);
```

## 菜单项配置

```typescript
interface MenuItem {
  type?: string; // 'separator' 等
  name: string; // 菜单项文本
}
```

## 高级用法

```javascript
// 动态菜单项
timeline.usePlugin(
  ContextMenuPlugin({
    useHtml: true,
  })
);
// 菜单项内容目前主要通过 TimelineConfig.contextMenuItems 配置
```
