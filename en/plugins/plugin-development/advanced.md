## Inter-plugin communication

```javascript
// Communicate via shared data or exposed methods
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

## Chaining via priority

```javascript
// Use plugin priority to control execution order
const ValidationPlugin = () => ({
  metadata: { priority: PluginPriority.HIGH },
  validateEventMove(payload) {
    return this.performValidation(payload);
  },
});
```

## Dynamic plugin loading

```javascript
// Conditional loading
const ConditionalPlugin = () => ({
  init(context) {
    // Check conditions
    if (context.timeline.config.enableAdvancedFeatures) {
      // Dynamically load an advanced plugin
      import("./advanced-plugin.js").then((module) => {
        context.timeline.usePlugin(module.default);
      });
    }
  },
});
```

## Debugging & testing

### Debugging tips

```javascript
// Add debug output
const DebugPlugin = () => ({
  activate(context) {
    if (context.timeline.config.debug) {
      console.log("Plugin debug mode is enabled");

      // Register debug events
      context.api.registerEventHandler("debug:info", (info) => {
        console.log("Debug info:", info);
      });
    }
  },
});
```

### Unit tests

```javascript
// Plugin test example
describe("GridPlugin", () => {
  test("should initialize correctly", () => {
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

## Publishing & sharing

### Package a plugin

```json
{
  "name": "my-timeline-plugin",
  "version": "1.0.0",
  "description": "My Timeline Canvas plugin",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "keywords": ["timeline", "canvas", "plugin"],
  "author": "Your Name",
  "license": "MIT"
}
```

### Write documentation

````markdown
# My Timeline Plugin

A custom plugin for Timeline Canvas.

## Installation

```bash
npm install my-timeline-plugin
```
````

## Usage

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

## Configuration

| Option | Type   | Default | Description |
| ------ | ------ | ------ | -------- |
| option | string | -      | option |

## API

### Methods

* `method()` - method description

## Example

```javascript
// example code
```

## License

MIT
