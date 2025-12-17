import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { DEFAULT_REPO_MAP_ROOTS, DEFAULT_SEARCH_ROOTS } from "./workspace.js";
import { readLinesBounded } from "./readExcerpt.js";
import { searchWorkspace } from "./search.js";
import { buildRepoMap } from "./repoMap.js";
import { traceEntrypoints } from "./trace.js";
import {
  listBuiltinPlugins,
  scaffoldBuiltinPlugin,
  validateBuiltinPlugin,
} from "./pluginScaffold.js";
import { runMcpScript, runRepoScript } from "./scripts.js";

async function main() {
  const server = new McpServer({
    name: "timeline-canvas-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "timeline_scaffold_builtin_plugin",
    {
      title: "Scaffold Builtin Plugin",
      description:
        "Create a new builtin plugin (src/plugins/builtin + src/builtin-plugin re-export) and wire export in src/index.ts.",
      inputSchema: {
        exportName: z
          .string()
          .min(1)
          .regex(
            /^[A-Za-z_$][A-Za-z0-9_$]*$/,
            "exportName must be a valid identifier"
          ),
        pluginType: z.enum([
          "render",
          "event_handler",
          "data_source",
          "theme",
          "tool",
          "extension",
        ]),
        metadataName: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        version: z.string().min(1).optional().default("1.0.0"),
        withReexport: z.boolean().optional().default(true),
        withIndexExport: z.boolean().optional().default(true),
      },
    },
    async (input) => {
      try {
        const text = await scaffoldBuiltinPlugin(input);
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error: ${err?.message ?? String(err)}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_validate_builtin_plugin",
    {
      title: "Validate Builtin Plugin",
      description:
        "Validate builtin plugin wiring: file exists, export symbol exists, and src/index.ts exports it.",
      inputSchema: {
        exportName: z
          .string()
          .min(1)
          .regex(
            /^[A-Za-z_$][A-Za-z0-9_$]*$/,
            "exportName must be a valid identifier"
          ),
      },
    },
    async (input) => {
      try {
        const text = await validateBuiltinPlugin(input);
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error: ${err?.message ?? String(err)}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_list_builtin_plugins",
    {
      title: "List Builtin Plugins",
      description: "List builtin plugin names under src/plugins/builtin.",
      inputSchema: {},
    },
    async () => {
      try {
        const text = await listBuiltinPlugins();
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error: ${err?.message ?? String(err)}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_run_repo_script",
    {
      title: "Run Repo Script",
      description:
        "Run an allowlisted pnpm script in this repo (lint/build/typecheck/docs).",
      inputSchema: {
        script: z.enum([
          "lint",
          "build",
          "dev",
          "docs:dev",
          "docs:build",
          "typecheck",
        ]),
      },
    },
    async (input) => {
      try {
        const text = await runRepoScript(input);
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error: ${err?.message ?? String(err)}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_run_mcp_script",
    {
      title: "Run MCP Script",
      description:
        "Run an allowlisted pnpm script in packages/mcp-service (start/dev/typecheck).",
      inputSchema: {
        script: z.enum(["start", "dev", "typecheck"]),
      },
    },
    async (input) => {
      try {
        const text = await runMcpScript(input);
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error: ${err?.message ?? String(err)}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_repo_map",
    {
      title: "Repo Map",
      description:
        "Summarize key files (packages/timeline/docs/plugins/renderers/managers) to help quickly orient and locate likely code locations without bulk reading.",
      inputSchema: {
        roots: z
          .array(z.string().min(1))
          .optional()
          .default(DEFAULT_REPO_MAP_ROOTS),
        maxEntries: z.number().int().min(50).max(2000).optional().default(800),
      },
    },
    async (input) => {
      try {
        const text = await buildRepoMap(input);
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error: ${err?.message ?? String(err)}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_search",
    {
      title: "Search Workspace",
      description:
        "Search across workspace roots with line+column and small snippets. Designed for fast issue localization without rereading large files.",
      inputSchema: {
        query: z.string().min(1),
        mode: z.enum(["literal", "regex"]).optional().default("literal"),
        caseSensitive: z.boolean().optional().default(false),
        roots: z
          .array(z.string().min(1))
          .optional()
          .default(DEFAULT_SEARCH_ROOTS),
        extensions: z
          .array(z.string().min(1))
          .optional()
          .default(["ts", "tsx", "md", "mdx"]),
        maxResults: z.number().int().min(1).max(200).optional().default(30),
        contextLines: z.number().int().min(0).max(10).optional().default(2),
      },
    },
    async (input) => {
      try {
        const matches = await searchWorkspace(input);
        if (matches.length === 0) {
          return { content: [{ type: "text", text: "No matches." }] };
        }
        const lines: string[] = [];
        for (const m of matches) {
          lines.push(`${m.file}:${m.line}:${m.col}`);
          for (const s of m.snippet) {
            const mark = s.line === m.line ? ">" : " ";
            lines.push(`${mark} ${String(s.line).padStart(4, " ")}: ${s.text}`);
          }
          lines.push("---");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error: ${err?.message ?? String(err)}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_read_excerpt",
    {
      title: "Read Excerpt",
      description:
        "Read a small line range from a file (bounded) to avoid large file rereads.",
      inputSchema: {
        file: z.string().min(1),
        startLine: z.number().int().min(1),
        endLine: z.number().int().min(1),
        maxLines: z.number().int().min(1).max(500).optional().default(200),
      },
    },
    async (input) => {
      try {
        const res = await readLinesBounded(input);
        if (!res.ok) {
          return {
            content: [{ type: "text", text: `Error: ${res.error}` }],
            isError: true,
          };
        }
        const text = res.lines
          .map((l) => `${String(l.line).padStart(4, " ")}: ${l.text}`)
          .join("\n");
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error: ${err?.message ?? String(err)}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_trace_entrypoints",
    {
      title: "Trace Entrypoints",
      description:
        "Generate a navigation-friendly trace of key runtime entrypoints (Timeline → managers → handlers → render pipeline → plugin types/docs) with line hints.",
      inputSchema: {
        includeDocs: z.boolean().optional().default(true),
      },
    },
    async (input) => {
      try {
        const text = await traceEntrypoints(input);
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Error: ${err?.message ?? String(err)}` },
          ],
          isError: true,
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
