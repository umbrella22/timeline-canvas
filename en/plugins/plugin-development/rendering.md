## Render layer interface

```typescript
interface RenderLayer {
  name: string; // layer name
  position: "background" | "overlay"; // layer position
  render: (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: any,
    state: any
  ) => void;
}
```

## Layer positions

* `background` - render before event blocks (bottom-most)
* `overlay` - render after event blocks (top-most)

> **Note**: Core layers (timeline scale, track background, event blocks, guidelines, etc.) are managed by the internal `RenderPipeline`. Plugins can currently draw only in `background` (bottom) and `overlay` (top). To change core rendering, you’ll need to modify the source for now (or wait for more hooks in the future).

## Example

```ts
registerRenderLayer({
  name: "GridPlugin",
  position: "background",
  render(ctx, canvas, config, state) {
    // draw a grid
    ctx.strokeStyle = config.colors.grid || "#e0e0e0";
    ctx.lineWidth = 1;

    // draw vertical lines
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
  },
});
```
