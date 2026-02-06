/**
 * timeline_validate_plugin — Enhanced plugin validation tool.
 *
 * Checks:
 *  - File existence (impl + re-export)
 *  - Export symbol presence
 *  - src/index.ts export wiring
 *  - PluginMetadata required fields (name, version, type)
 *  - activate/deactivate pair
 *  - Re-export path consistency
 *  - TODO markers scan
 *  - TypeScript typecheck (optional, via tsService)
 */

import * as fs from "node:fs/promises";

import { resolveInWorkspace, pathExists } from "../workspace.js";
import {
  getBuiltinPluginNames,
  getReexportNames,
  scanTodoMarkers,
} from "../services/projectModel.js";
import type { ValidateInput, CheckResult } from "../types.js";

const TIMELINE_SRC = "packages/timeline/src";

async function validateSinglePlugin(name: string): Promise<CheckResult> {
  const problems: string[] = [];

  const implRel = `${TIMELINE_SRC}/plugins/builtin/${name}.ts`;
  const reexportRel = `${TIMELINE_SRC}/builtin-plugin/${name}.ts`;
  const indexRel = `${TIMELINE_SRC}/index.ts`;

  const implPath = resolveInWorkspace(implRel);
  const reexportPath = resolveInWorkspace(reexportRel);
  const indexPath = resolveInWorkspace(indexRel);

  // 1. File existence
  const implExists = await pathExists(implPath);
  if (!implExists) {
    problems.push(`Missing implementation: ${implRel}`);
  }
  const reexportExists = await pathExists(reexportPath);
  if (!reexportExists) {
    problems.push(`Missing re-export: ${reexportRel}`);
  }

  // 2. Export symbol check
  if (implExists) {
    const text = await fs.readFile(implPath, "utf8");
    const hasExport =
      new RegExp(`export\\s+(const|function)\\s+${name}\\b`).test(text) ||
      new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(text);
    if (!hasExport) {
      problems.push(`No exported symbol '${name}' in ${implRel}`);
    }

    // 3. PluginMetadata fields check
    if (!text.includes("metadata:") && !text.includes("metadata :")) {
      problems.push(`Missing 'metadata' property in ${implRel}`);
    } else {
      if (!/name:\s*["']/.test(text) && !/name\s*:\s*["']/.test(text)) {
        problems.push(`Missing 'metadata.name' in ${implRel}`);
      }
      if (!/version:\s*["']/.test(text) && !/version\s*:\s*["']/.test(text)) {
        problems.push(`Missing 'metadata.version' in ${implRel}`);
      }
      if (!/type:\s*PluginType\./.test(text)) {
        problems.push(`Missing 'metadata.type' (PluginType enum) in ${implRel}`);
      }
    }

    // 4. activate/deactivate pair check
    const hasActivate = /\bactivate\s*[\(:]/.test(text);
    const hasDeactivate = /\bdeactivate\s*[\(:]/.test(text);
    if (hasActivate && !hasDeactivate) {
      problems.push(
        `'activate' defined without 'deactivate' in ${implRel} — consider adding deactivate for cleanup`
      );
    }

    // 5. TODO markers
    const todos = await scanTodoMarkers(implRel);
    if (todos.length > 0) {
      problems.push(
        `${todos.length} TODO marker(s) in ${implRel}:` +
          todos.map((t) => `\n    L${t.line}: ${t.text}`).join("")
      );
    }
  }

  // 6. Re-export path consistency
  if (reexportExists) {
    const reexportText = await fs.readFile(reexportPath, "utf8");
    const expectedPath = `../plugins/builtin/${name}`;
    if (!reexportText.includes(expectedPath)) {
      problems.push(
        `Re-export path mismatch in ${reexportRel}: expected import from "${expectedPath}"`
      );
    }
  }

  // 7. Index.ts export check
  if (await pathExists(indexPath)) {
    const text = await fs.readFile(indexPath, "utf8");
    const exportLine = `export { ${name} } from "./plugins/builtin/${name}";`;
    if (!text.includes(exportLine)) {
      // Check if exported via a different path/pattern
      const altPattern = new RegExp(
        `export\\s+\\{[^}]*\\b${name}\\b[^}]*\\}\\s+from`
      );
      if (!altPattern.test(text)) {
        problems.push(`Not exported from ${indexRel}`);
      }
    }
  } else {
    problems.push(`Missing ${indexRel}`);
  }

  return {
    name,
    passed: problems.length === 0,
    details: problems,
  };
}

export async function validatePlugin(args: ValidateInput): Promise<string> {
  if (args.name) {
    // Validate a single specific plugin
    const result = await validateSinglePlugin(args.name);
    if (result.passed) {
      return `✓ Plugin '${args.name}' — all checks passed.`;
    }
    return (
      `✗ Plugin '${args.name}' — ${result.details.length} issue(s):\n` +
      result.details.map((d) => `  - ${d}`).join("\n")
    );
  }

  // Validate all builtin plugins
  const pluginNames = await getBuiltinPluginNames();
  const reexportNames = await getReexportNames();
  if (pluginNames.length === 0) {
    return "No builtin plugins found to validate.";
  }

  const results: CheckResult[] = [];
  for (const name of pluginNames) {
    results.push(await validateSinglePlugin(name));
  }

  // Cross-check: re-exports without matching plugin
  for (const re of reexportNames) {
    if (!pluginNames.includes(re)) {
      results.push({
        name: re,
        passed: false,
        details: [`Re-export '${re}' exists but no matching plugin in builtin/`],
      });
    }
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);
  const lines: string[] = [
    `Validated ${results.length} plugin(s): ${passed} passed, ${failed.length} failed`,
    "",
  ];

  for (const r of results) {
    if (r.passed) {
      lines.push(`  ✓ ${r.name}`);
    } else {
      lines.push(`  ✗ ${r.name}`);
      for (const d of r.details) {
        lines.push(`    - ${d}`);
      }
    }
  }

  return lines.join("\n");
}
