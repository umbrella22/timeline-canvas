/**
 * timeline_consistency_check — Project consistency validation.
 *
 * Checks:
 *  1. plugin-exports: builtin plugins ↔ index.ts ↔ re-exports consistency
 *  2. render-layers: RenderPipeline layer declarations vs actual renderers
 *  3. state-fields: TimelineState fields all initialized in StateManager
 *  4. change-types: ChangeType enum ↔ handler coverage
 *  5. boundary-conditions: consistent >= vs > patterns in interval logic
 */

import {
  getBuiltinPluginNames,
  getReexportNames,
  getIndexExports,
  readFile,
} from "../services/projectModel.js";
import type { ConsistencyCheckInput, ConsistencyCheckName, CheckResult } from "../types.js";

const TIMELINE_SRC = "packages/timeline/src";

const ALL_CHECKS: ConsistencyCheckName[] = [
  "plugin-exports",
  "render-layers",
  "state-fields",
  "change-types",
  "boundary-conditions",
  "dirty-mapping",
  "buffer-compose",
];

// ─── Check: plugin-exports ───

async function checkPluginExports(): Promise<CheckResult> {
  const problems: string[] = [];
  const plugins = await getBuiltinPluginNames();
  const reexports = await getReexportNames();
  const indexExports = await getIndexExports();

  // Every plugin should have a re-export
  for (const p of plugins) {
    if (!reexports.includes(p)) {
      problems.push(`Plugin '${p}' has no re-export in builtin-plugin/`);
    }
  }

  // Every re-export should have a plugin
  for (const r of reexports) {
    if (!plugins.includes(r)) {
      problems.push(`Re-export '${r}' has no matching plugin in builtin/`);
    }
  }

  // Check index.ts exports builtin plugins
  const indexedSymbols = indexExports
    .filter((e) => e.from.includes("plugins/builtin"))
    .map((e) => e.symbol);

  for (const p of plugins) {
    if (!indexedSymbols.includes(p)) {
      problems.push(`Plugin '${p}' is not exported from index.ts`);
    }
  }

  return {
    name: "plugin-exports",
    passed: problems.length === 0,
    details: problems,
  };
}

// ─── Check: render-layers ───

async function checkRenderLayers(): Promise<CheckResult> {
  const problems: string[] = [];

  // Look for LayerType or renderOrder definitions
  const typesFile = await readFile(`${TIMELINE_SRC}/types/index.ts`);
  const renderPipelineFiles = [
    `${TIMELINE_SRC}/renderers/core/RenderPipeline.ts`,
    `${TIMELINE_SRC}/renderers/core/types.ts`,
    `${TIMELINE_SRC}/core/managers/RenderManager.ts`,
  ];

  // Extract LayerType enum values if present
  if (typesFile) {
    const layerTypeMatch = typesFile.match(
      /enum\s+LayerType\s*\{([^}]+)\}/
    );
    if (layerTypeMatch) {
      const enumBody = layerTypeMatch[1];
      const enumValues = enumBody
        .split(",")
        .map((s) => s.split("=")[0]?.trim())
        .filter(Boolean);

      // Check that each value is used somewhere
      for (const val of enumValues) {
        let found = false;
        for (const rpFile of renderPipelineFiles) {
          const content = await readFile(rpFile);
          if (content && content.includes(val)) {
            found = true;
            break;
          }
        }
        if (!found) {
          problems.push(
            `LayerType.${val} defined in types but not referenced in render pipeline`
          );
        }
      }
    }
  }

  return {
    name: "render-layers",
    passed: problems.length === 0,
    details:
      problems.length > 0
        ? problems
        : ["OK (or LayerType enum not found — skipped)"],
  };
}

// ─── Check: state-fields ───

async function checkStateFields(): Promise<CheckResult> {
  const problems: string[] = [];

  const typesFile = await readFile(`${TIMELINE_SRC}/types/index.ts`);
  if (!typesFile) {
    return {
      name: "state-fields",
      passed: true,
      details: ["types/index.ts not found — skipped"],
    };
  }

  // Extract TimelineState interface fields
  const stateMatch = typesFile.match(
    /interface\s+TimelineState\s*\{([\s\S]*?)^\}/m
  );
  if (!stateMatch) {
    return {
      name: "state-fields",
      passed: true,
      details: ["TimelineState interface not found — skipped"],
    };
  }

  const stateBody = stateMatch[1];
  const fieldNames: string[] = [];
  const fieldRe = /^\s*(\w+)\s*[?:]*/gm;
  let m;
  while ((m = fieldRe.exec(stateBody)) !== null) {
    const name = m[1];
    if (name && !name.startsWith("//")) {
      fieldNames.push(name);
    }
  }

  // Look for StateManager constructor
  const stateManagerFile = await readFile(
    `${TIMELINE_SRC}/core/managers/StateManager.ts`
  );
  if (stateManagerFile) {
    for (const field of fieldNames) {
      // Check if field is initialized (assignment pattern)
      if (!stateManagerFile.includes(field)) {
        problems.push(
          `TimelineState.${field} may not be initialized in StateManager`
        );
      }
    }
  }

  return {
    name: "state-fields",
    passed: problems.length === 0,
    details:
      problems.length > 0
        ? problems
        : [`All ${fieldNames.length} state fields accounted for`],
  };
}

// ─── Check: change-types ───

async function checkChangeTypes(): Promise<CheckResult> {
  const problems: string[] = [];

  const schedulerFile = await readFile(
    `${TIMELINE_SRC}/core/managers/ChangeScheduler.ts`
  );
  if (!schedulerFile) {
    return {
      name: "change-types",
      passed: true,
      details: ["ChangeScheduler.ts not found — skipped"],
    };
  }

  // Match string literal union type: type ChangeType = "xxx" | "yyy" | ...
  const unionMatch = schedulerFile.match(/type\s+ChangeType\s*=\s*([\s\S]*?);/);
  if (!unionMatch) {
    // Fallback: try enum style
    const enumMatch = schedulerFile.match(
      /(?:enum|type)\s+ChangeType\s*=?\s*\{?([\s\S]*?)(?:\}|;)/
    );
    if (!enumMatch) {
      return {
        name: "change-types",
        passed: true,
        details: ["ChangeType definition not found — skipped"],
      };
    }
  }

  // Extract string literal values from the union type
  const unionBody = unionMatch ? unionMatch[1] : "";
  const values: string[] = [];
  const literalRe = /["']([^"']+)["']/g;
  let match;
  while ((match = literalRe.exec(unionBody)) !== null) {
    values.push(match[1]);
  }

  if (values.length === 0) {
    // Fallback: try enum style VALUE = "value"
    const enumMatch = schedulerFile.match(
      /(?:enum|type)\s+ChangeType\s*=?\s*\{?([\s\S]*?)(?:\}|;)/
    );
    if (enumMatch) {
      const body = enumMatch[1];
      const enumRe = /(\w+)\s*=\s*["']([^"']+)["']/g;
      while ((match = enumRe.exec(body)) !== null) {
        values.push(match[2]);
      }
    }
  }

  // Check each ChangeType value has a corresponding handler .set("xxx", {...})
  for (const v of values) {
    const handlerPattern = new RegExp(
      `\.set\\s*\\(\\s*["']${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`
    );
    const casePattern = new RegExp(`["']${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`);
    if (!handlerPattern.test(schedulerFile) && !casePattern.test(schedulerFile)) {
      problems.push(`ChangeType "${v}" defined but no handler found`);
    }
  }

  return {
    name: "change-types",
    passed: problems.length === 0,
    details:
      problems.length > 0
        ? problems
        : [`All ${values.length} change types have handlers`],
  };
}

// ─── Check: boundary-conditions ───

async function checkBoundaryConditions(): Promise<CheckResult> {
  const problems: string[] = [];

  // Scan for event interval boundary patterns
  const filesToCheck = [
    `${TIMELINE_SRC}/renderers/layers/EventsRenderer.ts`,
    `${TIMELINE_SRC}/core/managers/EventIndexManager.ts`,
    `${TIMELINE_SRC}/core/managers/ChangeScheduler.ts`,
    `${TIMELINE_SRC}/handlers/states/IdleState.ts`,
    `${TIMELINE_SRC}/handlers/states/DraggingState.ts`,
  ];

  for (const rel of filesToCheck) {
    const content = await readFile(rel);
    if (!content) continue;

    const lines = content.split(/\r?\n/);
    const patterns: Array<{
      line: number;
      comparison: string;
      context: string;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      // Look for startTime/endTime comparisons with viewport/visible range
      if (
        /(?:startTime|endTime|start|end)\s*(?:>=|>|<=|<)\s*(?:visible|viewport|view|range)/i.test(
          ln
        ) ||
        /(?:visible|viewport|view|range)\s*(?:>=|>|<=|<)\s*(?:startTime|endTime|start|end)/i.test(
          ln
        )
      ) {
        const compMatch = ln.match(/(>=|>|<=|<)/);
        if (compMatch) {
          patterns.push({
            line: i + 1,
            comparison: compMatch[1],
            context: ln.trim(),
          });
        }
      }
    }

    // Check for inconsistencies: e.g., some files use >= while others use >
    // for the same logical condition
    if (patterns.length > 1) {
      const comparisons = new Set(patterns.map((p) => p.comparison));
      if (comparisons.size > 1) {
        problems.push(
          `Mixed boundary operators in ${rel}: ${[...comparisons].join(", ")}` +
            patterns.map((p) => `\n    L${p.line}: ${p.context}`).join("")
        );
      }
    }
  }

  return {
    name: "boundary-conditions",
    passed: problems.length === 0,
    details:
      problems.length > 0
        ? problems
        : ["No boundary inconsistencies detected"],
  };
}

// ─── Check: dirty-mapping ───

async function checkDirtyMapping(): Promise<CheckResult> {
  const problems: string[] = [];

  const schedulerFile = await readFile(`${TIMELINE_SRC}/core/managers/ChangeScheduler.ts`);
  const bufferMgrFile = await readFile(`${TIMELINE_SRC}/core/managers/LayerBufferManager.ts`);

  if (!schedulerFile || !bufferMgrFile) {
    return {
      name: "dirty-mapping",
      passed: true,
      details: ["Required files not found — skipped"],
    };
  }

  // 1. Extract LayerType values from ChangeScheduler handler layers arrays
  const layerTypeSet = new Set<string>();
  const layersRe = /layers:\s*\[([^\]]+)\]/g;
  let m;
  while ((m = layersRe.exec(schedulerFile)) !== null) {
    const content = m[1];
    const strRe = /["']([^"']+)["']/g;
    let sm;
    while ((sm = strRe.exec(content)) !== null) {
      layerTypeSet.add(sm[1]);
    }
  }

  // 2. Extract LAYER_TO_BUFFER mapping keys from LayerBufferManager
  const mappingRe = /(\w+)\s*:\s*["'](\w+)["']/g;
  const mappedLayerTypes = new Set<string>();
  while ((m = mappingRe.exec(bufferMgrFile)) !== null) {
    mappedLayerTypes.add(m[1]);
  }

  // 3. Find LayerTypes used in ChangeScheduler but not mapped in LAYER_TO_BUFFER
  for (const lt of layerTypeSet) {
    if (!mappedLayerTypes.has(lt)) {
      problems.push(
        `LayerType "${lt}" used in ChangeScheduler handlers but not mapped in LAYER_TO_BUFFER`
      );
    }
  }

  return {
    name: "dirty-mapping",
    passed: problems.length === 0,
    details: problems.length > 0
      ? problems
      : [`All ${layerTypeSet.size} layer types correctly mapped to buffers`],
  };
}

// ─── Check: buffer-compose ───

async function checkBufferCompose(): Promise<CheckResult> {
  const problems: string[] = [];

  const renderMgrFile = await readFile(`${TIMELINE_SRC}/core/managers/RenderManager.ts`);
  const bufferMgrFile = await readFile(`${TIMELINE_SRC}/core/managers/LayerBufferManager.ts`);

  if (!renderMgrFile || !bufferMgrFile) {
    return {
      name: "buffer-compose",
      passed: true,
      details: ["Required files not found — skipped"],
    };
  }

  // Check RenderManager.draw() compose step includes all BufferLayerIds
  const bufferIdRe = /['"](\w+)['"]\s*(?:as\s+const|as\s+BufferLayerId)/g;
  const composeIds = new Set<string>();
  let m;
  while ((m = bufferIdRe.exec(renderMgrFile)) !== null) {
    composeIds.add(m[1]);
  }

  // Extract all BufferLayerIds from LayerBufferManager
  const allBufferIds = new Set<string>();
  const initRe = /['"](\w+)['"]\s*(?:as\s+BufferLayerId|\))/g;
  while ((m = initRe.exec(bufferMgrFile)) !== null) {
    allBufferIds.add(m[1]);
  }

  for (const id of allBufferIds) {
    if (!composeIds.has(id)) {
      problems.push(`BufferLayerId "${id}" defined but not included in RenderManager compose step`);
    }
  }

  return {
    name: "buffer-compose",
    passed: problems.length === 0,
    details: problems.length > 0
      ? problems
      : [`All buffer layers included in compose step`],
  };
}

// ─── Main entry ───

const CHECK_MAP: Record<ConsistencyCheckName, () => Promise<CheckResult>> = {
  "plugin-exports": checkPluginExports,
  "render-layers": checkRenderLayers,
  "state-fields": checkStateFields,
  "change-types": checkChangeTypes,
  "boundary-conditions": checkBoundaryConditions,
  "dirty-mapping": checkDirtyMapping,
  "buffer-compose": checkBufferCompose,
};

export async function consistencyCheck(
  args: ConsistencyCheckInput
): Promise<string> {
  const checks = args.checks ?? ALL_CHECKS;
  const results: CheckResult[] = [];

  for (const checkName of checks) {
    const fn = CHECK_MAP[checkName];
    if (!fn) {
      results.push({
        name: checkName,
        passed: false,
        details: [`Unknown check: ${checkName}`],
      });
      continue;
    }
    try {
      results.push(await fn());
    } catch (err) {
      results.push({
        name: checkName,
        passed: false,
        details: [
          `Error running check: ${err instanceof Error ? err.message : String(err)}`,
        ],
      });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const lines: string[] = [
    `Consistency Check: ${passed} passed, ${failed} failed (${results.length} total)`,
    "",
  ];

  for (const r of results) {
    const icon = r.passed ? "✓" : "✗";
    lines.push(`${icon} ${r.name}`);
    for (const d of r.details) {
      lines.push(`    ${d}`);
    }
  }

  return lines.join("\n");
}
