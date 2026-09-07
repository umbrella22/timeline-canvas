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
let scaffoldQueue: Promise<void> = Promise.resolve();

function encodeStringLiteral(value: string): string {
  return JSON.stringify(value);
}

async function readTemplate(fileName: string): Promise<string> {
  try {
    return await fs.readFile(path.join(TEMPLATES_DIR, fileName), "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
  }

  throw new Error(`Missing scaffold template: ${fileName} (searched ${TEMPLATES_DIR})`);
}

async function writeNewFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
}

async function replaceFileAtomically(filePath: string, content: string): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

function addIndexExport(indexText: string, exportName: string): string | null {
  const exportLine = `export { ${exportName} } from "./plugins/builtin/${exportName}";`;
  if (indexText.includes(exportLine)) return null;

  const lines = indexText.split(/\r?\n/);
  let insertAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^export \{\s*\w+\s*\} from "\.\/plugins\/builtin\//.test(lines[i])) {
      insertAt = i;
    }
  }
  if (insertAt === -1) {
    insertAt = lines.findIndex((line) => line.includes("export { Timeline }"));
  }
  if (insertAt === -1) insertAt = 0;
  lines.splice(insertAt + 1, 0, exportLine);
  return lines.join("\n");
}

export function scaffoldPlugin(args: ScaffoldInput): Promise<string> {
  const operation = scaffoldQueue.then(() => scaffoldPluginTransaction(args));
  scaffoldQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

async function scaffoldPluginTransaction(args: ScaffoldInput): Promise<string> {
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
  const description = args.description ?? `Builtin plugin: ${exportName} (${pluginType})`;

  const implRel = `packages/timeline/src/plugins/builtin/${exportName}.ts`;
  const reexportRel = `packages/timeline/src/builtin-plugin/${exportName}.ts`;
  const indexRel = `packages/timeline/src/index.ts`;
  const testRel = `packages/timeline/tests/${exportName}.spec.ts`;

  const implPath = resolveInWorkspace(implRel);
  const reexportPath = resolveInWorkspace(reexportRel);
  const indexPath = resolveInWorkspace(indexRel);
  const testPath = resolveInWorkspace(testRel);

  const templateFile = selectTemplate(pluginType, features);
  const templateContent = await readTemplate(templateFile);
  const testTemplate = withTest ? await readTemplate("test.template") : null;

  const vars: Record<string, string | boolean> = {
    EXPORT_NAME: exportName,
    EXPORT_NAME_LITERAL: encodeStringLiteral(exportName),
    METADATA_NAME_LITERAL: encodeStringLiteral(metadataName),
    VERSION_LITERAL: encodeStringLiteral(version),
    DESCRIPTION_LITERAL: encodeStringLiteral(description),
    RENDER_LAYER_NAME_LITERAL: encodeStringLiteral(`${metadataName}-layer`),
    MEDIA_CACHE_KEY_LITERAL: encodeStringLiteral(`${metadataName}_cache`),
    MEDIA_HANDLER_KEY_LITERAL: encodeStringLiteral(`${metadataName}_handler`),
    PLUGIN_TYPE_KEY: enumKeyFromPluginType(pluginType),
    factoryPlugin: templateFile === "plugin-media.template",
    hasInit: features.includes("init"),
    renderLayer: features.includes("renderLayer"),
    eventHandler: features.includes("eventHandler"),
    lifecycle: features.includes("lifecycle"),
    config: features.includes("config"),
  };

  const implContent = engine.render(templateContent, vars);
  const filesToCreate = [
    { relativePath: implRel, filePath: implPath, content: implContent },
    ...(withReexport
      ? [
          {
            relativePath: reexportRel,
            filePath: reexportPath,
            content: `export { ${exportName} } from "../plugins/builtin/${exportName}";\n`,
          },
        ]
      : []),
    ...(withTest && testTemplate
      ? [
          {
            relativePath: testRel,
            filePath: testPath,
            content: engine.render(testTemplate, vars),
          },
        ]
      : []),
  ];

  const indexText = withIndexExport
    ? await fs.readFile(indexPath, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") throw new Error(`Missing: ${indexRel}`);
        throw error;
      })
    : null;
  const updatedIndexText = indexText === null ? null : addIndexExport(indexText, exportName);

  const existing = await Promise.all(
    filesToCreate.map(async (file) =>
      (await pathExists(file.filePath)) ? file.relativePath : null,
    ),
  );
  const existingPath = existing.find((file): file is string => file !== null);
  if (existingPath) throw new Error(`Already exists: ${existingPath}`);

  const createdFiles: string[] = [];
  try {
    for (const file of filesToCreate) {
      try {
        await writeNewFile(file.filePath, file.content);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          throw new Error(`Already exists: ${file.relativePath}`);
        }
        throw error;
      }
      createdFiles.push(file.relativePath);
    }

    if (updatedIndexText !== null) {
      await replaceFileAtomically(indexPath, updatedIndexText);
    }
  } catch (error) {
    await Promise.allSettled(
      createdFiles.map((relativePath) => fs.rm(resolveInWorkspace(relativePath))),
    );
    throw error;
  }

  const indexUpdated = updatedIndexText !== null;

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
    `  ${withTest ? "3" : "2"}. Run typecheck to verify: pnpm --filter timeline-canvas typecheck`,
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
