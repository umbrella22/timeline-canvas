事件提示插件。当事件标题在块内被截断时，鼠标悬停会显示完整标题。

## 基本用法

```ts
import { EventTooltipPlugin } from "timeline-canvas";

await timeline.usePlugin(EventTooltipPlugin());
```

## 配置选项

```ts
await timeline.usePlugin(
  EventTooltipPlugin({
    showDelay: 300,
    maxWidth: 300,
    padding: 8,
    borderRadius: 4,
    backgroundColor: "#333",
    textColor: "#fff",
    borderColor: "#555",
    fontSize: 12,
    fontFamily: "Arial, sans-serif",
    htmlTemplate: (title) => {
      const label = document.createElement("strong");
      label.textContent = title;
      return label.outerHTML;
    },
  })
);
```

## 源码中的实际行为

* 只有标题文本被截断时才显示 tooltip
* 默认延迟 `300ms`
* 使用 `mousemove` + `requestAnimationFrame` 节流来做命中检测
* HTML 模式下，如果 `htmlTemplate(title)` 返回空字符串，会回退到 Canvas 模式
* 延时显示、移动和隐藏 tooltip 都会触发覆盖层重绘，静止的时间轴也能及时更新。
* `htmlTemplate` 的返回值按可信 HTML 处理。外部标题可像示例一样通过 `textContent` 插入。

## 适合的场景

* 事件块较窄，无法完整显示标题
* 希望在不改变主渲染密度的情况下保留完整文本
* 需要悬停时展示自定义 HTML 结构

## 插件 ID

```ts
"event-tooltip@1.0.0"
```
