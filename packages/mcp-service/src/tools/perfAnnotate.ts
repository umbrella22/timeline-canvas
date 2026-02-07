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
 *  - Cross-module redundant calls in the same event-handling chain
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
  { rel: `${TIMELINE_SRC}/renderers/layers/EventsRenderer.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/renderers/layers/TracksRenderer.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/renderers/layers/TimelineRenderer.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/renderers/layers/IndicatorRenderer.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/renderers/layers/GuideLinesRenderer.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/renderers/layers/ScrollbarRenderer.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/renderers/layers/InteractionRenderer.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/renderers/core/RenderPipeline.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/core/managers/RenderManager.ts`, category: "render" },
  // Layer buffer management (OffscreenCanvas)
  { rel: `${TIMELINE_SRC}/core/managers/LayerBufferManager.ts`, category: "render" },
  // Worker (media)
  { rel: `${TIMELINE_SRC}/workers/media.worker.ts`, category: "render" },
  { rel: `${TIMELINE_SRC}/workers/MediaWorkerBridge.ts`, category: "render" },
  // Media cache
  { rel: `${TIMELINE_SRC}/utils/MediaLRUCache.ts`, category: "render" },
  // Highlight / index
  { rel: `${TIMELINE_SRC}/core/managers/EventIndexManager.ts`, category: "highlight" },
  { rel: `${TIMELINE_SRC}/core/managers/ChangeScheduler.ts`, category: "highlight" },
  // Interaction (state machine)
  { rel: `${TIMELINE_SRC}/handlers/MouseHandler.ts`, category: "interaction" },
  { rel: `${TIMELINE_SRC}/handlers/WheelHandler.ts`, category: "interaction" },
  { rel: `${TIMELINE_SRC}/handlers/states/IdleState.ts`, category: "interaction" },
  { rel: `${TIMELINE_SRC}/handlers/states/DraggingState.ts`, category: "interaction" },
  { rel: `${TIMELINE_SRC}/handlers/states/ResizingState.ts`, category: "interaction" },
  { rel: `${TIMELINE_SRC}/handlers/states/ScrollingState.ts`, category: "interaction" },
  { rel: `${TIMELINE_SRC}/handlers/states/TimeIndicatorDragState.ts`, category: "interaction" },
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
  {
    name: "offscreen-canvas-resize-without-clear",
    severity: "medium",
    pattern: /\.width\s*=|\.height\s*=/,
    description: "OffscreenCanvas resize detected — ensure content is redrawn after resize",
    suggestion: "Resize clears canvas content; mark buffer as dirty after resize",
    requiresLoopContext: false,
  },
  {
    name: "drawimage-in-loop",
    severity: "medium",
    pattern: /ctx\.drawImage\s*\(/,
    description: "drawImage in loop — may cause compositing overhead",
    suggestion: "Batch drawImage calls or use a single composite step",
    requiresLoopContext: true,
  },
  {
    name: "transferable-not-used",
    severity: "medium",
    pattern: /postMessage\s*\([^,)]+\)\s*;/,
    description: "postMessage without Transferable list — data will be cloned instead of transferred",
    suggestion: "Pass [buffer] as second argument for zero-copy transfer of ArrayBuffer/ImageBitmap",
    requiresLoopContext: false,
  },
  {
    name: "worker-sync-in-render",
    severity: "high",
    pattern: /await\s+.*worker.*\.postMessage|await\s+.*requestBitmap/,
    description: "Awaiting Worker response in render path — blocks frame",
    suggestion: "Use fire-and-forget pattern; render placeholder until Worker returns bitmap",
    requiresLoopContext: false,
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

// ─── Cross-module redundant call detection ───

/**
 * Known expensive methods that should not be called multiple times per frame.
 */
const EXPENSIVE_METHODS = [
  "getEventAtPosition",
  "getEventsInRange",
  "getEventAtPoint",
  "getCandidatesByTime",
  "getResizeHandle",
  "hitTest",
  "getInteractionTarget",
  "findEventAt",
  "getVisibleEvents",
  // OffscreenCanvas related
  "markDirtyFromLayers",
  "transferToImageBitmap",
  "createImageBitmap",
];

/**
 * Event handler method name patterns that represent entry points
 * for the same user event (e.g., mousemove).
 */
const EVENT_CHAIN_PATTERNS: Array<{ event: string; pattern: RegExp }> = [
  { event: "mousemove", pattern: /handle(?:Mouse)?Move|onMouseMove|mousemove/i },
  { event: "mousedown", pattern: /handle(?:Mouse)?Down|onMouseDown|mousedown/i },
  { event: "mouseup", pattern: /handle(?:Mouse)?Up|onMouseUp|mouseup/i },
  { event: "click", pattern: /handle(?:Click)|onClick|click/i },
  { event: "wheel", pattern: /handle(?:Wheel)|onWheel|wheel/i },
  { event: "pointermove", pattern: /handle(?:Pointer)?Move|onPointerMove|pointermove/i },
];

interface RedundantCallInfo {
  expensiveMethod: string;
  event: string;
  callSites: Array<{
    file: string;
    line: number;
    caller: string; // The handler method name
    text: string;
  }>;
}

/**
 * Scan files for cross-module redundant calls of expensive methods
 * within the same event-handling chain.
 */
async function detectRedundantCalls(
  targets: FileTarget[]
): Promise<RedundantCallInfo[]> {
  // Map: expensiveMethod → event → callSites
  const callMap = new Map<
    string,
    Map<string, Array<{ file: string; line: number; caller: string; text: string }>>
  >();

  for (const target of targets) {
    const content = await readFile(target.rel);
    if (!content) continue;

    const lines = content.split(/\r?\n/);

    // Track which handler method we're currently inside
    let currentHandler: { name: string; event: string; indent: number } | null = null;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect handler method definitions
      for (const ep of EVENT_CHAIN_PATTERNS) {
        // Match method declarations and addEventListener callbacks
        const methodMatch = line.match(
          /(?:(?:async\s+)?(?:private\s+|public\s+|protected\s+)?(\w+)\s*\(|addEventListener\s*\(\s*["'](\w+)["']\s*,)/
        );
        if (methodMatch) {
          const methodName = methodMatch[1] ?? methodMatch[2] ?? "";
          if (ep.pattern.test(methodName) || ep.pattern.test(line)) {
            // Count opening braces to track scope
            const leadingSpaces = line.search(/\S/);
            currentHandler = {
              name: methodName,
              event: ep.event,
              indent: leadingSpaces >= 0 ? leadingSpaces : 0,
            };
            braceDepth = 0;
            break;
          }
        }
      }

      // Track brace depth within handler
      if (currentHandler) {
        for (const ch of line) {
          if (ch === "{") braceDepth++;
          if (ch === "}") braceDepth--;
        }
        if (braceDepth <= 0 && i > 0 && line.includes("}")) {
          currentHandler = null;
          continue;
        }
      }

      // If inside a handler, check for expensive method calls
      if (currentHandler) {
        for (const expMethod of EXPENSIVE_METHODS) {
          const callPattern = new RegExp(`\\b${expMethod}\\s*\\(`);
          if (callPattern.test(line)) {
            if (!callMap.has(expMethod)) {
              callMap.set(expMethod, new Map());
            }
            const eventMap = callMap.get(expMethod)!;
            if (!eventMap.has(currentHandler.event)) {
              eventMap.set(currentHandler.event, []);
            }
            eventMap.get(currentHandler.event)!.push({
              file: target.rel,
              line: i + 1,
              caller: currentHandler.name,
              text: line.trim(),
            });
          }
        }
      }

      // Also detect direct addEventListener with expensive calls in callback
      for (const expMethod of EXPENSIVE_METHODS) {
        if (!currentHandler) {
          const listenerMatch = line.match(
            /addEventListener\s*\(\s*["'](\w+)["']/
          );
          if (listenerMatch) {
            const eventName = listenerMatch[1];
            const callPattern = new RegExp(`\\b${expMethod}\\s*\\(`);
            // Look ahead up to 30 lines for the expensive call within this listener
            for (let j = i; j < Math.min(i + 30, lines.length); j++) {
              if (callPattern.test(lines[j])) {
                if (!callMap.has(expMethod)) {
                  callMap.set(expMethod, new Map());
                }
                const eventMap = callMap.get(expMethod)!;
                if (!eventMap.has(eventName)) {
                  eventMap.set(eventName, []);
                }
                eventMap.get(eventName)!.push({
                  file: target.rel,
                  line: j + 1,
                  caller: `addEventListener('${eventName}', ...)`,
                  text: lines[j].trim(),
                });
                break; // Only count once per listener
              }
              // Stop if we hit a closing of the listener
              if (lines[j].includes("});") || lines[j].includes("})")) break;
            }
          }
        }
      }
    }
  }

  // Filter to find actual redundancies: same method called >1 time for same event
  const results: RedundantCallInfo[] = [];
  for (const [method, eventMap] of callMap) {
    for (const [event, sites] of eventMap) {
      if (sites.length > 1) {
        results.push({
          expensiveMethod: method,
          event,
          callSites: sites,
        });
      }
    }
  }

  // Sort by number of redundant calls (most redundant first)
  results.sort((a, b) => b.callSites.length - a.callSites.length);
  return results;
}

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

  // ─── Cross-module redundant call detection ───
  const redundantCalls = await detectRedundantCalls(
    target === "all"
      ? SCAN_TARGETS
      : // For redundant calls, always include interaction + plugin files
        [
          ...SCAN_TARGETS.filter((t) => t.category === target),
          ...SCAN_TARGETS.filter(
            (t) =>
              t.category === "interaction" && target !== "interaction"
          ),
        ]
  );

  if (allHotspots.length === 0 && redundantCalls.length === 0) {
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
    `Performance Analysis (${target}): ${allHotspots.length} hotspot(s), ${redundantCalls.length} redundant call pattern(s)`,
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

  // ─── Redundant call results ───
  if (redundantCalls.length > 0) {
    lines.push(`══ Cross-Module Redundant Calls ══`);
    lines.push("");

    for (const rc of redundantCalls) {
      lines.push(
        `  ⚠ ${rc.expensiveMethod} called ${rc.callSites.length} time(s) in '${rc.event}' chain:`
      );
      for (const site of rc.callSites) {
        lines.push(
          `    - ${site.file} L${site.line} (${site.caller})`
        );
        lines.push(`      ${site.text}`);
      }
      lines.push(
        `    → Suggestion: Merge into a single query; share result via state/event/context`
      );
      lines.push("");
    }
  }

  return lines.join("\n");
}
