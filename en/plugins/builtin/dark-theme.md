Built-in dark theme. Like `LightThemePlugin`, this is a plugin object you pass directly.

## Basic usage

```ts
import { DarkThemePlugin } from "timeline-canvas";

await timeline.usePlugin(DarkThemePlugin);
```

More commonly, you will switch themes with:

```ts
await timeline.setTheme("dark");
await timeline.setTheme("light");
```

## Set a default theme

```ts
import { Timeline, DarkThemePlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  theme: DarkThemePlugin,
});
```

## Current behavior

* Merges the built-in dark palette into `timeline.config.colors`
* Registers a `background` layer for the dark canvas background
* When used through `setTheme()`, the old theme is unloaded before the new one is loaded

## Plugin ID

```ts
"theme-dark@1.0.0"
```

For custom theming, implement your own `PluginType.THEME` plugin.
