## Full example: background grid plugin

```ts
import {
  PluginPriority,
  PluginType,
  type TimelinePlugin,
} from "timeline-canvas";

interface GridPluginOptions {
  color?: string;
  spacing?: number;
  opacity?: number;
}

export function GridPlugin(
  userOptions: GridPluginOptions = {}
): TimelinePlugin {
  const options = {
    color: "#d0d7e2",
    spacing: 40,
    opacity: 0.5,
    ...userOptions,
  };

  return {
    metadata: {
      name: "grid-plugin",
      version: "1.0.0",
      description: "Draws helper grid lines in the background layer",
      type: PluginType.RENDER,
      priority: PluginPriority.NORMAL,
    },

    init(context) {
      context.api.setData("gridOptions", options);
    },

    activate(context) {
      context.api.registerRenderLayer({
        name: "grid-plugin-layer",
        position: "background",
        render(ctx, canvas) {
          const cfg = context.api.getData("gridOptions") as GridPluginOptions;
          if (!cfg) return;

          ctx.save();
          ctx.strokeStyle = cfg.color || "#d0d7e2";
          ctx.globalAlpha = cfg.opacity ?? 0.5;
          ctx.lineWidth = 1;

          const spacing = cfg.spacing || 40;
          for (let x = 0; x < canvas.width; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
          }

          ctx.restore();
        },
      });
    },

    deactivate(context) {
      context.api.unregisterRenderLayer("grid-plugin-layer");
    },
  };
}
```

## Usage

```ts
await timeline.usePlugin(
  GridPlugin({
    color: "#c8d2df",
    spacing: 48,
    opacity: 0.35,
  })
);
```

## What this example demonstrates

* wrapping user config in a factory function
* storing plugin-private data in `init()`
* registering a `background` render layer in `activate()`
* cleaning up the layer in `deactivate()`
