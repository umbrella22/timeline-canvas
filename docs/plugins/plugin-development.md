# 插件开发教程

本教程将带你从零开始开发一个 Timeline Canvas 插件，详细介绍插件生命周期、API 使用方法和最佳实践。

## 1. 插件基础概念

### 1.1 什么是插件

插件是扩展 Timeline Canvas 功能的独立模块，可以：

- 添加新的渲染层
- 监听和处理事件
- 提供自定义验证逻辑
- 扩展时间轴的交互能力

### 1.2 插件类型

```typescript
enum PluginType {
  RENDER = "render", // 渲染插件
  EVENT_HANDLER = "event_handler", // 事件处理器
  DATA_SOURCE = "data_source", // 数据源
  THEME = "theme", // 主题
  TOOL = "tool", // 工具
  EXTENSION = "extension", // 扩展
}
```

### 1.3 插件优先级

```typescript
enum PluginPriority {
  LOW = 0, // 低优先级
  NORMAL = 50, // 普通优先级
  HIGH = 100, // 高优先级
  CRITICAL = 200, // 关键优先级
}
```

## 2. 插件接口详解

### 2.1 TimelinePlugin 接口

```typescript
interface TimelinePlugin {
  metadata: PluginMetadata;
  init?: (context: PluginContext) => Promise<void> | void;
  activate?: (context: PluginContext) => Promise<void> | void;
  deactivate?: (context: PluginContext) => Promise<void> | void;
  destroy?: (context: PluginContext) => Promise<void> | void;
}
```

### 2.2 插件元数据

```typescript
interface PluginMetadata {
  name: string; // 插件名称（必填）
  version: string; // 版本号（必填）
  description: string; // 描述（必填）
  author?: string; // 作者（可选）
  type: PluginType; // 插件类型（必填）
  priority?: PluginPriority; // 优先级（可选，默认NORMAL）
  dependencies?: string[]; // 依赖插件（可选）
}
```

### 2.3 插件上下文

```typescript
interface PluginContext {
  timeline: Timeline; // 时间轴实例
  config: any; // 配置对象
  state: any; // 状态对象
  api: PluginAPI; // API 接口
}
```

### 2.4 插件 API

```typescript
interface PluginAPI {
  // 渲染层管理
  registerRenderLayer: (layer: RenderLayer) => void;
  unregisterRenderLayer: (name: string) => void;

  // 事件处理器管理
  registerEventHandler: (event: string, handler: Function) => void;
  unregisterEventHandler: (event: string, handler: Function) => void;

  // 通知和调试
  showNotification: (
    message: string,
    type?: "info" | "warning" | "error"
  ) => void;

  // 数据存储
  getData: (key: string) => any;
  setData: (key: string, value: any) => void;

  // 性能监控
  setPerformanceProvider: (provider: PerformanceProvider) => void;
  getPerformanceStats: () => Map<string, PerformanceStats>;
  getFPS: () => number;
}
```

## 3. 插件生命周期

### 3.1 生命周期流程

```
加载插件 → init() → activate() → 运行阶段 → deactivate() → destroy()
```

### 3.2 各阶段详解

#### init() 阶段

- **时机**: 插件被加载时调用
- **用途**: 初始化插件内部状态、验证依赖、设置默认值
- **注意**: 此时插件尚未激活，不应注册事件处理器

```javascript
init(context) {
  // 初始化插件数据
  context.api.setData('initialized', true);
  context.api.setData('config', this.config);

  // 验证依赖
  if (!context.timeline.config.enableEventResize) {
    context.api.showNotification('需要启用事件调整大小功能', 'warning');
  }
}
```

#### activate() 阶段

- **时机**: 插件被激活时调用
- **用途**: 注册事件处理器、渲染层、设置监听器
- **注意**: 这是插件开始工作的主要阶段

```javascript
activate(context) {
  // 注册事件处理器
  context.api.registerEventHandler('render:overlay', this.renderOverlay);
  context.api.registerEventHandler('validate:event:move', this.validateEventMove);

  // 注册渲染层
  context.api.registerRenderLayer({
    name: 'MyPluginLayer',
    position: 'overlay',
    render: this.render.bind(this)
  });

  console.log('插件已激活:', this.metadata.name);
}
```

#### 运行阶段

- **事件处理**: 响应各种事件
- **渲染参与**: 在渲染循环中绘制内容
- **状态管理**: 维护插件内部状态

#### deactivate() 阶段

- **时机**: 插件被停用时调用
- **用途**: 清理事件处理器、移除监听器
- **注意**: 插件功能在此阶段停止

```javascript
deactivate(context) {
  // 清理事件处理器
  context.api.unregisterEventHandler('render:overlay', this.renderOverlay);
  context.api.unregisterEventHandler('validate:event:move', this.validateEventMove);

  console.log('插件已停用:', this.metadata.name);
}
```

#### destroy() 阶段

- **时机**: 插件被销毁时调用
- **用途**: 释放资源、清理数据
- **注意**: 这是插件生命的最后阶段

```javascript
destroy(context) {
  // 清理插件数据
  context.api.setData('initialized', null);
  context.api.setData('config', null);

  console.log('插件已销毁:', this.metadata.name);
}
```

## 4. 事件系统详解

### 4.1 事件类型

#### 渲染事件

- `render:background` - 背景层渲染
- `render:overlay` - 覆盖层渲染
- `render:event:media` - 事件媒体渲染

#### 验证事件

- `validate:event:move` - 事件移动验证
- `validate:event:add` - 事件添加验证
- `validate:event:split` - 事件切割验证

#### 交互事件

- `event:click` - 事件点击
- `event:highlight` - 事件高亮
- `zoom:change` - 缩放级别变化
- `track:add` - 轨道添加
- `track:remove` - 轨道移除

### 4.2 事件处理器

#### 渲染事件处理器

```javascript
renderOverlay(ctx, canvas, config, state) {
  // 绘制自定义内容
  ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.fillRect(0, 0, 100, 100);
}
```

#### 验证事件处理器

```javascript
validateEventMove(payload) {
  const { fromTrackIndex, fromEventIndex, toTrackIndex, newStartTime, duration } = payload;

  // 自定义验证逻辑
  if (newStartTime < 0) {
    return false; // 阻止移动
  }

  return true; // 允许移动
}
```

### 4.3 事件优先级

事件按照插件优先级顺序执行：

1. CRITICAL (200)
2. HIGH (100)
3. NORMAL (50)
4. LOW (0)

## 5. 渲染层详解

### 5.1 渲染层接口

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

### 5.2 渲染位置

- `background` - 在事件块之前渲染（背景层）
- `overlay` - 在事件块之后渲染（覆盖层）

> **注意**: 核心渲染层（如时间轴刻度、轨道背景、事件块、辅助线等）现在由内部的 `RenderPipeline` 管理。插件目前只能在 `background`（最底层）和 `overlay`（最顶层）进行绘制。如果需要修改核心渲染行为，目前只能通过修改源码或等待未来开放更多钩子。

### 5.3 渲染示例

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

## 6. 数据存储

### 6.1 插件数据存储

```javascript
// 存储数据
context.api.setData("counter", 0);
context.api.setData("settings", { theme: "dark", language: "zh" });

// 获取数据
const counter = context.api.getData("counter");
const settings = context.api.getData("settings");
```

### 6.2 数据生命周期

- 数据在插件生命周期内持续存在
- 插件卸载时数据自动清理
- 不同插件的数据相互隔离

## 7. 性能优化

### 7.1 渲染优化

```javascript
render(ctx, canvas, config, state) {
  // 使用缓存
  if (!this.cache) {
    this.cache = this.generateCache(config);
  }

  // 只在需要时重绘
  if (this.needsRedraw(state)) {
    this.draw(ctx, state);
  }
}
```

### 7.2 事件处理优化

```javascript
// 使用防抖
validateEventMove: debounce(function(payload) {
  // 验证逻辑
}, 100),

// 使用节流
renderOverlay: throttle(function(ctx, canvas, config, state) {
  // 渲染逻辑
}, 16),
```

### 7.3 内存管理

```javascript
destroy(context) {
  // 清理缓存
  this.cache = null;

  // 清理定时器
  if (this.timer) {
    clearInterval(this.timer);
    this.timer = null;
  }

  // 清理事件监听器
  context.api.unregisterEventHandler('render:overlay', this.renderOverlay);
}
```

## 8. 错误处理

### 8.1 错误捕获

```javascript
activate(context) {
  try {
    this.setupEventHandlers(context);
  } catch (error) {
    context.api.showNotification(`插件激活失败: ${error.message}`, 'error');
    console.error('插件激活错误:', error);
  }
}
```

### 8.2 验证错误

```javascript
validateEventMove(payload) {
  try {
    return this.performValidation(payload);
  } catch (error) {
    console.error('验证错误:', error);
    return true; // 出错时默认允许操作
  }
}
```

## 9. 最佳实践

### 9.1 命名规范

```javascript
// 插件名称使用 PascalCase
const MyCustomPlugin = () => ({
  metadata: {
    name: "MyCustomPlugin", // ✅ 正确
    name: "my_custom_plugin", // ❌ 错误
  },
});

// 事件名称使用小写加冒号分隔
registerEventHandler("myplugin:custom:event", handler); // ✅ 正确
registerEventHandler("MyPluginCustomEvent", handler); // ❌ 错误

// 配置选项使用 camelCase
const config = {
  showGrid: true, // ✅ 正确
  show_grid: true, // ❌ 错误
};
```

### 9.2 配置设计

```javascript
const MyPlugin = (userConfig = {}) => {
  // 默认配置
  const defaultConfig = {
    enabled: true,
    color: "#1890ff",
    opacity: 0.8,
  };

  // 合并配置
  const config = { ...defaultConfig, ...userConfig };

  return {
    metadata: {
      name: "MyPlugin",
      version: "1.0.0",
      description: "我的自定义插件",
      type: "extension",
    },
    init(context) {
      context.api.setData("config", config);
    },
  };
};
```

### 9.3 兼容性处理

```javascript
activate(context) {
  // 检查依赖
  if (!context.timeline.config.enableEventResize) {
    context.api.showNotification('需要启用事件调整大小功能', 'warning');
    return;
  }

  // 检查 API 兼容性
  if (typeof context.api.registerEventHandler !== 'function') {
    console.warn('当前版本不支持事件处理器');
    return;
  }

  // 注册事件处理器
  this.registerHandlers(context);
}
```

### 9.4 文档化

```javascript
/**
 * 网格插件 - 在时间轴背景上绘制网格
 *
 * @param {Object} config - 插件配置
 * @param {string} config.color - 网格颜色
 * @param {number} config.spacing - 网格间距
 * @param {boolean} config.enabled - 是否启用
 *
 * @example
 * timeline.usePlugin(GridPlugin({
 *   color: '#e0e0e0',
 *   spacing: 50,
 *   enabled: true
 * }));
 */
const GridPlugin = (config = {}) => ({
  // 插件实现...
});
```

## 10. 完整示例：网格插件

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

## 11. 高级主题

### 11.1 插件间通信

```javascript
// 使用共享数据或公开方法进行通信
const SharedStorePlugin = () => ({
  activate(context) {
    context.api.setData("shared:messages", []);
  },
  pushMessage(context, message) {
    const list = context.api.getData("shared:messages") || [];
    list.push(message);
    context.api.setData("shared:messages", list);
  },
});
```

### 11.2 插件链式调用

```javascript
// 通过插件优先级保证执行顺序
const ValidationPlugin = () => ({
  metadata: { priority: PluginPriority.HIGH },
  validateEventMove(payload) {
    return this.performValidation(payload);
  },
});
```

### 11.3 动态插件加载

```javascript
// 条件加载
const ConditionalPlugin = () => ({
  init(context) {
    // 检查条件
    if (context.timeline.config.enableAdvancedFeatures) {
      // 动态加载高级功能插件
      import("./advanced-plugin.js").then((module) => {
        context.timeline.usePlugin(module.default);
      });
    }
  },
});
```

## 12. 调试和测试

### 12.1 调试技巧

```javascript
// 添加调试信息
const DebugPlugin = () => ({
  activate(context) {
    if (context.timeline.config.debug) {
      console.log("插件调试模式已启用");

      // 注册调试事件
      context.api.registerEventHandler("debug:info", (info) => {
        console.log("调试信息:", info);
      });
    }
  },
});
```

### 12.2 单元测试

```javascript
// 插件测试示例
describe("GridPlugin", () => {
  test("应该正确初始化", () => {
    const plugin = GridPlugin({ color: "#ff0000" });
    const mockContext = {
      api: {
        setData: jest.fn(),
        getData: jest.fn(),
      },
    };

    plugin.init(mockContext);

    expect(mockContext.api.setData).toHaveBeenCalledWith(
      "config",
      expect.objectContaining({
        color: "#ff0000",
      })
    );
  });
});
```

## 13. 发布和分享

### 13.1 打包插件

```json
{
  "name": "my-timeline-plugin",
  "version": "1.0.0",
  "description": "我的 Timeline Canvas 插件",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "keywords": ["timeline", "canvas", "plugin"],
  "author": "Your Name",
  "license": "MIT"
}
```

### 13.2 文档编写

````markdown
# My Timeline Plugin

一个用于 Timeline Canvas 的自定义插件。

## 安装

```bash
npm install my-timeline-plugin
```
````

## 使用

```javascript
import { Timeline } from "timeline-canvas";
import MyPlugin from "my-timeline-plugin";

const timeline = new Timeline("canvas");
timeline.usePlugin(
  MyPlugin({
    option: "value",
  })
);
```

## 配置

| 选项   | 类型   | 默认值 | 描述     |
| ------ | ------ | ------ | -------- |
| option | string | -      | 配置选项 |

## API

### 方法

- `method()` - 方法描述

## 示例

```javascript
// 示例代码
```

## 许可证

MIT
