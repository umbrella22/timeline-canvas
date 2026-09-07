# timeline-canvas User MCP Server

`timeline-canvas-user-mcp` is a read-only stdio MCP server for agents that integrate `timeline-canvas` into an application or develop an external plugin. It supplies framework guides, plugin source templates, and TypeScript validation without requiring a checkout of the `timeline-canvas` source repository in the user project.

This package is separate from `timeline-canvas-mcp`, which provides repository maintenance, refactoring, and built-in plugin tools for contributors working inside this repository.

| Choose | Package | Workspace | Purpose |
|---|---|---|---|
| Application integration or external plugin development | `timeline-canvas-user-mcp` | Your application repository | Guides, generated source returned to the agent, and validation against the installed public API |
| `timeline-canvas` repository maintenance | `timeline-canvas-mcp` | The `timeline-canvas` source repository | 10 tools for built-in plugin scaffolding, semantic analysis, consistency checks, refactors, and migration checks |

Enable only the server needed for the current workspace by default. Neither package registers or starts the other one automatically. See the [maintainer MCP README](../mcp-service/README.md) for the repository-maintenance server.

## Install and Run from npm

The package version is `timeline-canvas-user-mcp@0.1.0`. Run the current npm release against the target application workspace:

```bash
MCP_WORKSPACE_ROOT=/absolute/path/to/user-project npx -y timeline-canvas-user-mcp@latest
```

The source-build and local-tarball options below support development of the MCP package itself.

## Tools

The server exposes exactly three tools:

| Tool | Input | Result |
|---|---|---|
| `timeline_user_get_guide` | `{ framework: "vanilla" | "react" | "vue" }` | Framework-specific integration files as `files: [{ path, content }]`, plus notes |
| `timeline_user_generate_plugin` | `{ template: "basic" | "render" | "event-handler", exportName?, name?, description? }` | External plugin source as `files: [{ path, content }]`, plus usage, notes, and template compatibility information; `exportName` defaults to `createCustomPlugin` |
| `timeline_user_validate_plugin` | `{ filePath: string, exportName: string }` | TypeScript diagnostics, export validation, and limited static lifecycle hints; the standard example uses `src/timeline-plugin.ts` and `createCustomPlugin` |

All three tools are read-only. Guide and generation results return proposed files to the calling agent; the server does not write them into the application repository. Validation reads one plugin file but never imports or executes it.

## Requirements

- Node.js `^22.22.2 || ^24.15.0 || >=26.0.0`
- CI uses Node.js 24.20.0
- The user project installs `timeline-canvas`

The templates use only public APIs and have been verified against `timeline-canvas@1.4.1` and `timeline-canvas@1.5.0`, the current release. Every successful response includes a `project` object with `installedVersion`, `testedVersion`, and `compatibility`; `testedVersion` is `1.5.0`. Compatibility is `tested-version` for installed version `1.4.1` or `1.5.0`, `unverified-version` for any other installed version, and `not-installed` when the package cannot be resolved.

Run `timeline_user_validate_plugin` for each generated or adapted plugin against the application's installed public declarations. A `tested-version` result describes template verification and does not replace validation of the application's plugin code.

## Build and Run from Source

At the `timeline-canvas` repository root:

```bash
pnpm install
pnpm -C packages/user-mcp-service build
MCP_WORKSPACE_ROOT=/absolute/path/to/user-project pnpm mcp:user
```

For an MCP client, use the built launcher through an absolute path. `MCP_WORKSPACE_ROOT` selects the application whose integration or plugins are being checked:

```json
{
  "servers": {
    "timeline-canvas-user": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/timeline-canvas/packages/user-mcp-service/bin/timeline-canvas-user-mcp.js"
      ],
      "env": {
        "MCP_WORKSPACE_ROOT": "/absolute/path/to/user-project"
      }
    }
  }
}
```

The root command `pnpm mcp:user` is intended for running the server from the source repository. The absolute `node` launcher is more suitable for a client whose workspace is a separate user project.

## Install a Local Package Tarball

Build and pack version `0.1.0`:

```bash
pnpm -C /path/to/timeline-canvas/packages/user-mcp-service build
pnpm -C /path/to/timeline-canvas/packages/user-mcp-service pack
```

Install the resulting tarball in the user project:

```bash
pnpm --dir /absolute/path/to/user-project add -D \
  /path/to/timeline-canvas/packages/user-mcp-service/timeline-canvas-user-mcp-0.1.0.tgz
```

Then configure the installed executable:

```json
{
  "servers": {
    "timeline-canvas-user": {
      "type": "stdio",
      "command": "/absolute/path/to/user-project/node_modules/.bin/timeline-canvas-user-mcp",
      "args": [],
      "env": {
        "MCP_WORKSPACE_ROOT": "/absolute/path/to/user-project"
      }
    }
  }
}
```

The npm package can also be started directly:

```bash
npx -y timeline-canvas-user-mcp@latest
```

## Validation Boundary

`timeline_user_validate_plugin` resolves `filePath` under `MCP_WORKSPACE_ROOT`, or under the server process working directory when the variable is absent. It loads the public declarations from the user project's installed `timeline-canvas` package and uses TypeScript 6 to check the plugin file.

The selected export may be a `TimelinePlugin` object or a factory whose return value conforms to `TimelinePlugin`. Validation may also report a limited set of static lifecycle hints. It does not execute plugin code, inspect actual Canvas output, measure performance, or claim runtime correctness; `checks.runtime` remains `not-run`.

See the [full user MCP guide](../../docs/en/guide/user-mcp.md) and [Chinese README](README_CN.md).
