## 插件间通信

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

## 插件链式调用

```javascript
// 通过插件优先级保证执行顺序
const ValidationPlugin = () => ({
  metadata: { priority: PluginPriority.HIGH },
  validateEventMove(payload) {
    return this.performValidation(payload);
  },
});
```

## 动态插件加载

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

* `method()` - 方法描述

## 示例

```javascript
// 示例代码
```

## 许可证

MIT
