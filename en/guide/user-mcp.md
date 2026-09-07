`timeline-canvas-user-mcp` is a read-only stdio MCP server for agents that help application teams integrate `timeline-canvas` or create external plugins. The server works against a normal user project with the published `timeline-canvas` dependency; it does not require the `timeline-canvas` source repository and does not expose repository-maintenance tools.

## Choose a Server

| Task | Package | Set `MCP_WORKSPACE_ROOT` to | Tools |
|---|---|---|---|
| Integrate the library or develop an external plugin | `timeline-canvas-user-mcp` | The user application repository | Framework guides, returned plugin templates, and public-API validation |
| Maintain or refactor this repository | `timeline-canvas-mcp` | The `timeline-canvas` source repository | 10 tools for built-in plugin scaffolding, semantic analysis, consistency checks, refactors, performance annotations, and migration checks |

Enable only the server needed for the current workspace by default. The servers do not automatically register or start each other. For repository work, use the [maintainer MCP guide](/timeline-canvas/en/guide/mcp.md).

## Package Status and Requirements

The current user MCP package is `timeline-canvas-user-mcp@0.1.0`. Start it from npm with:

```bash
MCP_WORKSPACE_ROOT=/absolute/path/to/user-project npx -y timeline-canvas-user-mcp@latest
```

Local source builds and `pnpm pack` tarballs remain available for MCP package development.

Runtime requirements match the repository:

* Node.js `^22.22.2 || ^24.15.0 || >=26.0.0`
* CI uses Node.js 24.20.0
* The user application installs `timeline-canvas`

The templates use only public APIs and have been verified against `timeline-canvas@1.4.1` and the current `timeline-canvas@1.5.0` release. Every successful tool response includes a `project` object:

| Field | Meaning |
|---|---|
| `root` | Resolved user-project root |
| `installedVersion` | Version resolved from the user project's installed `timeline-canvas`, or `null` |
| `testedVersion` | Current template test target, `1.5.0` |
| `compatibility` | `tested-version` for installed `1.4.1` or `1.5.0`; `unverified-version` for any other installed version; `not-installed` when the package cannot be resolved |

Run `timeline_user_validate_plugin` for every generated or adapted plugin against the user project's installed public declarations. `tested-version` records known template verification and does not validate the application's plugin code.

## Read-only Model

The server exposes exactly three tools. None of them writes application files.

```text
guide or generate request
        |
        v
files: [{ path, content }] + notes
(generate also returns usage)
        |
        v
calling agent reviews and applies files

validator request
        |
        v
read plugin + installed public declarations
        |
        v
TypeScript diagnostics and static hints
```

The calling agent controls every change to the user repository. A generated `path` is a suggested destination, and `content` is the proposed file body.

## Start from This Repository

Install and build at the `timeline-canvas` repository root:

```bash
pnpm install
pnpm -C packages/user-mcp-service build
```

The root development command is:

```bash
MCP_WORKSPACE_ROOT=/absolute/path/to/user-project pnpm mcp:user
```

An MCP client attached to another project should launch the built bin file by absolute path:

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

For VS Code stdio servers, set `MCP_WORKSPACE_ROOT` to the absolute target-project path. Plugin validation resolves public types from that project's installed dependencies.

## Install a Local Tarball

Build and create the npm package archive:

```bash
pnpm -C /path/to/timeline-canvas/packages/user-mcp-service build
pnpm -C /path/to/timeline-canvas/packages/user-mcp-service pack
```

The package directory receives `timeline-canvas-user-mcp-0.1.0.tgz`. Install that file into the user project:

```bash
pnpm --dir /absolute/path/to/user-project add -D \
  /path/to/timeline-canvas/packages/user-mcp-service/timeline-canvas-user-mcp-0.1.0.tgz
```

Point the MCP client at the installed executable:

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

For the npm package, clients may use:

```json
{
  "servers": {
    "timeline-canvas-user": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "timeline-canvas-user-mcp@latest"],
      "env": {
        "MCP_WORKSPACE_ROOT": "/absolute/path/to/user-project"
      }
    }
  }
}
```

## `timeline_user_get_guide`

Returns a small integration guide for one supported application framework.

Input:

```ts
{
  framework: "vanilla" | "react" | "vue";
}
```

Example:

```json
{ "framework": "react" }
```

The response contains `files: [{ path, content }]` and notes. The files are returned to the calling agent and are not created by the MCP server.

## `timeline_user_generate_plugin`

Returns source for an external plugin based on one of three templates.

Input:

```ts
{
  template: "basic" | "render" | "event-handler";
  exportName?: string; // defaults to "createCustomPlugin"
  name?: string;
  description?: string;
}
```

Templates:

| Template | Use |
|---|---|
| `basic` | Minimal `TimelinePlugin` factory |
| `render` | Plugin with custom rendering behavior |
| `event-handler` | Plugin that handles timeline events |

Example:

```json
{
  "template": "render",
  "exportName": "createCustomPlugin",
  "name": "release-markers",
  "description": "Render release markers above timeline events"
}
```

The response contains `files: [{ path, content }]`, usage, notes, the installed library version, the template `testedVersion`, and a compatibility status. The templates use only public APIs and are tested against `timeline-canvas@1.4.1` and `timeline-canvas@1.5.0`; the current `testedVersion` is `1.5.0`. The agent applies the returned source after review.

## `timeline_user_validate_plugin`

Checks one external plugin against the public declarations installed in the user application.

Input:

```ts
{
  filePath: string;
  exportName: string;
}
```

Example:

```json
{
  "filePath": "src/timeline-plugin.ts",
  "exportName": "createCustomPlugin"
}
```

The validator resolves `filePath` below `MCP_WORKSPACE_ROOT`. When the environment variable is absent, it uses the server process working directory. The user project's installed `timeline-canvas` package supplies the public type declarations.

TypeScript 6 checks the file and confirms that the selected export is either:

* a value assignable to `TimelinePlugin`; or
* a factory whose return value is assignable to `TimelinePlugin`.

The report may include limited static hints about lifecycle patterns. These hints supplement type checking and do not execute the plugin. `checks.runtime` is always `not-run`.

The validator does not:

* import or run plugin code;
* inspect real Canvas output;
* measure rendering or interaction performance;
* prove browser or runtime behavior.

## Recommended Workflow

1. Call `timeline_user_get_guide` for the application's framework and have the agent review and apply the returned files.
2. Call `timeline_user_generate_plugin` with the smallest suitable template and have the agent apply the returned source.
3. Install the application's normal dependencies, including `timeline-canvas`.
4. Call `timeline_user_validate_plugin` for the generated plugin and selected export.
5. Run the application's own type checks, tests, and visual or performance checks as appropriate.

The user MCP server does not require the `timeline-canvas` source tree and does not expose or invoke the maintainer MCP tools.
