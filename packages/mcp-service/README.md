# timeline-canvas MCP Server

This MCP server exposes project-specific semantic analysis and refactor assistance tools over stdio, designed for Copilot Chat and AI CLI agents working inside this repo.

## Tools

### P0 — Scaffolding, Validation & Refactors

| Tool | Description |
|---|---|
| `timeline_scaffold_plugin` | Template-based builtin plugin scaffolding with feature selection and optional test generation |
| `timeline_validate_plugin` | Deep plugin validation including metadata, lifecycle cleanup, TODO scan, and behavioral warnings |
| `timeline_list_builtin_plugins` | List all builtin plugin names |
| `timeline_rename_symbol` | Cross-file semantic rename with TypeScript LanguageService, scope filtering, and dry-run support |

### P1 — Semantic Analysis & Impact

| Tool | Description |
|---|---|
| `timeline_dependency_graph` | Symbol dependency graph via TS Compiler API (`dependents` / `dependencies` / `both`) |
| `timeline_type_query` | Type definition inspection plus member read/write usage tracking |
| `timeline_consistency_check` | Project-specific structural checks including plugin exports, render layers, change types, dirty mapping, buffer compose, and interaction API boundaries |
| `timeline_impact_analysis` | Symbol-level impact analysis for contract/signature changes |

### P2 — Performance & Migration

| Tool | Description |
|---|---|
| `timeline_perf_annotate` | Static analysis of render and interaction hot paths, including the new interaction manager / idle controllers split |
| `timeline_migration_helper` | Export/docs sync checks for timeline APIs, plugins, types, and MCP service docs/version drift |

## Quick Start

- Install dependencies at the repo root: `pnpm install`
- Start the MCP server (stdio): `pnpm mcp`

Equivalent local command: `pnpm -C packages/mcp-service start`

## VS Code / Copilot Chat Config

This repo includes a sample config at `.vscode/mcp.json`.

### Option A — Local Development

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

### Option B — npm / npx

```json
{
  "mcpServers": {
    "timeline-canvas": {
      "command": "npx",
      "args": ["-y", "timeline-canvas-mcp@latest"],
      "env": {
        "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

## Verify

Ask Copilot Chat to run:

- `timeline_list_builtin_plugins`
- `timeline_validate_plugin` with no args
- `timeline_consistency_check`
- `timeline_migration_helper` with `{ "scope": "mcp" }`

See the full guides in [README_CN.md](README_CN.md) and [docs/en/guide/mcp.md](../../docs/en/guide/mcp.md).
