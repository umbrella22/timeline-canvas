---
title: Built-in Plugins
---

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

- `LightThemePlugin`
- `DarkThemePlugin`
- `PerformanceOverlayPlugin`

### Call these before passing them in

- `ContextMenuPlugin()`
- `EventTooltipPlugin()`
- `EventMediaPlugin()`
- `MutexGuardPlugin()`

## Plugin index

### Essentials

- [ContextMenuPlugin](./context-menu) - context menus with optional HTML takeover
- [EventTooltipPlugin](./event-tooltip) - hover tooltips for truncated event titles
- [LightThemePlugin](./light-theme) - built-in light theme
- [DarkThemePlugin](./dark-theme) - built-in dark theme
- [PerformanceOverlayPlugin](./performance-overlay) - FPS and render-timing overlay

### Media

- [EventMediaPlugin](./event-media) - image and waveform rendering inside events

### Utilities

- [MutexGuardPlugin](./mutex-guard) - mutex-based move and resize constraints
