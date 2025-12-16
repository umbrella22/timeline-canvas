# 渲染机制

## 5.1 渲染层接口

```typescript
interface RenderLayer {
  name: string; // 渲染层名称
  position: "background" | "overlay"; // 渲染位置
  render: (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: any,
    state: any
  ) => void;
}
```

## 5.2 渲染位置

* `background` - 在事件块之前渲染（背景层）
* `overlay` - 在事件块之后渲染（覆盖层）

> **注意**: 核心渲染层（如时间轴刻度、轨道背景、事件块、辅助线等）现在由内部的 `RenderPipeline` 管理。插件目前只能在 `background`（最底层）和 `overlay`（最顶层）进行绘制。如果需要修改核心渲染行为，目前只能通过修改源码或等待未来开放更多钩子。

## 5.3 渲染示例

```javascript
registerRenderLayer({
  name: "GridPlugin",
  position: "background",
  render(ctx, canvas, config, state) {
    // 绘制网格
    ctx.strokeStyle = config.colors.grid || "#e0e0e0";
    ctx.lineWidth = 1;

    // 绘制垂直线
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
  },
});
```
