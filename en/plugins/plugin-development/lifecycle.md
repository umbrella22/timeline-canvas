## Lifecycle Flow

```
Load plugin → init() → activate() → running → deactivate() → destroy()
```

## Stages

### init()

* **When**: called when the plugin is loaded
* **Purpose**: initialize internal state, validate dependencies, set defaults
* **Note**: the plugin is not active yet; avoid registering event handlers here

```ts
init(context) {
  // initialize plugin data
  context.api.setData('initialized', true);
  context.api.setData('config', this.config);

  // validate dependencies
  if (!context.timeline.config.enableEventResize) {
    context.api.showNotification('Event resizing must be enabled', 'warning');
  }
}
```

### activate()

* **When**: called when the plugin is activated
* **Purpose**: register event handlers, render layers, and listeners
* **Note**: this is the main stage where the plugin starts working

```ts
activate(context) {
  // register event handlers
  context.api.registerEventHandler('render:overlay', this.renderOverlay);
  context.api.registerEventHandler('validate:event:move', this.validateEventMove);

  // register a render layer
  context.api.registerRenderLayer({
    name: 'MyPluginLayer',
    position: 'overlay',
    render: this.render.bind(this)
  });

  console.log('Plugin activated:', this.metadata.name);
}
```

### Running

* **Event handling**: respond to various events
* **Rendering**: draw content in the render loop
* **State management**: maintain plugin internal state

### deactivate()

* **When**: called when the plugin is deactivated
* **Purpose**: unregister handlers and remove listeners
* **Note**: plugin functionality stops at this stage

```javascript
deactivate(context) {
  // unregister event handlers
  context.api.unregisterEventHandler('render:overlay', this.renderOverlay);
  context.api.unregisterEventHandler('validate:event:move', this.validateEventMove);

  console.log('Plugin deactivated:', this.metadata.name);
}
```

### destroy()

* **When**: called when the plugin is destroyed
* **Purpose**: release resources and cleanup data
* **Note**: this is the final stage of the plugin lifecycle

```javascript
destroy(context) {
  // cleanup plugin data
  context.api.setData('initialized', null);
  context.api.setData('config', null);

  console.log('Plugin destroyed:', this.metadata.name);
}
```
