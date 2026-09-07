import { readFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getUsageGuide } from "./guides.js";
import { generatePlugin } from "./generate-plugin.js";
import { inspectProject } from "./project.js";
import { validatePlugin } from "./validate-plugin.js";

const projectSchema = z.object({
  root: z.string(),
  installedVersion: z.string().nullable(),
  testedVersion: z.string(),
  compatibility: z.enum(["tested-version", "unverified-version", "not-installed"]),
});
const filesSchema = z.array(z.object({ path: z.string(), content: z.string() }));
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

function ok(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function fail(error: unknown) {
  return {
    content: [
      { type: "text" as const, text: error instanceof Error ? error.message : String(error) },
    ],
    isError: true,
  };
}

async function main(): Promise<void> {
  const root = path.resolve(process.env.MCP_WORKSPACE_ROOT ?? process.cwd());
  const { version } = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  const server = new McpServer(
    { name: "timeline-canvas-user-mcp", version },
    {
      instructions:
        "Application integration and external plugin development for timeline-canvas. Generated files are returned for the calling agent to review and apply. Validation is static and uses the consumer project's installed public types. Set MCP_WORKSPACE_ROOT to that project. Repository maintenance is provided by the separate timeline-canvas-mcp server.",
    },
  );
  server.registerTool(
    "timeline_user_get_guide",
    {
      title: "Timeline Integration Guide",
      description:
        "Return a complete public-API integration example for vanilla TypeScript, React, or Vue, including cleanup and installed package version context. Does not create files or install dependencies.",
      annotations,
      inputSchema: { framework: z.enum(["vanilla", "react", "vue"]) },
      outputSchema: {
        project: projectSchema,
        framework: z.string(),
        files: filesSchema,
        notes: z.array(z.string()),
      },
    },
    async (input) => {
      try {
        return ok({ project: inspectProject(root).info, ...getUsageGuide(input) });
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.registerTool(
    "timeline_user_generate_plugin",
    {
      title: "Generate External Timeline Plugin",
      description:
        "Return an external plugin factory and registration example using public timeline-canvas imports. The caller applies returned files to its application. Templates cover basic, render, and event-handler plugins and do not modify the timeline library.",
      annotations,
      inputSchema: {
        template: z.enum(["basic", "render", "event-handler"]),
        exportName: z.string().min(1).default("createCustomPlugin"),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
      },
      outputSchema: {
        project: projectSchema,
        files: filesSchema,
        usage: z.string(),
        notes: z.array(z.string()),
      },
    },
    async (input) => {
      try {
        return ok({ project: inspectProject(root).info, ...generatePlugin(input) });
      } catch (error) {
        return fail(error);
      }
    },
  );
  server.registerTool(
    "timeline_user_validate_plugin",
    {
      title: "Validate External Timeline Plugin",
      description:
        "Read a plugin file in the consumer project, typecheck it, and verify the named export is a TimelinePlugin object or factory against the installed public declarations. Returns diagnostics and lifecycle review hints. Does not execute or modify plugin code; runtime and complete cleanup checks remain unverified.",
      annotations,
      inputSchema: {
        filePath: z.string().min(1).describe("Plugin source path inside MCP_WORKSPACE_ROOT."),
        exportName: z
          .string()
          .min(1)
          .describe("Named or default export of the plugin object or factory."),
      },
      outputSchema: {
        project: projectSchema,
        status: z.enum(["passed", "failed", "blocked"]),
        exportName: z.string(),
        diagnostics: z.array(
          z.object({
            severity: z.enum(["error", "warning"]),
            code: z.string(),
            message: z.string(),
            file: z.string().optional(),
            line: z.number().optional(),
            column: z.number().optional(),
          }),
        ),
        checks: z.object({
          types: z.enum(["passed", "failed", "not-run"]),
          pluginContract: z.enum(["passed", "failed", "not-run"]),
          lifecycle: z.enum(["review-required", "not-run"]),
          runtime: z.literal("not-run"),
        }),
        notes: z.array(z.string()),
      },
    },
    async (input) => {
      try {
        return ok({ ...(await validatePlugin(root, input)) });
      } catch (error) {
        return fail(error);
      }
    },
  );
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
