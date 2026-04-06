```mermaid
sequenceDiagram
    participant User as User
    participant Timeline as Timeline
    participant PM as PluginManager
    participant Plugin as Plugin Instance

    User->>Timeline: usePlugin(plugin)
    Timeline->>PM: loadPlugin(plugin)
    PM->>PM: Check dependencies
    PM->>PM: Create PluginContext
    PM->>Plugin: init(context)
    PM->>Plugin: activate(context)
    PM-->>Timeline: true / false

    Note over User,Plugin: Plugin is running

    User->>Timeline: removePlugin(pluginId)
    Timeline->>PM: unloadPlugin(pluginId)
    PM->>Plugin: deactivate(context)
    PM->>Plugin: destroy(context)
    PM->>PM: Clean up plugin resources
    PM-->>Timeline: true / false
```

## TimelinePlugin

```ts
interface TimelinePlugin {
  metadata: PluginMetadata;
  init?: (context: PluginContext) => Promise<void> | void;
  activate?: (context: PluginContext) => Promise<void> | void;
  deactivate?: (context: PluginContext) => Promise<void> | void;
  destroy?: (context: PluginContext) => Promise<void> | void;
}
```

## PluginMetadata

```ts
interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  type: PluginType;
  priority?: PluginPriority;
  dependencies?: string[];
}
```

Notes:

* Plugin IDs use the format `${name}@${version}`
* `dependencies` can use either full plugin IDs or plugin names
* If `priority` is omitted, the runtime currently falls back to `0`

## PluginContext

```ts
interface PluginContext {
  timeline: Timeline;
  config: TimelineConfig;
  state: TimelineState;
  api: PluginAPI;
}
```

## PluginAPI

```ts
interface PluginAPI {
  registerRenderLayer: (layer: RenderLayer) => void;
  unregisterRenderLayer: (name: string) => void;
  registerCoreLayerHook: (hook: CoreLayerHook) => void;
  unregisterCoreLayerHook: (name: string) => void;
  registerEventHandler: (event: string, handler: PluginEventHandler) => void;
  unregisterEventHandler: (event: string, handler: PluginEventHandler) => void;
  showNotification: (
    message: string,
    type?: "info" | "warning" | "error"
  ) => void;
  getData: (key: string) => unknown;
  setData: (key: string, value: unknown) => void;
  setPerformanceProvider: (provider: PerformanceProvider) => void;
  getPerformanceStats: () => Map<string, PerformanceStats>;
  getFPS: () => number;
}
```

### RenderLayer

```ts
interface RenderLayer {
  name: string;
  position: "background" | "overlay";
  render: (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: TimelineConfig,
    state: TimelineState
  ) => void;
}
```

### CoreLayerHook

```ts
interface CoreLayerHook {
  name: string;
  target: "tracks" | "timeline" | "guideLines" | "indicator" | "scrollbar" | "interaction";
  handler: (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: TimelineConfig,
    state: TimelineState,
    next: () => void
  ) => void;
}
```

Notes:

* `registerRenderLayer()` is for top-level or bottom-level custom drawing
* `registerCoreLayerHook()` is for wrapping or replacing core rendering layers
* Call `next()` to continue the default core render path; skip it to fully take over that layer

## Plugin data storage

Each plugin gets its own isolated key-value store:

```ts
context.api.setData("counter", 0);
context.api.setData("settings", { enabled: true });

const counter = context.api.getData("counter");
const settings = context.api.getData("settings");
```

Storage behavior:

* Data persists for the life of the plugin
* Data is cleaned up automatically when the plugin unloads
* One plugin cannot read another plugin’s store
