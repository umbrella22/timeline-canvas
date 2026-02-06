/**
 * timeline_perf_annotate — Static performance analysis.
 *
 * Scans rendering hot paths for:
 *  - O(N) operations inside loops (.some, .find, .filter, .indexOf)
 *  - Object/array allocations in loops (GC pressure)
 *  - String concatenation in hot paths
 *  - Missing visibility culling
 *  - Per-frame object creation
 *  - Cacheable but uncached computations
 */

import { readFile } from "../services/projectModel.js";
import type { PerfAnnotateInput, PerfTarget, PerfHotspot } from "../types.js";

const TIMELINE_SRC = "packages/timeline/src";

interface FileTarget {
  rel: string;
  category: PerfTarget;
}

const SCAN_TARGETS: FileTarget[] = [
  // Render paths
  { rel: `${TIMELINE_SRC}/core/renderers/EventRenderer.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/core/renderers/TrackRenderer.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/core/renderers/TimeIndicatorRenderer.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/core/renderers/RenderPipeline.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/core/managers/RenderManager.ts`, category: "render" },
  // Highlight / interaction
  { rel: `${TIMELINE_SRC}/core/managers/HighlightManager.ts`, category: "highlight" },
  { rel: `${TIMELINE_SRC}/core/managers/EventIndexManager.ts`, category: "highlight" },
  // Interaction
  { rel: `${TIMELINE_SRC}/core/managers/InteractionManager.ts`, category: "interaction" },
  { rel: `${TIMELINE_SRC}/core/managers/DragDropManager.ts`, category: "interaction" },
  { rel: `${TIMELINE_SRC}/core/managers/SelectionManager.ts`, category: "interaction" },
];

interface PatternRule {
  name: string;
  severity: "high" | "medium" | "low";
  // Regex to detect the pattern within a line
  pattern: RegExp;
  description: string;
  suggestion: string;
  // Only flag if inside a loop context
  requiresLoopContext?: boolean;
}

const RULES: PatternRule[] = [
  {
    name: "linear-search-in-loop",
    severity: "high",
    pattern: /\.(some|find|findIndex|filter|indexOf|includes)\s*\(/,
    description: "O(N) array method potentially called in loop — may be O(N²)",
    suggestion: "Consider using a Set/Map for O(1) lookup, or pre-sort + binary search",
    requiresLoopContext: true,
  },
  {
    name: "array-alloc-in-loop",
    severity: "medium",
    pattern: /(?:new\s+Array|(?<!\w)\[\s*\]|\.\s*(?:map|filter|slice|concat)\s*\()/,
    description: "Array allocation in loop — may cause GC pressure",
    suggestion: "Pre-allocate arrays outside the loop, or reuse buffers",
    requiresLoopContext: true,
  },
  {
    name: "object-alloc-in-loop",
    severity: "medium",
    pattern: /(?:new\s+(?:Object|Map|Set|WeakMap)|(?<!\w)\{\s*\w+\s*:)/,
    description: "Object allocation in loop — may cause GC pressure",
    suggestion: "Reuse objects via an object pool or pre-allocate outside the loop",
    requiresLoopContext: true,
  },
  {
    name: "string-concat-in-loop",
    severity: "low",
    pattern: /(?:\+\s*["'`]|["'`]\s*\+|`\$\{)/,
    description: "String creation in loop — minor GC pressure",
    suggestion: "Use array.join() or pre-compute strings outside the loop",
    requiresLoopContext: true,
  },
  {
    name: "missing-visibility-check",
    severity: "high",
    pattern: /for\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+(?:events|this\.events|state\.events)/,
    description: "Iterating all events without visibility check",
    suggestion: "Filter to visible events first using EventIndexManager or viewport bounds",
  },
  {
    name: "per-frame-date-creation",
    severity: "medium",
    pattern: /new\s+Date\s*\(/,
    description: "Date object creation in potential render/update path",
    suggestion: "Cache Date objects or use numeric timestamps",
  },
  {
    name: "canvas-save-restore-imbalance",
    severity: "low",
    pattern: /ctx\.save\s*\(\s*\)/,
    description: "Canvas save() detected — ensure matching restore()",
    suggestion: "Verify save/restore pairs are balanced; unbalanced pairs leak state",
  },
];

function isInsideLoop(lines: string[], lineIndex: number): boolean {
  // Simple heuristic: look backwards for loop constructs within ~20 lines
  const lookback = Math.max(0, lineIndex - 20);
  for (let i = lineIndex; i >= lookback; i--) {
    const ln = lines[i];
    if (/\b(for|while|do)\s*[\(\{]/.test(ln)) return true;
    if (/\.(forEach|map|filter|reduce|some|every)\s*\(/.test(ln)) return true;
  }
  return false;
}

async function scanFile(
  file: FileTarget
): Promise<PerfHotspot[]> {
  const content = await readFile(file.rel);
  if (!content) return [];

  const lines = content.split(/\r?\n/);
  const hotspots: PerfHotspot[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

    for (const rule of RULES) {
      if (!rule.pattern.test(line)) continue;

      if (rule.requiresLoopContext && !isInsideLoop(lines, i)) continue;

      hotspots.push({
        file: file.rel,
        line: i + 1,
        severity: rule.severity,
        description: rule.description,
        suggestion: rule.suggestion,
      });
    }
  }

  return hotspots;
}

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export async function perfAnnotate(args: PerfAnnotateInput): Promise<string> {
  const { target } = args;
  const targets =
    target === "all"
      ? SCAN_TARGETS
      : SCAN_TARGETS.filter((t) => t.category === target);

  if (targets.length === 0) {
    return `No scan targets for category '${target}'.`;
  }

  const allHotspots: PerfHotspot[] = [];
  for (const t of targets) {
    const hotspots = await scanFile(t);
    allHotspots.push(...hotspots);
  }

  // Sort by severity
  allHotspots.sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );

  if (allHotspots.length === 0) {
    return `No performance hotspots found for target '${target}'.`;
  }

  const byFile = new Map<string, PerfHotspot[]>();
  for (const h of allHotspots) {
    const existing = byFile.get(h.file) ?? [];
    existing.push(h);
    byFile.set(h.file, existing);
  }

  const high = allHotspots.filter((h) => h.severity === "high").length;
  const medium = allHotspots.filter((h) => h.severity === "medium").length;
  const low = allHotspots.filter((h) => h.severity === "low").length;

  const lines: string[] = [
    `Performance Analysis (${target}): ${allHotspots.length} hotspot(s)`,
    `  HIGH: ${high}, MEDIUM: ${medium}, LOW: ${low}`,
    "",
  ];

  for (const [file, hotspots] of byFile) {
    lines.push(`── ${file} ──`);
    for (const h of hotspots) {
      lines.push(
        `  [${h.severity.toUpperCase()}] L${h.line}: ${h.description}`
      );
      lines.push(`    → ${h.suggestion}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
