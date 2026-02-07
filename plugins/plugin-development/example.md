## 完整示例：网格插件

```javascript
/**
 * 网格插件 - 在时间轴背景上绘制网格
 */
const GridPlugin = (userConfig = {}) => {
  // 默认配置
  const defaultConfig = {
    color: "#e0e0e0",
    spacing: 50,
    opacity: 0.5,
    enabled: true,
  };

  // 合并配置
  const config = { ...defaultConfig, ...userConfig };

  return {
    metadata: {
      name: "GridPlugin",
      version: "1.0.0",
      description: "在时间轴背景上绘制网格",
      type: "extension",
      priority: PluginPriority.NORMAL,
    },

    init(context) {
      // 存储配置
      context.api.setData("config", config);
      context.api.setData("enabled", config.enabled);

      console.log("网格插件已初始化");
    },

    activate(context) {
      if (!context.api.getData("enabled")) {
        return;
      }

      // 注册渲染层
      context.api.registerRenderLayer({
        name: "GridPlugin",
        position: "background",
        render: this.renderGrid.bind(this),
      });

      // 注册事件处理器
      context.api.registerEventHandler(
        "config:changed",
        this.onConfigChanged.bind(this)
      );

      console.log("网格插件已激活");
    },

    deactivate(context) {
      // 清理渲染层
      context.api.unregisterRenderLayer("GridPlugin");

      // 清理事件处理器
      context.api.unregisterEventHandler(
        "config:changed",
        this.onConfigChanged
      );

      console.log("网格插件已停用");
    },

    destroy(context) {
      // 清理数据
      context.api.setData("config", null);
      context.api.setData("enabled", null);

      console.log("网格插件已销毁");
    },

    renderGrid(ctx, canvas, config, state) {
      const pluginConfig = ctx.api.getData("config");

      if (!pluginConfig || !pluginConfig.enabled) {
        return;
      }

      const { color, spacing, opacity } = pluginConfig;

      // 保存当前状态
      ctx.save();

      // 设置样式
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = opacity;

      // 绘制垂直线
      for (let x = 0; x < canvas.width; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // 绘制水平线
      for (let y = 0; y < canvas.height; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 恢复状态
      ctx.restore();
    },

    onConfigChanged(newConfig) {
      // 处理配置变化
      if (newConfig.gridColor !== undefined) {
        const config = this.getData("config");
        config.color = newConfig.gridColor;
        this.setData("config", config);
      }
    },
  };
};

// 使用插件
timeline.usePlugin(
  GridPlugin({
    color: "#d0d0d0",
    spacing: 40,
    opacity: 0.3,
  })
);
```
