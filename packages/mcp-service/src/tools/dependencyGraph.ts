/**
 * timeline_dependency_graph — Symbol dependency graph query.
 *
 * Uses TypeScript Compiler API to analyze import relationships and
 * find who depends on a given symbol (dependents) or what a symbol
 * depends on (dependencies).
 */

import { getTsService } from "../services/tsService.js";
import type { DependencyGraphInput } from "../types.js";

export async function dependencyGraph(
  args: DependencyGraphInput
): Promise<string> {
  const { symbol, direction, depth = 1 } = args;
  const ts = getTsService();

  // Build results based on direction
  const lines: string[] = [`Dependency graph for '${symbol}' (${direction}, depth=${depth})`, ""];

  if (direction === "dependents" || direction === "both") {
    const refs = ts.findReferences(symbol);
    // Group references by file, excluding definition files
    const byFile = new Map<string, typeof refs>();
    for (const ref of refs) {
      if (ref.isDefinition) continue;
      const existing = byFile.get(ref.file) ?? [];
      existing.push(ref);
      byFile.set(ref.file, existing);
    }

    lines.push(`── Dependents (who uses '${symbol}') ──`);
    if (byFile.size === 0) {
      lines.push("  (none found)");
    } else {
      for (const [file, usages] of byFile) {
        const typeOnly = usages.every((u) => u.isTypeOnly);
        lines.push(`  ${file} [${typeOnly ? "type" : "value"}]`);
        for (const u of usages) {
          lines.push(`    L${u.line}: ${u.text}`);
        }
      }
    }
    lines.push("");

    // Recursive depth (if depth > 1, find symbols that the dependents export)
    if (depth > 1 && byFile.size > 0) {
      lines.push(`  (recursive depth > 1 — showing direct dependents only for clarity)`);
      lines.push("");
    }
  }

  if (direction === "dependencies" || direction === "both") {
    // Find which file defines the symbol
    const defs = ts.findDefinitions(symbol);
    if (defs.length === 0) {
      lines.push(`── Dependencies (what '${symbol}' uses) ──`);
      lines.push(`  Could not find definition of '${symbol}'`);
    } else {
      const importGraph = ts.getImportGraph();
      lines.push(`── Dependencies (what '${symbol}' uses) ──`);

      for (const def of defs) {
        const fileImports = importGraph.get(def.file);
        if (!fileImports || fileImports.length === 0) {
          lines.push(`  ${def.file}: (no imports)`);
        } else {
          lines.push(`  ${def.file}:`);
          for (const imp of fileImports) {
            const typeTag = imp.isTypeOnly ? " [type]" : "";
            lines.push(
              `    from "${imp.from}"${typeTag}: ${imp.symbols.join(", ") || "*"}`
            );
          }
        }
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
