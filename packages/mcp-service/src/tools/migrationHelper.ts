/**
 * timeline_migration_helper — API change + documentation sync checker.
 *
 * Compares current src/index.ts exports with documentation to detect:
 *  - New exports not yet documented
 *  - Documented APIs that have been removed/renamed
 *  - PluginType enum mismatches with scaffold templates
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { resolveInWorkspace, pathExists, toPosixPath, IGNORED_DIRS } from "../workspace.js";
import { getIndexExports, readFile } from "../services/projectModel.js";
import type { MigrationHelperInput, MigrationDiff } from "../types.js";

const TIMELINE_SRC = "packages/timeline/src";
const DOCS_DIR = "docs";
const MCP_SERVICE_DIR = "packages/mcp-service";
const MCP_DOC_FILES = [
  `${MCP_SERVICE_DIR}/README.md`,
  `${MCP_SERVICE_DIR}/README_CN.md`,
  `${DOCS_DIR}/en/guide/mcp.md`,
  `${DOCS_DIR}/zh/guide/mcp.md`,
];
const MCP_README_FILES = [
  `${MCP_SERVICE_DIR}/README.md`,
  `${MCP_SERVICE_DIR}/README_CN.md`,
];

/**
 * Recursively find all .md/.mdx files in docs/
 */
async function findDocFiles(): Promise<string[]> {
  const absBase = resolveInWorkspace(DOCS_DIR);
  if (!(await pathExists(absBase))) return [];
  const results: string[] = [];

  async function walk(dir: string, rel: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        await walk(
          path.join(dir, entry.name),
          rel ? `${rel}/${entry.name}` : entry.name
        );
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))
      ) {
        results.push(
          toPosixPath(`${DOCS_DIR}/${rel ? rel + "/" : ""}${entry.name}`)
        );
      }
    }
  }

  await walk(absBase, "");
  return results;
}

/**
 * Extract API symbols mentioned in documentation files.
 */
async function extractDocumentedSymbols(): Promise<Set<string>> {
  const docFiles = await findDocFiles();
  const symbols = new Set<string>();

  for (const docFile of docFiles) {
    const content = await readFile(docFile);
    if (!content) continue;

    // Match code references like `Timeline`, `DarkThemePlugin`, etc.
    const codeRefs = content.matchAll(/`(\w+)`/g);
    for (const m of codeRefs) {
      symbols.add(m[1]);
    }

    // Match import statements in code blocks
    const importRefs = content.matchAll(
      /import\s+\{([^}]+)\}\s+from\s+["']timeline-canvas["']/g
    );
    for (const m of importRefs) {
      const names = m[1].split(",").map((s) => s.trim());
      for (const name of names) {
        if (name) symbols.add(name);
      }
    }
  }

  return symbols;
}

async function checkApiMigration(): Promise<MigrationDiff[]> {
  const diffs: MigrationDiff[] = [];
  const exports = await getIndexExports();
  const documentedSymbols = await extractDocumentedSymbols();

  const exportedSymbols = new Set(exports.map((e) => e.symbol));

  // Find exports not mentioned in docs
  for (const exp of exports) {
    if (!documentedSymbols.has(exp.symbol)) {
      diffs.push({
        kind: "added-not-documented",
        symbol: exp.symbol,
        details: `Exported from ${exp.from} but not found in documentation`,
      });
    }
  }

  // Find documented symbols that are no longer exported
  // Only check symbols that look like they could be API names (PascalCase)
  for (const sym of documentedSymbols) {
    if (
      /^[A-Z]\w+$/.test(sym) &&
      !exportedSymbols.has(sym) &&
      !["TODO", "NOTE", "FIXME", "README", "API"].includes(sym)
    ) {
      // Check if this was likely an export (mentioned in API docs context)
      diffs.push({
        kind: "documented-but-removed",
        symbol: sym,
        details: `Referenced in documentation but not found in current exports`,
      });
    }
  }

  return diffs;
}

async function checkTypesMigration(): Promise<MigrationDiff[]> {
  const diffs: MigrationDiff[] = [];
  const exports = await getIndexExports();
  const typeExports = exports.filter(
    (e) => e.from.includes("types") || e.from.includes("utils")
  );
  const documentedSymbols = await extractDocumentedSymbols();

  for (const exp of typeExports) {
    if (!documentedSymbols.has(exp.symbol)) {
      diffs.push({
        kind: "added-not-documented",
        symbol: exp.symbol,
        details: `Type '${exp.symbol}' exported but not documented`,
      });
    }
  }

  return diffs;
}

async function checkPluginsMigration(): Promise<MigrationDiff[]> {
  const diffs: MigrationDiff[] = [];

  // Check PluginType enum values vs scaffold template
  const pluginTypesContent = await readFile(`${TIMELINE_SRC}/plugins/types.ts`);
  if (!pluginTypesContent) {
    diffs.push({
      kind: "added-not-documented",
      symbol: "PluginType",
      details: "plugins/types.ts not found",
    });
    return diffs;
  }

  // Extract PluginType enum values
  const enumMatch = pluginTypesContent.match(
    /enum\s+PluginType\s*\{([^}]+)\}/
  );
  if (enumMatch) {
    const values: string[] = [];
    const re = /(\w+)\s*=\s*["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(enumMatch[1])) !== null) {
      values.push(m[2]); // The string value
    }

    // Check that each PluginType value is supported in scaffold
    const supportedTypes = [
      "render",
      "event_handler",
      "data_source",
      "theme",
      "tool",
      "extension",
    ];
    for (const v of values) {
      if (!supportedTypes.includes(v)) {
        diffs.push({
          kind: "added-not-documented",
          symbol: `PluginType.${v}`,
          details: `Plugin type '${v}' exists in source but not supported by scaffold tool`,
        });
      }
    }
  }

  // Check plugin documentation
  const documentedSymbols = await extractDocumentedSymbols();
  const exports = await getIndexExports();
  const pluginExports = exports.filter((e) =>
    e.from.includes("plugins/builtin")
  );

  for (const exp of pluginExports) {
    if (!documentedSymbols.has(exp.symbol)) {
      diffs.push({
        kind: "added-not-documented",
        symbol: exp.symbol,
        details: `Plugin '${exp.symbol}' exported but not documented`,
      });
    }
  }

  return diffs;
}

async function getMcpPackageVersion(): Promise<string | null> {
  const packageJson = await readFile(`${MCP_SERVICE_DIR}/package.json`);
  if (!packageJson) {
    return null;
  }

  const parsed = JSON.parse(packageJson) as { version?: string };
  return parsed.version ?? null;
}

async function getRegisteredMcpTools(): Promise<string[]> {
  const serverText = await readFile(`${MCP_SERVICE_DIR}/src/server.ts`);
  if (!serverText) {
    return [];
  }

  return [...serverText.matchAll(/server\.registerTool\s*\(\s*"([^"]+)"/g)]
    .map((match) => match[1])
    .sort();
}

function extractMentionedMcpTools(content: string): Set<string> {
  return new Set(
    [...content.matchAll(/`(timeline_[a-z_]+)`/g)].map((match) => match[1])
  );
}

async function checkMcpMigration(): Promise<MigrationDiff[]> {
  const diffs: MigrationDiff[] = [];
  const packageVersion = await getMcpPackageVersion();
  const registeredTools = await getRegisteredMcpTools();
  const serverText = await readFile(`${MCP_SERVICE_DIR}/src/server.ts`);

  if (!packageVersion) {
    diffs.push({
      kind: "version-mismatch",
      symbol: "package.json",
      details: "Unable to resolve packages/mcp-service/package.json version",
    });
  }

  if (!serverText) {
    diffs.push({
      kind: "documented-but-removed",
      symbol: "src/server.ts",
      details: "MCP server entry file not found",
    });
  } else if (packageVersion) {
    const hardcodedVersion = serverText.match(/version:\s*"(\d+\.\d+\.\d+)"/)?.[1];
    if (hardcodedVersion && hardcodedVersion !== packageVersion) {
      diffs.push({
        kind: "version-mismatch",
        symbol: "src/server.ts",
        details: `Server metadata version ${hardcodedVersion} does not match package.json ${packageVersion}`,
      });
    }
  }

  for (const docFile of MCP_DOC_FILES) {
    const content = await readFile(docFile);
    if (!content) {
      diffs.push({
        kind: "documented-but-removed",
        symbol: docFile,
        details: "Expected MCP documentation file is missing",
      });
      continue;
    }

    if (packageVersion) {
      for (const match of content.matchAll(/timeline-canvas-mcp@(\d+\.\d+\.\d+)/g)) {
        const referencedVersion = match[1];
        if (referencedVersion !== packageVersion) {
          diffs.push({
            kind: "version-mismatch",
            symbol: docFile,
            details: `References timeline-canvas-mcp@${referencedVersion}, but package version is ${packageVersion}`,
          });
        }
      }
    }

    if (!MCP_README_FILES.includes(docFile)) {
      continue;
    }

    const mentionedTools = extractMentionedMcpTools(content);
    for (const toolName of registeredTools) {
      if (!mentionedTools.has(toolName)) {
        diffs.push({
          kind: "added-not-documented",
          symbol: toolName,
          details: `${docFile} does not mention registered tool '${toolName}'`,
        });
      }
    }

    const countMatch =
      content.match(/Tools\s*\((\d+)\s+total\)/i) ??
      content.match(/工具(?:（Tools）)?\s*[（(](\d+)\s*(?:total|个)?/i);
    if (countMatch) {
      const documentedCount = Number(countMatch[1]);
      if (documentedCount !== registeredTools.length) {
        diffs.push({
          kind: "count-mismatch",
          symbol: docFile,
          details: `Documents ${documentedCount} tools, but ${registeredTools.length} tools are registered in src/server.ts`,
        });
      }
    }
  }

  return diffs;
}

export async function migrationHelper(
  args: MigrationHelperInput
): Promise<string> {
  const { scope } = args;
  let diffs: MigrationDiff[];

  switch (scope) {
    case "api":
      diffs = await checkApiMigration();
      break;
    case "types":
      diffs = await checkTypesMigration();
      break;
    case "plugins":
      diffs = await checkPluginsMigration();
      break;
    case "mcp":
      diffs = await checkMcpMigration();
      break;
    default:
      return `Unknown scope: ${scope}`;
  }

  if (diffs.length === 0) {
    return `Migration check (${scope}): No issues found. Everything is in sync.`;
  }

  const lines: string[] = [
    `Migration check (${scope}): ${diffs.length} issue(s)`,
    "",
  ];

  const byKind = new Map<string, MigrationDiff[]>();
  for (const d of diffs) {
    const existing = byKind.get(d.kind) ?? [];
    existing.push(d);
    byKind.set(d.kind, existing);
  }

  for (const [kind, items] of byKind) {
    const label =
      kind === "added-not-documented"
        ? "New exports (not yet documented)"
        : kind === "documented-but-removed"
          ? "Documented but removed"
          : kind === "version-mismatch"
            ? "Version drift"
            : kind === "count-mismatch"
              ? "Count drift"
              : "Renamed";
    lines.push(`── ${label} ──`);
    for (const item of items) {
      lines.push(`  ${item.symbol}: ${item.details}`);
    }
    lines.push("");
  }

  lines.push("Suggestions:");
  const notDocumented = diffs.filter((d) => d.kind === "added-not-documented");
  if (notDocumented.length > 0) {
    lines.push(
      `  - Add documentation for: ${notDocumented.map((d) => d.symbol).join(", ")}`
    );
  }
  const removed = diffs.filter((d) => d.kind === "documented-but-removed");
  if (removed.length > 0) {
    lines.push(
      `  - Update/remove documentation for: ${removed.map((d) => d.symbol).join(", ")}`
    );
  }
  const versionMismatches = diffs.filter((d) => d.kind === "version-mismatch");
  if (versionMismatches.length > 0) {
    lines.push(
      `  - Sync version references for: ${versionMismatches.map((d) => d.symbol).join(", ")}`
    );
  }
  const countMismatches = diffs.filter((d) => d.kind === "count-mismatch");
  if (countMismatches.length > 0) {
    lines.push(
      `  - Update tool counts in: ${countMismatches.map((d) => d.symbol).join(", ")}`
    );
  }

  return lines.join("\n");
}
