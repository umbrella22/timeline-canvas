import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { scaffoldPlugin, listBuiltinPlugins } from "./tools/scaffold.js";
import { validatePlugin } from "./tools/validate.js";
import { dependencyGraph } from "./tools/dependencyGraph.js";
import { typeQuery } from "./tools/typeQuery.js";
import { consistencyCheck } from "./tools/consistencyCheck.js";
import { perfAnnotate } from "./tools/perfAnnotate.js";
import { migrationHelper } from "./tools/migrationHelper.js";
import { ok, fail } from "./types.js";

async function main() {
  const server = new McpServer({
    name: "timeline-canvas-mcp",
    version: "2.0.0",
  });

  // ─── P0: Scaffold Plugin (rewrite) ───

  server.registerTool(
    "timeline_scaffold_plugin",
    {
      title: "Scaffold Plugin",
      description:
        "Create a new builtin plugin with template-based generation. " +
        "Generates implementation, re-export, index.ts wiring, and optional test file. " +
        "Supports feature selection for different plugin skeletons.",
      inputSchema: {
        exportName: z
          .string()
          .min(1)
          .regex(
            /^[A-Za-z_$][A-Za-z0-9_$]*$/,
            "exportName must be a valid JS identifier"
          )
          .describe("The exported symbol name (e.g. MyPlugin)"),
        pluginType: z
          .enum([
            "render",
            "event_handler",
            "data_source",
            "theme",
            "tool",
            "extension",
          ])
          .describe("The plugin type category"),
        features: z
          .array(
            z.enum(["renderLayer", "eventHandler", "config", "lifecycle", "init"])
          )
          .optional()
          .default([])
          .describe(
            "Optional features to include in the skeleton code"
          ),
        metadataName: z
          .string()
          .min(1)
          .optional()
          .describe("Plugin metadata name (defaults to kebab-case of exportName)"),
        description: z.string().min(1).optional(),
        version: z.string().min(1).optional().default("1.0.0"),
        withReexport: z
          .boolean()
          .optional()
          .default(true)
          .describe("Create re-export in builtin-plugin/"),
        withIndexExport: z
          .boolean()
          .optional()
          .default(true)
          .describe("Add export to src/index.ts"),
        withTest: z
          .boolean()
          .optional()
          .default(false)
          .describe("Generate a test file skeleton"),
      },
    },
    async (input) => {
      try {
        return ok(await scaffoldPlugin(input));
      } catch (err) {
        return fail(err);
      }
    }
  );

  // ─── P0: Validate Plugin (enhanced) ───

  server.registerTool(
    "timeline_validate_plugin",
    {
      title: "Validate Plugin",
      description:
        "Validate builtin plugin integrity: file existence, export wiring, " +
        "metadata fields, activate/deactivate pairs, re-export consistency, " +
        "and TODO markers. Pass no name to check ALL builtin plugins.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .optional()
          .describe("Plugin name to validate. Omit to validate all."),
      },
    },
    async (input) => {
      try {
        return ok(await validatePlugin(input));
      } catch (err) {
        return fail(err);
      }
    }
  );

  // ─── List Builtin Plugins ───

  server.registerTool(
    "timeline_list_builtin_plugins",
    {
      title: "List Builtin Plugins",
      description: "List all builtin plugin names under src/plugins/builtin.",
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await listBuiltinPlugins());
      } catch (err) {
        return fail(err);
      }
    }
  );

  // ─── P1: Dependency Graph ───

  server.registerTool(
    "timeline_dependency_graph",
    {
      title: "Dependency Graph",
      description:
        "Query symbol dependency relationships using TypeScript semantic analysis. " +
        "Find who depends on a symbol (dependents), what it depends on (dependencies), or both. " +
        "Distinguishes value vs type imports.",
      inputSchema: {
        symbol: z
          .string()
          .min(1)
          .describe("Class, function, interface, or variable name to query"),
        direction: z
          .enum(["dependents", "dependencies", "both"])
          .describe(
            "'dependents' = who uses it, 'dependencies' = what it uses, 'both' = bidirectional"
          ),
        depth: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .default(1)
          .describe("Recursion depth (default 1)"),
      },
    },
    async (input) => {
      try {
        return ok(await dependencyGraph(input));
      } catch (err) {
        return fail(err);
      }
    }
  );

  // ─── P1: Type Query ───

  server.registerTool(
    "timeline_type_query",
    {
      title: "Type Query",
      description:
        "Inspect TypeScript type definitions and member usage patterns. " +
        "Shows full interface/type/class/enum definition with member types. " +
        "Optionally tracks where a specific member is read or written.",
      inputSchema: {
        type: z
          .string()
          .min(1)
          .describe("Type/interface/class/enum name to inspect"),
        member: z
          .string()
          .min(1)
          .optional()
          .describe("Optional member name to find read/write usages of"),
      },
    },
    async (input) => {
      try {
        return ok(await typeQuery(input));
      } catch (err) {
        return fail(err);
      }
    }
  );

  // ─── P1: Consistency Check ───

  server.registerTool(
    "timeline_consistency_check",
    {
      title: "Consistency Check",
      description:
        "Run project-specific consistency validations: " +
        "plugin-exports, render-layers, state-fields, change-types, boundary-conditions. " +
        "Detects structural mismatches that grep cannot find.",
      inputSchema: {
        checks: z
          .array(
            z.enum([
              "plugin-exports",
              "render-layers",
              "state-fields",
              "change-types",
              "boundary-conditions",
            ])
          )
          .optional()
          .describe("Specific checks to run. Omit for all checks."),
      },
    },
    async (input) => {
      try {
        return ok(await consistencyCheck(input));
      } catch (err) {
        return fail(err);
      }
    }
  );

  // ─── P2: Performance Annotate ───

  server.registerTool(
    "timeline_perf_annotate",
    {
      title: "Performance Annotate",
      description:
        "Static analysis of rendering hot paths. " +
        "Detects O(N) operations in loops, GC-pressure allocations, " +
        "missing visibility culling, and other performance anti-patterns.",
      inputSchema: {
        target: z
          .enum(["render", "highlight", "interaction", "all"])
          .describe("Which subsystem to analyze"),
      },
    },
    async (input) => {
      try {
        return ok(await perfAnnotate(input));
      } catch (err) {
        return fail(err);
      }
    }
  );

  // ─── P2: Migration Helper ───

  server.registerTool(
    "timeline_migration_helper",
    {
      title: "Migration Helper",
      description:
        "Compare current exports with documentation to detect sync issues: " +
        "new exports not yet documented, documented APIs that were removed, " +
        "and PluginType enum vs scaffold template mismatches.",
      inputSchema: {
        scope: z
          .enum(["api", "types", "plugins"])
          .describe(
            "'api' = all exports, 'types' = type exports, 'plugins' = plugin exports + PluginType check"
          ),
      },
    },
    async (input) => {
      try {
        return ok(await migrationHelper(input));
      } catch (err) {
        return fail(err);
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
