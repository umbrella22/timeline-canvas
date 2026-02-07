## Naming Conventions

```javascript
// Plugin names use PascalCase
const MyCustomPlugin = () => ({
  metadata: {
    name: "MyCustomPlugin", // ✅ correct
    name: "my_custom_plugin", // ❌ incorrect
  },
});

// Event names use lowercase with colon separators
registerEventHandler("myplugin:custom:event", handler); // ✅ correct
registerEventHandler("MyPluginCustomEvent", handler); // ❌ incorrect

// Config options use camelCase
const config = {
  showGrid: true, // ✅ correct
  show_grid: true, // ❌ incorrect
};
```

## Configuration Design

```javascript
const MyPlugin = (userConfig = {}) => {
  // defaults
  const defaultConfig = {
    enabled: true,
    color: "#1890ff",
    opacity: 0.8,
  };

  // merge config
  const config = { ...defaultConfig, ...userConfig };

  return {
    metadata: {
      name: "MyPlugin",
      version: "1.0.0",
      description: "My custom plugin",
      type: "extension",
    },
    init(context) {
      context.api.setData("config", config);
    },
  };
};
```

## Compatibility

```javascript
activate(context) {
  // check prerequisites
  if (!context.timeline.config.enableEventResize) {
    context.api.showNotification('Event resizing must be enabled', 'warning');
    return;
  }

  // check API availability
  if (typeof context.api.registerEventHandler !== 'function') {
    console.warn('This version does not support event handlers');
    return;
  }

  // register handlers
  this.registerHandlers(context);
}
```

## Documentation

```javascript
/**
 * Grid plugin - draw a grid on the timeline background
 *
 * @param {Object} config - plugin config
 * @param {string} config.color - grid color
 * @param {number} config.spacing - grid spacing
 * @param {boolean} config.enabled - enabled
 *
 * @example
 * timeline.usePlugin(GridPlugin({
 *   color: '#e0e0e0',
 *   spacing: 50,
 *   enabled: true
 * }));
 */
const GridPlugin = (config = {}) => ({
  // implementation...
});
```

## Performance

### Rendering

```javascript
render(ctx, canvas, config, state) {
  // use caching
  if (!this.cache) {
    this.cache = this.generateCache(config);
  }

  // redraw only when needed
  if (this.needsRedraw(state)) {
    this.draw(ctx, state);
  }
}
```

### Event handling

```javascript
// debounce
validateEventMove: debounce(function(payload) {
  // validation logic
}, 100),

// throttle
renderOverlay: throttle(function(ctx, canvas, config, state) {
  // render logic
}, 16),
```

### Memory management

```javascript
destroy(context) {
  // clear caches
  this.cache = null;

  // clear timers
  if (this.timer) {
    clearInterval(this.timer);
    this.timer = null;
  }

  // unregister listeners
  context.api.unregisterEventHandler('render:overlay', this.renderOverlay);
}
```

## Error handling

### Catch errors

```javascript
activate(context) {
  try {
    this.setupEventHandlers(context);
  } catch (error) {
    context.api.showNotification(`Plugin activation failed: ${error.message}`, 'error');
    console.error('Plugin activation error:', error);
  }
}
```

### Validation errors

```javascript
validateEventMove(payload) {
  try {
    return this.performValidation(payload);
  } catch (error) {
    console.error('Validation error:', error);
    return true; // default to allow when failing
  }
}
```
