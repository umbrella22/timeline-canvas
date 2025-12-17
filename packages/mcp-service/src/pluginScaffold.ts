import * as fs from "node:fs/promises";
import * as path from "node:path";

import { pathExists, resolveInWorkspace } from "./workspace.js";

function kebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function enumKeyFromPluginType(t: string): string {
  const map: Record<string, string> = {
    render: "RENDER",
    event_handler: "EVENT_HANDLER",
    data_source: "DATA_SOURCE",
    theme: "THEME",
    tool: "TOOL",
    extension: "EXTENSION",
  };
  const key = map[t];
  if (!key) throw new Error(`Unsupported pluginType: ${t}`);
  return key;
}

export async function scaffoldBuiltinPlugin(args: {
  exportName: string;
  pluginType:
    | "render"
    | "event_handler"
    | "data_source"
    | "theme"
    | "tool"
    | "extension";
  metadataName?: string;
  description?: string;
  version?: string;
  withReexport?: boolean;
  withIndexExport?: boolean;
}): Promise<string> {
  const exportName = args.exportName;
  const implRel = `packages/timeline/src/plugins/builtin/${exportName}.ts`;
  const reexportRel = `packages/timeline/src/builtin-plugin/${exportName}.ts`;
  const indexRel = `packages/timeline/src/index.ts`;

  const implPath = resolveInWorkspace(implRel);
  const reexportPath = resolveInWorkspace(reexportRel);
  const indexPath = resolveInWorkspace(indexRel);

  if (await pathExists(implPath)) {
    throw new Error(`Already exists: ${implRel}`);
  }
  const withReexport = args.withReexport ?? true;
  const withIndexExport = args.withIndexExport ?? true;
  const version = args.version ?? "1.0.0";

  if (withReexport && (await pathExists(reexportPath))) {
    throw new Error(`Already exists: ${reexportRel}`);
  }

  const metadataName = args.metadataName ?? kebabCase(exportName);
  const description =
    args.description ?? `Builtin plugin: ${exportName} (${args.pluginType})`;
  const typeKey = enumKeyFromPluginType(args.pluginType);

  const implContent =
    `import type { TimelinePlugin } from "../types";\n` +
    `import { PluginType } from "../types";\n\n` +
    `export const ${exportName}: TimelinePlugin = {\n` +
    `  metadata: {\n` +
    `    name: "${metadataName}",\n` +
    `    version: "${version}",\n` +
    `    description: "${description.replace(/"/g, '\\"')}",\n` +
    `    type: PluginType.${typeKey},\n` +
    `  },\n` +
    `  activate(_context) {\n` +
    `    // TODO: implement\n` +
    `  },\n` +
    `  deactivate(_context) {\n` +
    `    // TODO: cleanup\n` +
    `  },\n` +
    `};\n`;

  await fs.mkdir(path.dirname(implPath), { recursive: true });
  await fs.writeFile(implPath, implContent, "utf8");

  if (withReexport) {
    const reexportContent = `export { ${exportName} } from "../plugins/builtin/${exportName}";\n`;
    await fs.mkdir(path.dirname(reexportPath), { recursive: true });
    await fs.writeFile(reexportPath, reexportContent, "utf8");
  }

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
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^export \{\s*\w+\s*\} from "\.\/plugins\/builtin\//.test(l)) {
          insertAt = i;
        }
      }
      if (insertAt === -1) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('export { Timeline } from "./core/Timeline"')) {
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

  return (
    `Created ${implRel}` +
    (withReexport ? `\nCreated ${reexportRel}` : "") +
    (withIndexExport
      ? `\n${indexUpdated ? "Updated" : "No change"} ${indexRel}`
      : "")
  );
}

export async function validateBuiltinPlugin(args: {
  exportName: string;
}): Promise<string> {
  const exportName = args.exportName;

  const implRel = `packages/timeline/src/plugins/builtin/${exportName}.ts`;
  const reexportRel = `packages/timeline/src/builtin-plugin/${exportName}.ts`;
  const indexRel = `packages/timeline/src/index.ts`;

  const implPath = resolveInWorkspace(implRel);
  const reexportPath = resolveInWorkspace(reexportRel);
  const indexPath = resolveInWorkspace(indexRel);

  const problems: string[] = [];

  if (!(await pathExists(implPath))) problems.push(`Missing ${implRel}`);
  if (!(await pathExists(reexportPath)))
    problems.push(`Missing ${reexportRel}`);
  if (await pathExists(implPath)) {
    const text = await fs.readFile(implPath, "utf8");
    const ok =
      new RegExp(`export\\s+(const|function)\\s+${exportName}\\b`).test(text) ||
      new RegExp(`export\\s*\\{[^}]*\\b${exportName}\\b[^}]*\\}`).test(text);
    if (!ok) problems.push(`No exported symbol '${exportName}' in ${implRel}`);
  }
  if (await pathExists(indexPath)) {
    const text = await fs.readFile(indexPath, "utf8");
    const exportLine = `export { ${exportName} } from "./plugins/builtin/${exportName}";`;
    if (!text.includes(exportLine)) {
      problems.push(`Missing export in ${indexRel}: ${exportLine}`);
    }
  } else {
    problems.push(`Missing ${indexRel}`);
  }

  return problems.length === 0
    ? `OK: builtin plugin '${exportName}' looks wired up.`
    : `Problems:\n- ${problems.join("\n- ")}`;
}

export async function listBuiltinPlugins(): Promise<string> {
  const dirRel = "packages/timeline/src/plugins/builtin";
  const dirPath = resolveInWorkspace(dirRel);
  if (!(await pathExists(dirPath))) {
    return `Missing directory: ${dirRel}`;
  }
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const names = entries
    .filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => e.name.replace(/\.ts$/, ""))
    .sort((a, b) => a.localeCompare(b));
  return names.join("\n");
}
