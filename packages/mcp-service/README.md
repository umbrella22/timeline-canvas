# timeline-canvas MCP Server

This MCP server exposes repo-specific tools over stdio to help an AI agent scaffold and validate builtin plugins.

- Repo scripts: allowlisted via `timeline_run_repo_script`
- MCP folder scripts: allowlisted via `timeline_run_mcp_script`

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
      "args": ["-y", "timeline-canvas-mcp@1.0.0"],
      "env": {
        "MCP_WORKSPACE_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

## Verify

Ask Copilot Chat to run `timeline_repo_map` or `timeline_list_builtin_plugins`.

See the full tool list in [packages/mcp-service/README_CN.md](README_CN.md).
