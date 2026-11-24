## Import styles

You can import built-in plugins directly from the package root:

```ts
import {
  Timeline,
  LightThemePlugin,
  DarkThemePlugin,
  PerformanceOverlayPlugin,
  ContextMenuPlugin,
} from "timeline-canvas";
```

Or use the stable built-in subpath:

```ts
import { ContextMenuPlugin } from "timeline-canvas/builtin-plugin/ContextMenuPlugin";
```

## Which plugins are objects vs factory functions?

### Pass these directly

* `LightThemePlugin`
* `DarkThemePlugin`
* `PerformanceOverlayPlugin`

### Call these first

* `ContextMenuPlugin()`
* `EventTooltipPlugin()`
* `EventMediaPlugin()`
* `MutexGuardPlugin()`

## usePlugin(plugin: TimelinePlugin): Promise<boolean>

Loads a plugin and runs its lifecycle.

```ts
await timeline.usePlugin(LightThemePlugin);
await timeline.usePlugin(PerformanceOverlayPlugin);
await timeline.usePlugin(ContextMenuPlugin());
```

Notes:

* Returns `true` when the plugin loads successfully
* Re-loading the same non-theme plugin currently returns `false`
* Theme plugins go through a dedicated theme-switching path
* If a plugin declares `metadata.dependencies`, those dependencies are checked before activation

## getLoadedPlugins(): TimelinePlugin\[]

Returns the loaded plugin objects.

```ts
const plugins = timeline.getLoadedPlugins();
```

## isPluginLoaded(pluginName: string): boolean

Checks whether a plugin with the given name is loaded.

```ts
timeline.isPluginLoaded("performance-overlay");
timeline.isPluginLoaded("theme-dark");
```

Notes:

* Pass the plugin name, not the full plugin ID
* Internally this behaves like a prefix match on `name@version`

## removePlugin(pluginId: string): Promise<boolean>

Unloads a plugin by full plugin ID.

```ts
await timeline.removePlugin("performance-overlay@1.0.0");
await timeline.removePlugin("theme-light@1.0.0");
```

Plugin IDs use this format:

```ts
`${plugin.metadata.name}@${plugin.metadata.version}`
```

A dependency can name an exact `name@version` or any loaded version of `name`. Manual removal returns `false` while the plugin is the last matching provider for a dependent. This also applies during the dependent’s activation and teardown. Remove the dependent first.

## setTheme(theme: "light" | "dark"): Promise<boolean>

Switches between the built-in light and dark themes.

```ts
const timeline = new Timeline("timelineCanvas", {
  theme: LightThemePlugin,
});

await timeline.setTheme("dark");
await timeline.setTheme("light");
```

The constructor’s initial theme, `setTheme()`, `usePlugin(theme)` and removal of a current or queued theme run in invocation order. A successful switch unloads the previous theme, activates the requested theme and emits `theme:change`. Selecting the active theme returns `true` immediately when its turn arrives.

If a dependent still requires the active theme, the switch returns `false` and the theme remains active. If activation fails, the manager cleans up the attempted registrations, restores the palette and tries to reactivate the previous theme. The switch returns `false`. If reactivation also fails, `getLoadedPlugins()` shows no active theme and a subsequent switch can select one.

## Set a theme at construction time

```ts
const timeline = new Timeline("timelineCanvas", {
  theme: DarkThemePlugin,
});
```

The constructor accepts a theme plugin object and loads it asynchronously during initialization.
