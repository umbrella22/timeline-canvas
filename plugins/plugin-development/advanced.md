## 插件间通信

```javascript
// 使用共享数据或公开方法进行通信
const SharedStorePlugin = () => ({
  metadata: {
    name: "shared-store",
    version: "1.0.0",
    description: "在插件之间共享消息",
    type: PluginType.EXTENSION,
  },
  // 只有 init / activate / deactivate / destroy 是生命周期钩子
  activate(context) {
    context.api.setData("shared:messages", []);
  },
  // 其余方法只是普通自定义方法，不是钩子：在工厂返回的对象上显式调用
  pushMessage(context, message) {
    const list = context.api.getData("shared:messages") || [];
    list.push(message);
    context.api.setData("shared:messages", list);
  },
});
```

## 插件链式调用

```javascript
// 通过插件优先级保证激活顺序
const performValidation = (payload) => {
  // ...校验逻辑
  return { allowed: true };
};

const ValidationPlugin = () => ({
  metadata: {
    // name / version / description / type 为必填，仅 priority 可选
    name: "validation",
    version: "1.0.0",
    description: "在提交前校验事件移动",
    type: PluginType.EVENT_HANDLER,
    priority: PluginPriority.HIGH,
  },
  activate(context) {
    // 插件是普通对象字面量，没有 `this`：改为在插件 API 上注册处理器
    context.api.registerEventHandler("validate:event:move", (payload) =>
      performValidation(payload)
    );
  },
});
```

## 动态插件加载

```javascript
// 条件加载
const ConditionalPlugin = (options = {}) => ({
  metadata: {
    name: "conditional",
    version: "1.0.0",
    description: "由宿主决定是否加载额外插件",
    type: PluginType.EXTENSION,
  },
  init(context) {
    // 开关由调用方传入：TimelineConfig 没有 `enableAdvancedFeatures` 字段
    if (!options.enableAdvancedFeatures) return;

    // 动态加载高级功能插件
    import("./advanced-plugin.js").then((module) => {
      context.timeline.usePlugin(module.default);
    });
  },
});
```

## 12. 调试和测试

### 12.1 调试技巧

```javascript
// 添加调试信息
const DebugPlugin = () => ({
  metadata: {
    name: "debug",
    version: "1.0.0",
    description: "输出插件调试信息",
    type: PluginType.TOOL,
  },
  activate(context) {
    if (!context.timeline.config.debug) return;

    console.log("插件调试模式已启用");

    // 注册调试事件
    context.api.registerEventHandler("debug:info", (info) => {
      console.log("调试信息:", info);
    });
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

* `method()` - 方法描述

## 示例

```javascript
// 示例代码
```

## 许可证

MIT
