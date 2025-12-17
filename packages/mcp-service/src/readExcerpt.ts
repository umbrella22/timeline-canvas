import * as fs from "node:fs/promises";

import { resolveInWorkspace, pathExists } from "./workspace.js";
import type { TextSnippetLine } from "./types.js";
import { clampInt } from "./utils.js";

export async function readLinesBounded(params: {
  file: string;
  startLine: number;
  endLine: number;
  maxLines: number;
}): Promise<{ ok: true; lines: TextSnippetLine[] } | { ok: false; error: string }> {
  const abs = resolveInWorkspace(params.file);
  if (!(await pathExists(abs))) return { ok: false, error: `Missing file: ${params.file}` };
  const start = Math.max(1, clampInt(params.startLine, 1, Number.MAX_SAFE_INTEGER));
  const end = Math.max(start, clampInt(params.endLine, 1, Number.MAX_SAFE_INTEGER));
  const maxLines = clampInt(params.maxLines, 1, 500);
  if (end - start + 1 > maxLines) {
    return {
      ok: false,
      error: `Requested range too large (${end - start + 1} lines). Max is ${maxLines}.`,
    };
  }
  const stat = await fs.stat(abs);
  if (stat.size > 1_500_000) {
    return { ok: false, error: `File too large to read safely (>1.5MB): ${params.file}` };
  }
  const text = await fs.readFile(abs, "utf8");
  if (text.includes("\u0000")) return { ok: false, error: `Binary file: ${params.file}` };
  const all = text.split(/\r?\n/);
  const slice = all.slice(start - 1, end);
  return {
    ok: true,
    lines: slice.map((t, i) => ({ line: start + i, text: t })),
  };
}
