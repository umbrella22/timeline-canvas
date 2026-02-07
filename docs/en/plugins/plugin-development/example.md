---
title: Example Plugin
---

## Full Example: Grid Plugin

```javascript
/**
 * Grid plugin - draw a grid on the timeline background
 */
const GridPlugin = (userConfig = {}) => {
  // defaults
  const defaultConfig = {
    color: "#e0e0e0",
    spacing: 50,
    opacity: 0.5,
    enabled: true,
  };

  // merge config
  const config = { ...defaultConfig, ...userConfig };

  return {
    metadata: {
      name: "GridPlugin",
      version: "1.0.0",
      description: "Draw a grid on the timeline background",
      type: "extension",
      priority: PluginPriority.NORMAL,
    },

    init(context) {
      // store config
      context.api.setData("config", config);
      context.api.setData("enabled", config.enabled);

      console.log("Grid plugin initialized");
    },

    activate(context) {
      if (!context.api.getData("enabled")) {
        return;
      }

      // register render layer
      context.api.registerRenderLayer({
        name: "GridPlugin",
        position: "background",
        render: this.renderGrid.bind(this),
      });

      // register event handler
      context.api.registerEventHandler(
        "config:changed",
        this.onConfigChanged.bind(this)
      );

      console.log("Grid plugin activated");
    },

    deactivate(context) {
      // cleanup render layer
      context.api.unregisterRenderLayer("GridPlugin");

      // cleanup event handler
      context.api.unregisterEventHandler(
        "config:changed",
        this.onConfigChanged
      );

      console.log("Grid plugin deactivated");
    },

    destroy(context) {
      // cleanup data
      context.api.setData("config", null);
      context.api.setData("enabled", null);

      console.log("Grid plugin destroyed");
    },

    renderGrid(ctx, canvas, config, state) {
      const pluginConfig = ctx.api.getData("config");

      if (!pluginConfig || !pluginConfig.enabled) {
        return;
      }

      const { color, spacing, opacity } = pluginConfig;

      // save canvas state
      ctx.save();

      // set styles
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = opacity;

      // draw vertical lines
      for (let x = 0; x < canvas.width; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // draw horizontal lines
      for (let y = 0; y < canvas.height; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // restore canvas state
      ctx.restore();
    },

    onConfigChanged(newConfig) {
      // handle config changes
      if (newConfig.gridColor !== undefined) {
        const config = this.getData("config");
        config.color = newConfig.gridColor;
        this.setData("config", config);
      }
    },
  };
};

// use the plugin
timeline.usePlugin(
  GridPlugin({
    color: "#d0d0d0",
    spacing: 40,
    opacity: 0.3,
  })
);
```
