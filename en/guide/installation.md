This page covers development of this repository. To use the published library, install `timeline-canvas` in your application.

## Requirements

* Node.js `^22.22.2 || ^24.15.0 || >=26.0.0`; CI uses 24.20.0. The jsdom 30 test environment requires these minimum versions.
* pnpm 10.34.5, as pinned in `package.json`.

## Install and Develop

```bash
pnpm install
pnpm dev       # Watch and rebuild the timeline library
pnpm docs:dev  # Start the documentation and playground server
```

Installation builds the timeline library, maintainer MCP, and user MCP. Run the two development commands in separate terminals when working on the library and playground together.

## Build and Verify

```bash
pnpm build          # Build the library and both MCP services
pnpm docs:build     # Build documentation into doc_build/
pnpm lint
pnpm typecheck
pnpm test:run       # Run library, playground and MCP regression tests
pnpm test:watch
pnpm test:coverage
pnpm -C packages/mcp-service test:package
pnpm -C packages/user-mcp-service test:package
```

`@vitest/coverage-v8` must match the Vitest version bundled with Vite+, currently 4.1.11. MCP semantic analysis requires the TypeScript 5/6 Compiler API, so the development dependency remains at 6.0.3; the TypeScript 7 native compiler is incompatible with that API.

## Vite+ Configuration

Each package uses `vite.config.ts` with `defineConfig` from `vite-plus`. The `pack` block configures library builds; the `test` block configures tests. The root config combines the workspace test projects.

```typescript
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    outDir: "dist",
    format: ["esm"],
    target: "node20",
    dts: true,
    clean: true,
    minify: true,
  },
  test: {
    include: ["tests/**/*.spec.ts"],
  },
});
```

Build, test and lint commands use `vp pack`, `vp test` and `vp lint`. Test APIs are imported from `vite-plus/test`. Vite+ supplies the build, test, lint and formatting tools, so standalone tsdown, Vitest and Oxlint dependencies are unnecessary. The direct `vite` dependency is an alias to the matching Vite+ core package. The V8 coverage provider remains a separate dependency matching the bundled Vitest version.

## Package Outputs

The timeline package emits ESM and declarations in `packages/timeline/dist/`:

```text
dist/
  index.mjs
  index.d.mts
  builtin-plugin/
    LightThemePlugin.mjs
    LightThemePlugin.d.mts
    ...
```

Plugin entries are discovered from `src/builtin-plugin/*.ts` and imported using `timeline-canvas/builtin-plugin/LightThemePlugin`. Shared chunks also live in `dist/`. Library builds copy their output to `docs/public/dist/` for documentation examples.

Both MCP packages emit their own `dist/server.mjs`. The maintainer MCP includes its runtime `templates/` directory; the user MCP embeds its guides and templates in the program. Each package's `test:package` command verifies its tools from an unpacked npm tarball outside the source tree.
