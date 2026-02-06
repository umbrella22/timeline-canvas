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
