Timeline Canvas ships with a small set of built-in plugins that cover themes, media rendering, context menus, tooltips, and runtime diagnostics.

## Import styles

The simplest option is to import from the package root:

```ts
import {
  ContextMenuPlugin,
  EventTooltipPlugin,
  EventMediaPlugin,
  LightThemePlugin,
  DarkThemePlugin,
  PerformanceOverlayPlugin,
  MutexGuardPlugin,
} from "timeline-canvas";
```

If you prefer a stable built-in subpath, that works too:

```ts
import { ContextMenuPlugin } from "timeline-canvas/builtin-plugin/ContextMenuPlugin";
```

## Direct plugins vs factory plugins

### Pass these directly

* `LightThemePlugin`
* `DarkThemePlugin`
* `PerformanceOverlayPlugin`

### Call these before passing them in

* `ContextMenuPlugin()`
* `EventTooltipPlugin()`
* `EventMediaPlugin()`
* `MutexGuardPlugin()`

## Plugin index

### Essentials

* [ContextMenuPlugin](/timeline-canvas/en/plugins/builtin/context-menu.md) - context menus with optional HTML takeover
* [EventTooltipPlugin](/timeline-canvas/en/plugins/builtin/event-tooltip.md) - hover tooltips for truncated event titles
* [LightThemePlugin](/timeline-canvas/en/plugins/builtin/light-theme.md) - built-in light theme
* [DarkThemePlugin](/timeline-canvas/en/plugins/builtin/dark-theme.md) - built-in dark theme
* [PerformanceOverlayPlugin](/timeline-canvas/en/plugins/builtin/performance-overlay.md) - FPS and render-timing overlay

### Media

* [EventMediaPlugin](/timeline-canvas/en/plugins/builtin/event-media.md) - image and waveform rendering inside events

### Utilities

* [MutexGuardPlugin](/timeline-canvas/en/plugins/builtin/mutex-guard.md) - mutex-based move and resize constraints
