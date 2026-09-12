import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

export const TESTED_TIMELINE_VERSION = "1.6.0";
export const TESTED_TIMELINE_VERSIONS = ["1.4.1", "1.5.0", TESTED_TIMELINE_VERSION];

export const compilerDefaults: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  allowJs: true,
  checkJs: true,
};

export interface ProjectInfo {
  root: string;
  installedVersion: string | null;
  testedVersion: string;
  compatibility: "tested-version" | "unverified-version" | "not-installed";
}

export function isWithinRoot(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function resolvePluginFile(root: string, filePath: string): Promise<string> {
  const canonicalRoot = await realpath(root);
  const candidate = path.resolve(root, filePath);
  if (!path.isAbsolute(filePath) && !isWithinRoot(path.resolve(root), candidate)) {
    throw new Error("Plugin file must be inside MCP_WORKSPACE_ROOT.");
  }
  const file = await realpath(candidate);
  if (!isWithinRoot(canonicalRoot, file)) {
    throw new Error("Plugin symlink resolves outside MCP_WORKSPACE_ROOT.");
  }
  if (!(await stat(file)).isFile() || !/\.(?:[cm]?[jt]s|[jt]sx)$/.test(file)) {
    throw new Error("Plugin file must be a JavaScript or TypeScript source file.");
  }
  return file;
}

export function inspectProject(
  root: string,
  fromFile?: string,
): {
  info: ProjectInfo;
  declarationFile: string | null;
} {
  // Resolve declarations without importing or executing the consumer's package.
  const resolved = ts.resolveModuleName(
    "timeline-canvas",
    fromFile ?? path.join(root, "__timeline_user_mcp__.mts"),
    compilerDefaults,
    ts.sys,
    undefined,
    undefined,
    ts.ModuleKind.ESNext,
  ).resolvedModule;
  const installedVersion = resolved?.packageId?.version ?? null;
  return {
    info: {
      root,
      installedVersion,
      testedVersion: TESTED_TIMELINE_VERSION,
      compatibility: !resolved
        ? "not-installed"
        : TESTED_TIMELINE_VERSIONS.includes(installedVersion ?? "")
          ? "tested-version"
          : "unverified-version",
    },
    declarationFile: resolved?.resolvedFileName ?? null,
  };
}
