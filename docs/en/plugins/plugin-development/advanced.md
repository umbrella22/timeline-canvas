---
title: Advanced Topics
---

## Inter-plugin communication

```javascript
// Communicate via shared data or exposed methods
const SharedStorePlugin = () => ({
  metadata: {
    name: "shared-store",
    version: "1.0.0",
    description: "Shares messages between plugins",
    type: PluginType.EXTENSION,
  },
  // Only init / activate / deactivate / destroy are lifecycle hooks.
  activate(context) {
    context.api.setData("shared:messages", []);
  },
  // Any other method is a plain custom method, not a hook: call it explicitly
  // on the object returned by the factory.
  pushMessage(context, message) {
    const list = context.api.getData("shared:messages") || [];
    list.push(message);
    context.api.setData("shared:messages", list);
  },
});
```

## Chaining via priority

```javascript
// Use plugin priority to control the order in which plugins are activated
const performValidation = (payload) => {
  // ...validation logic
  return { allowed: true };
};

const ValidationPlugin = () => ({
  metadata: {
    // name / version / description / type are required; only priority is optional
    name: "validation",
    version: "1.0.0",
    description: "Validates event moves before they are committed",
    type: PluginType.EVENT_HANDLER,
    priority: PluginPriority.HIGH,
  },
  activate(context) {
    // The plugin is a plain object literal, so there is no `this`:
    // register the handler through the plugin API instead.
    context.api.registerEventHandler("validate:event:move", (payload) =>
      performValidation(payload)
    );
  },
});
```

## Dynamic plugin loading

```javascript
// Conditional loading
const ConditionalPlugin = (options = {}) => ({
  metadata: {
    name: "conditional",
    version: "1.0.0",
    description: "Loads an extra plugin when the host enables it",
    type: PluginType.EXTENSION,
  },
  init(context) {
    // The switch comes from the caller: TimelineConfig has no
    // `enableAdvancedFeatures` option.
    if (!options.enableAdvancedFeatures) return;

    // Dynamically load an advanced plugin
    import("./advanced-plugin.js").then((module) => {
      context.timeline.usePlugin(module.default);
    });
  },
});
```

## Debugging & testing

### Debugging tips

```javascript
// Add debug output
const DebugPlugin = () => ({
  metadata: {
    name: "debug",
    version: "1.0.0",
    description: "Logs plugin debug information",
    type: PluginType.TOOL,
  },
  activate(context) {
    if (!context.timeline.config.debug) return;

    console.log("Plugin debug mode is enabled");

    // Register debug events
    context.api.registerEventHandler("debug:info", (info) => {
      console.log("Debug info:", info);
    });
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

- `method()` - method description

## Example

```javascript
// example code
```

## License

MIT
