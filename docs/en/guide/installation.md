---
title: Installation & Build
---

This page covers development/build commands for this repository (which is different from installing the `timeline-canvas` npm package).

## Requirements

- Node.js >= 20.17.0
- npm >= 9.0.0 or pnpm >= 10.0.0

## Install Dependencies

```bash
# npm
npm install

# pnpm
pnpm install
```

## Development

```bash
# Start dev server
npm run dev

# pnpm
pnpm dev
```

## Build

### Core Library

```bash
# Build the core library
npm run build

# Output goes to dist/
# - timeline-core.js - core (includes the plugin system)
# - timeline-core.min.js - minified build
```

### Docs

```bash
# Build docs
npm run docs:build

# Output goes to doc_build/
```

## Build Configuration

### tsdown.config.ts

The project uses tsdown for builds. Example config:

```typescript
export default defineConfig({
  entry: [
    "src/index.ts", // main entry
    "src/plugins/builtin/*.ts", // plugin entries
  ],
  format: ["esm", "cjs", "umd"],
  dts: true,
  clean: true,
  minify: true,
  external: ["three"], // externals
});
```

### Standalone Plugin Entries

Each plugin has its own entry so you can load it on demand:

```typescript
// standalone plugin build entries
export const pluginEntries = {
  ContextMenuPlugin: "src/plugins/builtin/ContextMenuPlugin.ts",
  PerformanceOverlayPlugin: "src/plugins/builtin/PerformanceOverlayPlugin.ts",
  LightThemePlugin: "src/plugins/builtin/LightThemePlugin.ts",
  DarkThemePlugin: "src/plugins/builtin/DarkThemePlugin.ts",
  EventMediaPlugin: "src/plugins/builtin/EventMediaPlugin.ts",
  MutexGuardPlugin: "src/plugins/builtin/MutexGuardPlugin.ts",
};
```

## npm Package Layout

```
timeline-canvas/
├── dist/
│   ├── timeline-core.js
│   ├── timeline-core.min.js
│   ├── timeline-core.d.ts
│   └── plugins/
│       ├── ContextMenuPlugin.js
│       ├── PerformanceOverlayPlugin.js
│       ├── LightThemePlugin.js
│       ├── DarkThemePlugin.js
│       ├── EventMediaPlugin.js
│       ├── MutexGuardPlugin.js
│       └── *.d.ts
├── package.json
└── README.md
```
