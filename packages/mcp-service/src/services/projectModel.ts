/**
 * Project model: provides structural information about the timeline project.
 * Used by consistency checks, migration helper, and other tools.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { workspaceRoot, pathExists, toPosixPath, IGNORED_DIRS } from "../workspace.js";

const TIMELINE_SRC = "packages/timeline/src";

function resolve(rel: string): string {
  return path.resolve(workspaceRoot, rel);
}

/**
 * List all .ts files under a directory (recursive).
 */
export async function listTsFiles(dir: string): Promise<string[]> {
  const abs = resolve(dir);
  if (!(await pathExists(abs))) return [];
  const out: string[] = [];

  async function walk(current: string, relDir: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        const nextRel = relDir ? `${relDir}/${entry.name}` : entry.name;
        await walk(path.join(current, entry.name), nextRel);
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
        out.push(toPosixPath(rel));
      }
    }
  }

  await walk(abs, dir);
  return out;
}

/**
 * Get the list of builtin plugin file names (without extension).
 */
export async function getBuiltinPluginNames(): Promise<string[]> {
  const dirPath = resolve(`${TIMELINE_SRC}/plugins/builtin`);
  if (!(await pathExists(dirPath))) return [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".ts") && e.name !== "index.ts")
    .map((e) => e.name.replace(/\.ts$/, ""))
    .sort();
}

/**
 * Get the list of builtin-plugin re-export file names (without extension).
 */
export async function getReexportNames(): Promise<string[]> {
  const dirPath = resolve(`${TIMELINE_SRC}/builtin-plugin`);
  if (!(await pathExists(dirPath))) return [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".ts") && e.name !== "index.ts")
    .map((e) => e.name.replace(/\.ts$/, ""))
    .sort();
}

/**
 * Parse the exports from src/index.ts.
 */
export async function getIndexExports(): Promise<
  Array<{ symbol: string; from: string }>
> {
  const indexPath = resolve(`${TIMELINE_SRC}/index.ts`);
  if (!(await pathExists(indexPath))) return [];
  const text = await fs.readFile(indexPath, "utf8");
  const results: Array<{ symbol: string; from: string }> = [];

  const re = /export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+"([^"]+)"/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const symbols = match[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]);
    const from = match[2];
    for (const sym of symbols) {
      if (sym) results.push({ symbol: sym, from });
    }
  }
  return results;
}

/**
 * Read a file's content given a workspace-relative path.
 */
export async function readFile(rel: string): Promise<string | null> {
  const abs = resolve(rel);
  if (!(await pathExists(abs))) return null;
  return fs.readFile(abs, "utf8");
}

/**
 * Scan a file for TODO/FIXME/HACK markers.
 */
export async function scanTodoMarkers(
  rel: string
): Promise<Array<{ line: number; text: string }>> {
  const content = await readFile(rel);
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const results: Array<{ line: number; text: string }> = [];
  const pattern = /\b(TODO|FIXME|HACK|XXX)\b/;
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      results.push({ line: i + 1, text: lines[i].trim() });
    }
  }
  return results;
}
