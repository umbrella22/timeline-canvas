import * as fs from "node:fs/promises";
import * as path from "node:path";

const inferredCwd = process.cwd();
const cwdBase = path.basename(inferredCwd).toLowerCase();
let defaultRoot = inferredCwd;
if (cwdBase === "mcp" || cwdBase === "mcp-service") {
  const parent = path.dirname(inferredCwd);
  defaultRoot =
    path.basename(parent).toLowerCase() === "packages"
      ? path.join(inferredCwd, "..", "..")
      : path.join(inferredCwd, "..");
}

export const workspaceRoot = path.resolve(
  process.env.MCP_WORKSPACE_ROOT ?? defaultRoot
);

export const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-mcp",
  ".azure",
  ".rspress",
]);

export const DEFAULT_SEARCH_ROOTS = [
  "packages/timeline/src",
  "docs",
  "packages/mcp-service/src",
];
export const DEFAULT_REPO_MAP_ROOTS = ["packages/timeline/src", "docs"];

export function resolveInWorkspace(relativePath: string): string {
  const cleaned = relativePath.replace(/\\/g, "/");
  const resolved = path.resolve(workspaceRoot, cleaned);
  const rel = path.relative(workspaceRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes workspace: ${relativePath}`);
  }
  return resolved;
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function toPosixPath(p: string): string {
  return p.replace(/\\/g, "/");
}

export async function listFilesRecursive(params: {
  roots: string[];
  extensions: string[];
  maxFiles: number;
}): Promise<string[]> {
  const exts = new Set(
    params.extensions.map((e) => e.replace(/^\./, "").toLowerCase())
  );
  const maxFiles = Math.max(1, Math.min(50_000, params.maxFiles));
  const out: string[] = [];

  async function walkDir(absDir: string, relDir: string): Promise<void> {
    if (out.length >= maxFiles) return;
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      const name = entry.name;
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(name)) continue;
        await walkDir(
          path.join(absDir, name),
          relDir ? `${relDir}/${name}` : name
        );
      } else if (entry.isFile()) {
        const ext = name.split(".").pop()?.toLowerCase() ?? "";
        if (!exts.has(ext)) continue;
        const rel = relDir ? `${relDir}/${name}` : name;
        out.push(toPosixPath(rel));
      }
    }
  }

  for (const root of params.roots) {
    const abs = resolveInWorkspace(root);
    if (!(await pathExists(abs))) continue;
    await walkDir(abs, toPosixPath(root));
    if (out.length >= maxFiles) break;
  }

  return out;
}

export async function findFirstLine(params: {
  file: string;
  pattern: RegExp;
}): Promise<number | undefined> {
  const abs = resolveInWorkspace(params.file);
  if (!(await pathExists(abs))) return undefined;
  const stat = await fs.stat(abs);
  if (stat.size > 800_000) return undefined;
  const text = await fs.readFile(abs, "utf8");
  if (text.includes("\u0000")) return undefined;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (params.pattern.test(lines[i])) return i + 1;
  }
  return undefined;
}
