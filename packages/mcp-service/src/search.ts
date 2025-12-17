import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";

import {
  DEFAULT_SEARCH_ROOTS,
  IGNORED_DIRS,
  listFilesRecursive,
  resolveInWorkspace,
  toPosixPath,
  workspaceRoot,
} from "./workspace.js";

import type { TextMatch } from "./types.js";
import { readLinesBounded } from "./readExcerpt.js";
import { clampInt } from "./utils.js";

function maybeRelativizeToWorkspace(absOrRel: string): string | null {
  const abs = path.isAbsolute(absOrRel)
    ? absOrRel
    : resolveInWorkspace(absOrRel);
  const rel = path.relative(workspaceRoot, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return toPosixPath(rel);
}

function buildRipgrepArgs(params: {
  query: string;
  mode: "literal" | "regex";
  caseSensitive: boolean;
  rootsAbs: string[];
  extensions: string[];
}): string[] {
  const args: string[] = [];
  args.push("--vimgrep");
  args.push("--color", "never");
  args.push("--no-heading");
  args.push("--max-filesize", "800K");

  for (const dir of IGNORED_DIRS) {
    args.push(`--glob=!**/${dir}/**`);
  }

  const exts = Array.from(
    new Set(params.extensions.map((e) => e.replace(/^\./, "").toLowerCase()))
  );
  for (const ext of exts) {
    args.push(`--glob=**/*.${ext}`);
  }

  if (!params.caseSensitive) args.push("-i");
  if (params.mode === "literal") args.push("-F");

  args.push(params.query);
  args.push(...params.rootsAbs);
  return args;
}

function parseRipgrepVimgrepLine(line: string): {
  absFile: string;
  line: number;
  col: number;
  lineText: string;
} | null {
  const m = /^(.*?):(\d+):(\d+):(.*)$/.exec(line);
  if (!m) return null;
  const absFile = m[1];
  const lineNo = Number(m[2]);
  const colNo = Number(m[3]);
  if (!Number.isFinite(lineNo) || !Number.isFinite(colNo)) return null;
  return { absFile, line: lineNo, col: colNo, lineText: m[4] ?? "" };
}

async function ripgrepSearchWorkspace(params: {
  query: string;
  mode: "literal" | "regex";
  caseSensitive: boolean;
  roots: string[];
  extensions: string[];
  maxResults: number;
  contextLines: number;
}): Promise<TextMatch[] | null> {
  const rootsAbs = params.roots
    .map((r) => {
      try {
        return resolveInWorkspace(r);
      } catch {
        return null;
      }
    })
    .filter((p): p is string => !!p);

  if (rootsAbs.length === 0) return [];

  const matches: Array<{
    absFile: string;
    line: number;
    col: number;
    lineText: string;
  }> = [];

  const args = buildRipgrepArgs({
    query: params.query,
    mode: params.mode,
    caseSensitive: params.caseSensitive,
    rootsAbs,
    extensions: params.extensions,
  });

  const child = spawn("rg", args, {
    cwd: workspaceRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdoutBuf = "";
  let stderr = "";
  let exited = false;

  const stopIfEnough = () => {
    if (matches.length >= params.maxResults && !exited) {
      child.kill("SIGTERM");
    }
  };

  child.stdout.on("data", (d) => {
    stdoutBuf += d.toString();
    const parts = stdoutBuf.split(/\r?\n/);
    stdoutBuf = parts.pop() ?? "";
    for (const line of parts) {
      const parsed = parseRipgrepVimgrepLine(line);
      if (!parsed) continue;
      matches.push(parsed);
      stopIfEnough();
      if (matches.length >= params.maxResults) break;
    }
  });

  child.stderr.on("data", (d) => {
    stderr += d.toString();
    if (stderr.length > 10_000) stderr = stderr.slice(0, 10_000);
  });

  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", (err) => reject(err));
    child.on("close", (c) => resolve(c));
  }).catch((err: any) => {
    if (err?.code === "ENOENT") return null;
    throw err;
  });

  exited = true;

  if (code === null) return null;
  if (code !== 0 && code !== 1 && code !== 2) return null;
  if (code === 2) return null;

  const out: TextMatch[] = [];
  for (const m of matches.slice(0, params.maxResults)) {
    const rel = maybeRelativizeToWorkspace(m.absFile);
    if (!rel) continue;

    const startLine = Math.max(1, m.line - params.contextLines);
    const endLine = m.line + params.contextLines;
    const excerpt = await readLinesBounded({
      file: rel,
      startLine,
      endLine,
      maxLines: Math.max(1, 2 * params.contextLines + 1),
    });

    out.push({
      file: rel,
      line: m.line,
      col: m.col,
      lineText: m.lineText,
      snippet: excerpt.ok
        ? excerpt.lines
        : [{ line: m.line, text: m.lineText }],
    });
  }

  return out;
}

async function jsSearchWorkspace(params: {
  query: string;
  mode: "literal" | "regex";
  caseSensitive: boolean;
  roots: string[];
  extensions: string[];
  maxResults: number;
  contextLines: number;
}): Promise<TextMatch[]> {
  const maxResults = clampInt(params.maxResults, 1, 200);
  const contextLines = clampInt(params.contextLines, 0, 10);
  const files = await listFilesRecursive({
    roots: params.roots,
    extensions: params.extensions,
    maxFiles: 20_000,
  });

  let re: RegExp | null = null;
  if (params.mode === "regex") {
    const flags = params.caseSensitive ? "g" : "gi";
    re = new RegExp(params.query, flags);
  }

  const needle = params.caseSensitive
    ? params.query
    : params.query.toLowerCase();
  const matches: TextMatch[] = [];

  for (const file of files) {
    if (matches.length >= maxResults) break;
    const abs = resolveInWorkspace(file);
    const stat = await fs.stat(abs);
    if (stat.size > 800_000) continue;
    const content = await fs.readFile(abs, "utf8");
    if (content.includes("\u0000")) continue;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (matches.length >= maxResults) break;
      const lineText = lines[i];
      let col = -1;
      if (params.mode === "literal") {
        const hay = params.caseSensitive ? lineText : lineText.toLowerCase();
        col = hay.indexOf(needle);
        if (col === -1) continue;
      } else {
        re!.lastIndex = 0;
        const m = re!.exec(lineText);
        if (!m) continue;
        col = m.index;
      }

      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length - 1, i + contextLines);
      const snippet: { line: number; text: string }[] = [];
      for (let j = start; j <= end; j++) {
        snippet.push({ line: j + 1, text: lines[j] });
      }

      matches.push({
        file,
        line: i + 1,
        col: col + 1,
        lineText,
        snippet,
      });
    }
  }

  return matches;
}

export async function searchWorkspace(params: {
  query: string;
  mode: "literal" | "regex";
  caseSensitive: boolean;
  roots: string[];
  extensions: string[];
  maxResults: number;
  contextLines: number;
}): Promise<TextMatch[]> {
  const maxResults = clampInt(params.maxResults, 1, 200);
  const contextLines = clampInt(params.contextLines, 0, 10);
  const roots = params.roots.length > 0 ? params.roots : DEFAULT_SEARCH_ROOTS;

  const rg = await ripgrepSearchWorkspace({
    ...params,
    roots,
    maxResults,
    contextLines,
  });

  if (rg) return rg;

  return jsSearchWorkspace({
    ...params,
    roots,
    maxResults,
    contextLines,
  });
}
