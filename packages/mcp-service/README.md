# timeline-canvas MCP Server

This MCP server exposes project-specific **semantic analysis** tools over stdio, designed for use with Copilot Chat and AI CLI agents.

## Tools (8 total)

### P0 — Scaffolding & Validation

| Tool | Description |
|---|---|
| `timeline_scaffold_plugin` | Template-based plugin scaffolding with feature selection and optional test generation |
| `timeline_validate_plugin` | Deep plugin validation (metadata, activate/deactivate pairing, TODO scan, re-export consistency) |
| `timeline_list_builtin_plugins` | List all builtin plugin names |

### P1 — Semantic Analysis

| Tool | Description |
|---|---|
| `timeline_dependency_graph` | Symbol dependency graph via TS Compiler API (dependents / dependencies / both) |
| `timeline_type_query` | Type definition inspection + member usage tracking |
| `timeline_consistency_check` | 5 project-specific consistency rules (plugin-exports, render-layers, state-fields, change-types, boundary-conditions) |

### P2 — Performance & Migration

| Tool | Description |
|---|---|
| `timeline_perf_annotate` | Static analysis of rendering hot paths (O(N) in loops, GC pressure, missing visibility culling) |
| `timeline_migration_helper` | API export vs documentation sync check |

## Quick start (inside this repo)

- Install: `pnpm install` (at repo root)
- Start MCP server (stdio): `pnpm mcp`

Equivalent: `pnpm -C packages/mcp-service start`.

## VS Code / Copilot Chat config (stdio)

This repo includes a sample config at .vscode/mcp.json.

Key points:

- Start the server via **stdio** (no HTTP)
- Make sure the server can resolve the repo root via `cwd` or `MCP_WORKSPACE_ROOT`

### Option A (recommended for local dev)

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

### Option B (npx, published to npm)

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

## Verify

Ask Copilot Chat to run `timeline_list_builtin_plugins` or `timeline_validate_plugin` (no args = validate all).

See the full tool documentation in [README_CN.md](README_CN.md) or [docs/guide/mcp.md](../../docs/guide/mcp.md).
