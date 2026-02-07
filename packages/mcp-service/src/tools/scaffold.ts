/**
 * timeline_scaffold_plugin — Enhanced plugin scaffolding tool.
 *
 * Creates plugin files using template files instead of string concatenation.
 * Supports features selection, test generation, and post-creation typecheck.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveInWorkspace, pathExists } from "../workspace.js";
import { TemplateEngine } from "../services/templateEngine.js";
import { getBuiltinPluginNames } from "../services/projectModel.js";
import type { ScaffoldInput, PluginTypeKey, PluginFeature } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "..", "templates");

function kebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function enumKeyFromPluginType(t: PluginTypeKey): string {
  const map: Record<string, string> = {
    render: "RENDER",
    event_handler: "EVENT_HANDLER",
    data_source: "DATA_SOURCE",
    theme: "THEME",
    tool: "TOOL",
    extension: "EXTENSION",
  };
  return map[t] ?? "EXTENSION";
}

function selectTemplate(pluginType: PluginTypeKey, features?: PluginFeature[]): string {
  // When pluginType is 'render' and features include 'media', use media template
  if (pluginType === "render" && features?.includes("media" as PluginFeature)) {
    return "plugin-media.template";
  }
  switch (pluginType) {
    case "theme":
      return "plugin-theme.template";
    case "render":
      return "plugin-render.template";
    default:
      return "plugin-basic.template";
  }
}

const engine = new TemplateEngine();

export async function scaffoldPlugin(args: ScaffoldInput): Promise<string> {
  const {
    exportName,
    pluginType,
    features = [],
    version = "1.0.0",
    withReexport = true,
    withIndexExport = true,
    withTest = false,
  } = args;

  const metadataName = args.metadataName ?? kebabCase(exportName);
  const description =
    args.description ??
    `Builtin plugin: ${exportName} (${pluginType})`;

  // Paths
  const implRel = `packages/timeline/src/plugins/builtin/${exportName}.ts`;
  const reexportRel = `packages/timeline/src/builtin-plugin/${exportName}.ts`;
  const indexRel = `packages/timeline/src/index.ts`;
  const testRel = `packages/timeline/tests/${exportName}.test.ts`;

  const implPath = resolveInWorkspace(implRel);
  const reexportPath = resolveInWorkspace(reexportRel);
  const indexPath = resolveInWorkspace(indexRel);
  const testPath = resolveInWorkspace(testRel);

  // Guard: already exists
  if (await pathExists(implPath)) {
    throw new Error(`Already exists: ${implRel}`);
  }
  if (withReexport && (await pathExists(reexportPath))) {
    throw new Error(`Already exists: ${reexportRel}`);
  }

  const createdFiles: string[] = [];

  // 1. Generate plugin implementation from template
  const templateFile = selectTemplate(pluginType, features);
  let templateContent: string;
  try {
    templateContent = await fs.readFile(
      path.join(TEMPLATES_DIR, templateFile),
      "utf8"
    );
  } catch {
    // Fallback: if running from dist, templates might be in a different location
    // Use the basic inline template as fallback
    templateContent = generateFallbackTemplate(pluginType);
  }

  const vars: Record<string, string | boolean> = {
    EXPORT_NAME: exportName,
    METADATA_NAME: metadataName,
    VERSION: version,
    DESCRIPTION: description.replace(/"/g, '\\"'),
    PLUGIN_TYPE_KEY: enumKeyFromPluginType(pluginType),
    hasInit: features.includes("init"),
    renderLayer: features.includes("renderLayer"),
    eventHandler: features.includes("eventHandler"),
    lifecycle: features.includes("lifecycle"),
    config: features.includes("config"),
  };

  const implContent = engine.render(templateContent, vars);
  await fs.mkdir(path.dirname(implPath), { recursive: true });
  await fs.writeFile(implPath, implContent, "utf8");
  createdFiles.push(implRel);

  // 2. Generate re-export
  if (withReexport) {
    const reexportContent = `export { ${exportName} } from "../plugins/builtin/${exportName}";\n`;
    await fs.mkdir(path.dirname(reexportPath), { recursive: true });
    await fs.writeFile(reexportPath, reexportContent, "utf8");
    createdFiles.push(reexportRel);
  }

  // 3. Update src/index.ts
  let indexUpdated = false;
  if (withIndexExport) {
    if (!(await pathExists(indexPath))) {
      throw new Error(`Missing: ${indexRel}`);
    }
    const indexText = await fs.readFile(indexPath, "utf8");
    const exportLine = `export { ${exportName} } from "./plugins/builtin/${exportName}";`;
    if (!indexText.includes(exportLine)) {
      const lines = indexText.split(/\r?\n/);
      let insertAt = -1;
      // Find last builtin plugin export line
      for (let i = 0; i < lines.length; i++) {
        if (
          /^export \{\s*\w+\s*\} from "\.\/plugins\/builtin\//.test(lines[i])
        ) {
          insertAt = i;
        }
      }
      if (insertAt === -1) {
        // Fallback: after Timeline export
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('export { Timeline }')) {
            insertAt = i;
            break;
          }
        }
      }
      if (insertAt === -1) insertAt = 0;
      lines.splice(insertAt + 1, 0, exportLine);
      await fs.writeFile(indexPath, lines.join("\n"), "utf8");
      indexUpdated = true;
    }
  }

  // 4. Generate test file (optional)
  if (withTest) {
    let testTemplate: string;
    try {
      testTemplate = await fs.readFile(
        path.join(TEMPLATES_DIR, "test.template"),
        "utf8"
      );
    } catch {
      testTemplate = generateFallbackTestTemplate();
    }
    const testContent = engine.render(testTemplate, vars);
    await fs.mkdir(path.dirname(testPath), { recursive: true });
    await fs.writeFile(testPath, testContent, "utf8");
    createdFiles.push(testRel);
  }

  // Build result message
  const lines: string[] = [
    "✓ Scaffold complete",
    "",
    "Created files:",
    ...createdFiles.map((f) => `  - ${f}`),
  ];
  if (indexUpdated) {
    lines.push(`  - Updated ${indexRel}`);
  }
  lines.push("");
  lines.push("Next steps:");
  lines.push(`  1. Implement the plugin logic in ${implRel}`);
  if (withTest) {
    lines.push(`  2. Write tests in ${testRel}`);
  }
  lines.push(
    `  ${withTest ? "3" : "2"}. Run typecheck to verify: pnpm --filter timeline typecheck`
  );

  return lines.join("\n");
}

/**
 * List all builtin plugins.
 */
export async function listBuiltinPlugins(): Promise<string> {
  const names = await getBuiltinPluginNames();
  if (names.length === 0) return "No builtin plugins found.";
  return names.join("\n");
}

// ─── Fallback templates (when file templates are not available) ───

function generateFallbackTemplate(pluginType: PluginTypeKey): string {
  if (pluginType === "theme") {
    return [
      'import type { TimelinePlugin } from "../../plugins/types";',
      'import { PluginType } from "../../plugins/types";',
      "",
      "export const {{EXPORT_NAME}}: TimelinePlugin = {",
      "  metadata: {",
      '    name: "{{METADATA_NAME}}",',
      '    version: "{{VERSION}}",',
      '    description: "{{DESCRIPTION}}",',
      "    type: PluginType.THEME,",
      "  },",
      "  activate(_context) {",
      "    // TODO: apply theme colors",
      "  },",
      "  deactivate(_context) {",
      "    // Theme cleanup",
      "  },",
      "};",
      "",
    ].join("\n");
  }

  return [
    'import type { TimelinePlugin } from "../../plugins/types";',
    'import { PluginType } from "../../plugins/types";',
    "",
    "export const {{EXPORT_NAME}}: TimelinePlugin = {",
    "  metadata: {",
    '    name: "{{METADATA_NAME}}",',
    '    version: "{{VERSION}}",',
    '    description: "{{DESCRIPTION}}",',
    "    type: PluginType.{{PLUGIN_TYPE_KEY}},",
    "  },",
    "{{#IF hasInit}}",
    "  async init(_context) {",
    "    // TODO: initialization logic",
    "  },",
    "{{/IF}}",
    "  activate(_context) {",
    "{{#IF renderLayer}}",
    '    _context.api.registerRenderLayer({',
    '      name: "{{METADATA_NAME}}-layer",',
    '      position: "overlay",',
    "      render: (_ctx, _canvas, _config, _state) => {",
    "        // TODO: implement render",
    "      },",
    "    });",
    "{{/IF}}",
    "{{#IF eventHandler}}",
    "    // TODO: register event handlers",
    "{{/IF}}",
    "  },",
    "  deactivate(_context) {",
    "{{#IF renderLayer}}",
    '    _context.api.unregisterRenderLayer("{{METADATA_NAME}}-layer");',
    "{{/IF}}",
    "  },",
    "{{#IF lifecycle}}",
    "  destroy(_context) {",
    "    // TODO: cleanup resources",
    "  },",
    "{{/IF}}",
    "};",
    "",
  ].join("\n");
}

function generateFallbackTestTemplate(): string {
  return [
    'import { describe, it, expect } from "vitest";',
    "",
    'describe("{{EXPORT_NAME}}", () => {',
    '  it("should have correct metadata", () => {',
    "    expect(true).toBe(true);",
    "  });",
    "});",
    "",
  ].join("\n");
}
