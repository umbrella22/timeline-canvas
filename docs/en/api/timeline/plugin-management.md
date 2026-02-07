---
title: Plugin Management API
---

## usePlugin

`usePlugin(plugin: any): Promise<boolean>`

Use a plugin.

```ts
// Some built-in plugins are factory functions (call to pass options)
await timeline.usePlugin(ContextMenuPlugin());

// Some built-in plugins are plugin objects (pass directly)
await timeline.usePlugin(PerformanceOverlayPlugin);
```

## removePlugin

`removePlugin(pluginId: string): Promise<boolean>`

Remove a plugin.

```ts
await timeline.removePlugin("performance-overlay@1.0.0");
```

## setTheme

`setTheme(theme: 'light' | 'dark'): Promise<boolean>`

Switch built-in themes at runtime.

```ts
// Set default theme at initialization
const timeline = new Timeline("timelineCanvas", { theme: LightThemePlugin });

// Switch to dark theme
await timeline.setTheme("dark");

// Switch back to light theme
await timeline.setTheme("light");
```

## getLoadedPlugins

`getLoadedPlugins(): any[]`

Get the list of loaded plugins.

```ts
const plugins = timeline.getLoadedPlugins();
console.log("Loaded plugins:", plugins);
```

## isPluginLoaded

`isPluginLoaded(pluginName: string): boolean`

Check whether a plugin is loaded.

```ts
if (timeline.isPluginLoaded("performance-overlay")) {
  console.log("Performance overlay plugin is loaded");
}
```
