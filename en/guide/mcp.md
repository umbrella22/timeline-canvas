> This repository provides a stdio MCP server so Copilot Chat / AI CLI can interact with the repo via tool calls.

This page covers how to start it, configuration examples, and recommended workflows.

* **Scaffolding**: Generate built-in plugin skeletons from templates, with feature selection and optional test stubs
* **Validation**: Deep plugin integrity checks (metadata fields, activate/deactivate pairing, TODO scan)
* **Semantic queries**: Symbol dependency graphs, type definitions, and member reference tracking (via TypeScript Compiler API)
* **Consistency checks**: 5 categories of project-specific rules (plugin exports, render layers, state fields, change types, boundary conditions)
* **Performance analysis**: Static annotation of render hot paths (O(N) work in loops, GC pressure, missing visibility culling, etc.)
* **Migration helper**: Cross-check API exports against docs

## Prerequisites

* Node.js (use the repo’s recommended version)
* pnpm
* VS Code + GitHub Copilot Chat

## Startup

This is a **stdio MCP server**, usually started and managed by VS Code / Copilot Chat.

### Option A: Local Development (Recommended)

Use this when you work inside this repo and want to use/debug MCP without relying on an npm release.

1. Install dependencies at the repo root:

```bash
pnpm install
```

1. Start it via the workspace script:

```bash
pnpm mcp
```

Equivalent command:

```bash
pnpm -C packages/mcp-service start
```

### Option B: npx (for a published version)

This MCP server is published to npm (`timeline-canvas-mcp@2.0.0`). You can start it via `npx` (add `-y` to avoid interactive prompts).

## VS Code / Copilot Chat Configuration (stdio)

The repo includes a reference config you can copy: `.vscode/mcp.json`.

Key points:

* Start the server via stdio (not HTTP)
* Ensure the server can locate the repo root (`cwd` or `MCP_WORKSPACE_ROOT`)

Below are generic examples (the UI/keys may vary slightly by VS Code version):

### Using pnpm (recommended for local)

```json
{
  "mcpServers": {
    "timeline-canvas": {
      "command": "pnpm",
      "args": ["-C", "packages/mcp-service", "start"],
      "env": {
        "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### Using npx (published version)

```json
{
  "mcpServers": {
    "timeline-canvas": {
      "command": "npx",
      "args": ["-y", "timeline-canvas-mcp@2.0.0"],
      "env": {
        "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

## Generic Configuration for AI CLIs (stdio, minimal setup)

As long as your AI CLI **supports MCP and can start a stdio server** (i.e., communicate via a process’ stdin/stdout), you can typically reuse the same startup parameters:

* `command`: `npx` (or `pnpm`)
* `args`: `-y timeline-canvas-mcp@2.0.0` (or `-C packages/mcp-service start`)
* `env.MCP_WORKSPACE_ROOT`: points to the repo root (critical)

> Tip: If you upgrade the npm package version later, also update `timeline-canvas-mcp@x.y.z` here and in the repo examples (e.g. `.vscode/mcp.json`).

### Shape A: key is `mcpServers`

Many clients use a structure like this (replace `${workspaceFolder}` with whatever workspace variable your client supports, or use an absolute path):

```json
{
  "mcpServers": {
    "timeline-canvas": {
      "command": "npx",
      "args": ["-y", "timeline-canvas-mcp@2.0.0"],
      "env": {
        "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### Shape B: key is `servers` (same as this repo’s example)

Some clients use `servers` with `type: "stdio"`:

```jsonc
{
  "servers": {
    "timeline-canvas": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "timeline-canvas-mcp@2.0.0"],
      "cwd": "${workspaceFolder}",
      "env": {
        "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### Local repo startup (without relying on npm)

If your AI CLI can run local commands directly, start via pnpm (best for development/debugging inside the repo):

```json
{
  "command": "pnpm",
  "args": ["-C", "packages/mcp-service", "start"],
  "env": {
    "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
  }
}
```

## Verify It Works

After configuring, do a minimal verification in Copilot Chat:

* Call `timeline_list_builtin_plugins`: it should list plugins under `packages/timeline/src/plugins/builtin`
* Call `timeline_validate_plugin` (no args): it should return validation reports for all built-in plugins
* Call `timeline_consistency_check`: it should return the project consistency check results

## Recommended Workflows

Below are common workflows you’ll likely use most in Copilot Chat.

> Note: Use VS Code built-in tools for generic actions like searching, reading files, and running scripts. MCP tools focus on repo-level semantic analysis that built-ins can’t provide.

### 1) Understand dependencies of a class/interface (before refactoring)

1. Find who depends on `ChangeScheduler`:

```json
{ "symbol": "ChangeScheduler", "direction": "dependents" }
```

2. Find what `ChangeScheduler` depends on:

```json
{ "symbol": "ChangeScheduler", "direction": "dependencies" }
```

3. Query both directions:

```json
{ "symbol": "ChangeScheduler", "direction": "both" }
```

### 2) Inspect a type definition and member usage

1. View the full `TimelineState` definition and all fields:

```json
{ "type": "TimelineState" }
```

2. See where `scrollX` is read/written:

```json
{ "type": "TimelineState", "member": "scrollX" }
```

### 3) Scaffold a built-in plugin and validate it

1. Generate a plugin skeleton with a render layer and lifecycle hooks:

```json
{
  "exportName": "MyPlugin",
  "pluginType": "render",
  "features": ["renderLayer", "lifecycle"],
  "description": "My custom render plugin",
  "withTest": true
}
```

2. Validate the plugin immediately:

```json
{ "name": "MyPlugin" }
```

3. Validate all built-in plugins (no args):

```json
{}
```

### 4) Project health checks

1. Run all consistency checks:

```json
{}
```

2. Run only selected checks:

```json
{ "checks": ["plugin-exports", "state-fields"] }
```

### 5) Performance optimization help

1. Analyze render hot paths:

```json
{ "target": "render" }
```

2. Analyze all subsystems:

```json
{ "target": "all" }
```

### 6) Check API ↔ docs sync

```json
{ "scope": "api" }
```

## Troubleshooting

* Tools not showing up / calls failing: try Reload Window and confirm the MCP server is enabled
* `npx` stuck waiting for confirmation: ensure you pass `-y`
* `Path escapes workspace`: check whether `cwd` / `MCP_WORKSPACE_ROOT` points to the repo root

## Tool List

Below is the full set of tools exposed by MCP server v2.0 in this repo (8 tools). All return values are plain text.

> **Compared to v1.0**: Removed 6 tools that overlapped with VS Code built-ins (`timeline_search`, `timeline_read_excerpt`, `timeline_repo_map`, `timeline_trace_entrypoints`, `timeline_run_repo_script`, `timeline_run_mcp_script`) and added 5 semantic analysis tools.

***

### `timeline_scaffold_plugin`

**Priority: P0 | Category: Scaffolding**

Purpose: Generate a new built-in plugin skeleton from templates and automatically wire up exports. Supports feature selection and optional test scaffolding.

What it does:

* Generate plugin implementation files under `packages/timeline/src/plugins/builtin/` (template-based, not string-concatenated)
* Generate re-export entries under `packages/timeline/src/builtin-plugin/`
* Automatically add exports to `packages/timeline/src/index.ts`
* Optionally generate test scaffolding

Inputs:

* `exportName: string`: export name (must be a valid identifier, e.g. `FooPlugin`)
* `pluginType: "render" | "event_handler" | "data_source" | "theme" | "tool" | "extension"`
* `features?: ("renderLayer" | "eventHandler" | "config" | "lifecycle" | "init")[]`: optional features that shape the generated code
* `metadataName?: string`: optional metadata name (defaults to kebab-case of `exportName`)
* `description?: string`: optional plugin description
* `version?: string` (default: `"1.0.0"`): plugin version
* `withReexport?: boolean` (default: `true`): whether to generate re-export files
* `withIndexExport?: boolean` (default: `true`): whether to update `index.ts`
* `withTest?: boolean` (default: `false`): whether to generate test scaffolding

Output: list of created files + next-step suggestions.

Example:

```json
{
  "exportName": "MyPlugin",
  "pluginType": "render",
  "features": ["renderLayer", "lifecycle"],
  "description": "My custom render plugin",
  "withTest": true
}
```

***

### `timeline_validate_plugin`

**Priority: P0 | Category: Validation**

Purpose: Deep validation of built-in plugin integrity. Pass a plugin name to validate a single plugin, or omit to validate all.

Checks:

* Whether implementation and re-export files exist
* Whether exported symbols are correct
* Whether `src/index.ts` exports it
* Whether `PluginMetadata` contains required fields (name, version, type)
* Whether `activate` / `deactivate` are properly paired
* Whether re-export paths match `plugins/builtin`
* Whether there are leftover TODO markers

Inputs:

* `name?: string`: plugin name. If omitted, checks all built-in plugins.

Output: per-check validation report.

Example:

```json
{ "name": "ContextMenuPlugin" }
```

Validate all (no args):

```json
{}
```

***

### `timeline_list_builtin_plugins`

**Priority: P0 | Category: Query**

Purpose: List all plugin names under `packages/timeline/src/plugins/builtin`.

Inputs: none.

Output: plugin name list.

***

### `timeline_dependency_graph`

**Priority: P1 | Category: Semantic query**

Purpose: Query a symbol dependency graph. Uses TypeScript Compiler API to parse imports and distinguishes value imports vs type-only imports. Useful for estimating refactor impact.

Inputs:

* `symbol: string`: class/function/interface name, etc.
* `direction: "dependents" | "dependencies" | "both"`: query direction
  * `"dependents"`: who depends on it
  * `"dependencies"`: what it depends on
  * `"both"`: both directions
* `depth?: number` (default: `1`, range 1~5): recursion depth

Output: dependency list grouped by file, annotated with `[value]` / `[type]` import kind.

Example:

```json
{ "symbol": "ChangeScheduler", "direction": "dependents" }
```

***

### `timeline_type_query`

**Priority: P1 | Category: Semantic query**

Purpose: View full definitions of interface/type/class/enum and, optionally, where a given member is read/written.

Inputs:

* `type: string`: type name (e.g. `TimelineState`, `PluginType`)
* `member?: string`: optional member name; when provided, also outputs read/write locations

Output: type definition (file, line numbers, member list) + optional member usage list.

Example:

```json
{ "type": "TimelineState", "member": "scrollX" }
```

***

### `timeline_consistency_check`

**Priority: P1 | Category: Consistency**

Purpose: Run project-specific consistency rules to detect structural issues that grep can’t catch.

Checks (5 categories):

| Check | Description |
|---|---|
| `plugin-exports` | built-in plugins ↔ re-export ↔ `index.ts` export consistency |
| `render-layers` | whether LayerType definitions match the actual render pipeline |
| `state-fields` | whether all TimelineState fields are initialized in StateManager |
| `change-types` | whether each ChangeType enum value has matching handling logic |
| `boundary-conditions` | whether interval checks use consistent `>=` vs `>` rules |

Inputs:

* `checks?: string[]`: specify which checks to run. Omit to run all.

Output: pass/fail status and details for each check.

Example:

```json
{ "checks": ["plugin-exports", "state-fields"] }
```

***

### `timeline_perf_annotate`

**Priority: P2 | Category: Performance**

Purpose: Static analysis of render hot paths to annotate potential performance issues.

Rules:

* O(N) work inside loops (`.some`, `.find`, `.filter`, `.indexOf` can easily become O(N²)\`)
* object or array allocations inside loops (GC pressure)
* string concatenation inside loops
* iterating over all events without visibility culling
* creating `Date` objects every frame
* mismatched `canvas.save()` / `canvas.restore()` calls

Inputs:

* `target: "render" | "highlight" | "interaction" | "all"`: which subsystem to analyze

Output: hotspots sorted by severity (HIGH / MEDIUM / LOW), each with file, line number, description, and suggestion.

Example:

```json
{ "target": "render" }
```

***

### `timeline_migration_helper`

**Priority: P2 | Category: Migration**

Purpose: Compare current code exports with documentation content to detect sync issues.

Detects:

* newly exported items that are missing from the docs
* APIs that are still documented even though they were removed or renamed
* whether PluginType enum values are in sync with scaffold templates

Inputs:

* `scope: "api" | "types" | "plugins"`
  * `"api"`: check all exports
  * `"types"`: check type exports only
  * `"plugins"`: check plugin exports + PluginType consistency

Output: diff list + auto-generated update suggestions.

Example:

```json
{ "scope": "api" }
```
