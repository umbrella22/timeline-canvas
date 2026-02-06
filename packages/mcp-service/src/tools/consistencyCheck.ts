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
  const typesFile = await readFile(`${TIMELINE_SRC}/types.ts`);
  const renderPipelineFiles = [
    `${TIMELINE_SRC}/core/renderers/RenderPipeline.ts`,
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

  const typesFile = await readFile(`${TIMELINE_SRC}/types.ts`);
  if (!typesFile) {
    return {
      name: "state-fields",
      passed: true,
      details: ["types.ts not found — skipped"],
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

  // Find ChangeType enum/union values
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

  // Extract values from the enum/type
  const body = enumMatch[1];
  const values: string[] = [];
  // Handle enum style: VALUE = "value",
  const enumRe = /(\w+)\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = enumRe.exec(body)) !== null) {
    values.push(match[1]);
  }

  // Check each ChangeType has a corresponding handler/case
  const handlerPatterns = [
    /case\s+ChangeType\.(\w+)/g,
    /ChangeType\.(\w+)/g,
  ];

  const usedTypes = new Set<string>();
  for (const pattern of handlerPatterns) {
    let m;
    while ((m = pattern.exec(schedulerFile)) !== null) {
      usedTypes.add(m[1]);
    }
  }

  for (const v of values) {
    if (!usedTypes.has(v)) {
      problems.push(`ChangeType.${v} defined but no handler case found`);
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
    `${TIMELINE_SRC}/core/renderers/EventRenderer.ts`,
    `${TIMELINE_SRC}/core/managers/EventIndexManager.ts`,
    `${TIMELINE_SRC}/core/managers/InteractionManager.ts`,
    `${TIMELINE_SRC}/core/managers/VisibilityManager.ts`,
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

// ─── Main entry ───

const CHECK_MAP: Record<ConsistencyCheckName, () => Promise<CheckResult>> = {
  "plugin-exports": checkPluginExports,
  "render-layers": checkRenderLayers,
  "state-fields": checkStateFields,
  "change-types": checkChangeTypes,
  "boundary-conditions": checkBoundaryConditions,
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
