Built-in light theme. This is a plugin object, not a factory function.

## Basic usage

```ts
import { LightThemePlugin } from "timeline-canvas";

await timeline.usePlugin(LightThemePlugin);
```

For theme switching, the convenience API is usually a better fit:

```ts
await timeline.setTheme("light");
```

## Set it at construction time

```ts
import { Timeline, LightThemePlugin } from "timeline-canvas";

const timeline = new Timeline("timelineCanvas", {
  theme: LightThemePlugin,
});
```

## Current behavior

* Merges the built-in light palette into `timeline.config.colors`
* Registers a `background` render layer for the canvas background

## Plugin ID

```ts
"theme-light@1.0.0"
```
