## 完整示例：背景网格插件

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
      description: "在背景层绘制辅助网格",
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

## 使用方式

```ts
await timeline.usePlugin(
  GridPlugin({
    color: "#c8d2df",
    spacing: 48,
    opacity: 0.35,
  })
);
```

## 这个示例体现了什么

* 使用工厂函数封装用户配置
* 在 `init()` 中保存插件私有数据
* 在 `activate()` 中注册 `background` 层
* 在 `deactivate()` 中清理渲染层
