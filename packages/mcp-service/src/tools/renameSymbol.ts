/**
 * timeline_rename_symbol — Cross-file semantic rename.
 *
 * Uses TypeScript LanguageService.findRenameLocations() for precise,
 * scope-aware symbol renaming across the project. Handles:
 *  - Definitions, references, re-exports, imports, type references
 *  - Dry-run mode to preview changes
 *  - String/comment references are warned but not auto-modified
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getTsService } from "../services/tsService.js";
import { workspaceRoot } from "../workspace.js";
import type { RenameSymbolInput } from "../types.js";

export async function renameSymbol(args: RenameSymbolInput): Promise<string> {
  const { symbol, newName, scope = "all", dryRun = false } = args;
  const ts = getTsService();

  // Validate newName is a valid identifier
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(newName)) {
    throw new Error(`Invalid identifier: '${newName}'`);
  }

  const lines: string[] = [
    `Rename '${symbol}' → '${newName}' (scope: ${scope}, ${dryRun ? "DRY RUN" : "APPLY"})`,
    "",
  ];

  // Use TS LanguageService for precise rename locations
  const locations = ts.findRenameLocations(symbol);

  if (locations.length === 0) {
    // Fallback: maybe it's not found via definitions. Try text-based search.
    const refs = ts.findReferences(symbol);
    if (refs.length === 0) {
      return `Symbol '${symbol}' not found in project source files.`;
    }

    lines.push(
      `⚠ LanguageService could not find rename targets. ` +
        `Found ${refs.length} text reference(s) via AST scan.`
    );
    lines.push(
      `  Consider verifying the symbol is properly exported and typed.`
    );
    lines.push("");

    // Show references anyway
    const byFile = new Map<string, typeof refs>();
    for (const ref of refs) {
      const existing = byFile.get(ref.file) ?? [];
      existing.push(ref);
      byFile.set(ref.file, existing);
    }

    for (const [file, fileRefs] of byFile) {
      lines.push(`  ${file}:`);
      for (const r of fileRefs) {
        const tag = r.isDefinition ? " [def]" : r.isTypeOnly ? " [type]" : "";
        lines.push(`    L${r.line}: ${r.text}${tag}`);
      }
    }
    return lines.join("\n");
  }

  // Apply scope filter
  const filteredLocations = scope === "all"
    ? locations
    : locations.filter((loc) => {
        // For scope filtering, check if the reference is type-only
        const refs = ts.findReferences(symbol);
        const matchingRef = refs.find(
          (r) => r.file === loc.file && r.line === loc.line
        );
        if (scope === "type-only") return matchingRef?.isTypeOnly ?? false;
        if (scope === "value-only") return !matchingRef?.isTypeOnly;
        return true;
      });

  // Group by file for batch replacement
  const byFile = new Map<
    string,
    Array<{ line: number; start: number; length: number; text: string }>
  >();
  for (const loc of filteredLocations) {
    const existing = byFile.get(loc.file) ?? [];
    existing.push({
      line: loc.line,
      start: loc.start,
      length: loc.length,
      text: loc.text,
    });
    byFile.set(loc.file, existing);
  }

  lines.push(
    `Found ${filteredLocations.length} location(s) in ${byFile.size} file(s):`
  );
  lines.push("");

  // Show what will be changed
  for (const [file, locs] of byFile) {
    lines.push(`── ${file} (${locs.length} change(s)) ──`);
    for (const loc of locs) {
      lines.push(`  L${loc.line}: ${loc.text}`);
    }
    lines.push("");
  }

  // Scan for string/comment references that won't be auto-renamed
  const allRefs = ts.findReferences(symbol);
  const stringCommentWarnings: string[] = [];
  // Check for occurrences in strings/comments by comparing count
  // If text search finds more than rename locations, some might be in strings
  if (allRefs.length > filteredLocations.length) {
    const locSet = new Set(
      filteredLocations.map((l) => `${l.file}:${l.line}`)
    );
    for (const ref of allRefs) {
      if (!locSet.has(`${ref.file}:${ref.line}`)) {
        stringCommentWarnings.push(`  ${ref.file}:${ref.line}: ${ref.text}`);
      }
    }
  }

  if (stringCommentWarnings.length > 0) {
    lines.push(
      `⚠ ${stringCommentWarnings.length} reference(s) in comments/strings/non-rename-safe positions:`
    );
    for (const w of stringCommentWarnings) {
      lines.push(w);
    }
    lines.push("  (These will NOT be auto-modified)");
    lines.push("");
  }

  // Apply changes (unless dry run)
  if (!dryRun) {
    const modifiedFiles: string[] = [];

    for (const [file, locs] of byFile) {
      const absPath = path.resolve(workspaceRoot, file);
      const content = await fs.readFile(absPath, "utf8");

      // Sort locations by offset descending so replacements don't shift positions
      const sorted = [...locs].sort((a, b) => b.start - a.start);

      let modified = content;
      for (const loc of sorted) {
        modified =
          modified.substring(0, loc.start) +
          newName +
          modified.substring(loc.start + loc.length);
      }

      await fs.writeFile(absPath, modified, "utf8");
      modifiedFiles.push(file);
    }

    lines.push(`✓ Applied ${filteredLocations.length} rename(s) in ${modifiedFiles.length} file(s).`);

    // Invalidate TS service cache after modifications
    ts.invalidate();
  } else {
    lines.push(`(Dry run — no files modified. Remove dryRun to apply.)`);
  }

  return lines.join("\n");
}
