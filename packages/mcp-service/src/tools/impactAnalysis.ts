/**
 * timeline_impact_analysis — Symbol-level impact analysis.
 *
 * Analyzes the blast radius of changing a function/method:
 *  - Lists all call sites with exact arguments
 *  - Traces argument origins (variable definitions, parameters)
 *  - Compares actual argument types against expected parameter types
 *  - Flags potential mismatches for interface-contract changes
 */

import { getTsService } from "../services/tsService.js";
import type { ImpactAnalysisInput } from "../types.js";

export async function impactAnalysis(
  args: ImpactAnalysisInput
): Promise<string> {
  const { symbol, changeType } = args;
  const ts = getTsService();

  const lines: string[] = [
    `Impact Analysis for '${symbol}' (change: ${changeType})`,
    "",
  ];

  // 1. Get function signature(s)
  const signatures = ts.getFunctionSignature(symbol);
  if (signatures.length === 0) {
    // Maybe it's a method — try to find definition at least
    const defs = ts.findDefinitions(symbol);
    if (defs.length === 0) {
      return `Symbol '${symbol}' not found in project source files.`;
    }
    lines.push(
      `⚠ Could not extract function signature for '${symbol}'. ` +
        `Showing reference analysis only.`
    );
    lines.push("");

    // Still show all references grouped by file
    const refs = ts.findReferences(symbol);
    const byFile = new Map<string, typeof refs>();
    for (const ref of refs) {
      if (ref.isDefinition) continue;
      const existing = byFile.get(ref.file) ?? [];
      existing.push(ref);
      byFile.set(ref.file, existing);
    }

    lines.push(`── References (${refs.length} total) ──`);
    for (const [file, fileRefs] of byFile) {
      lines.push(`  ${file}:`);
      for (const r of fileRefs) {
        lines.push(`    L${r.line}: ${r.text}`);
      }
    }
    return lines.join("\n");
  }

  // Show signature(s)
  lines.push(`── Signature(s) ──`);
  for (const sig of signatures) {
    const paramStr = sig.params
      .map(
        (p) =>
          `${p.name}${p.optional ? "?" : ""}: ${p.type}`
      )
      .join(", ");
    lines.push(`  ${sig.file}:${sig.line}`);
    lines.push(`  ${symbol}(${paramStr}): ${sig.returnType}`);
    lines.push("");
  }

  // 2. Find all call sites
  const callSites = ts.findCallSites(symbol);

  if (callSites.length === 0) {
    lines.push("── Call Sites ──");
    lines.push("  (no call sites found)");
    return lines.join("\n");
  }

  // Group call sites by file
  const byFile = new Map<string, typeof callSites>();
  for (const site of callSites) {
    const existing = byFile.get(site.file) ?? [];
    existing.push(site);
    byFile.set(site.file, existing);
  }

  lines.push(
    `── Call Sites (${callSites.length} in ${byFile.size} file(s)) ──`
  );
  lines.push("");

  const expectedParams = signatures[0]?.params ?? [];
  const warnings: string[] = [];

  for (const [file, sites] of byFile) {
    lines.push(`  ${file}:`);

    for (const site of sites) {
      lines.push(`    L${site.line}: ${site.text}`);

      // Show arguments with comparison to parameters
      if (site.args.length > 0) {
        for (const arg of site.args) {
          const expectedParam = expectedParams[arg.index];
          const paramLabel = expectedParam
            ? `${expectedParam.name}: ${expectedParam.type}`
            : `(extra arg)`;
          lines.push(
            `      arg[${arg.index}]: ${arg.expression}  ← expects ${paramLabel}`
          );

          // Check for potential mismatches
          if (changeType === "parameter-semantics" && expectedParam) {
            // Flag if arg name suggests different semantics than param name
            const argLower = arg.expression.toLowerCase();
            const paramLower = expectedParam.name.toLowerCase();
            if (
              argLower.includes("logical") !== paramLower.includes("logical") ||
              argLower.includes("canvas") !== paramLower.includes("canvas") ||
              argLower.includes("screen") !== paramLower.includes("screen") ||
              argLower.includes("scroll") !== paramLower.includes("scroll")
            ) {
              warnings.push(
                `⚠ ${file}:${site.line} arg[${arg.index}] '${arg.expression}' may have different coordinate semantics than param '${expectedParam.name}'`
              );
            }
          }

          if (changeType === "signature-shape") {
            if (site.args.length !== expectedParams.length) {
              const diff = site.args.length - expectedParams.length;
              warnings.push(
                `⚠ ${file}:${site.line} passes ${site.args.length} args but signature expects ${expectedParams.length} (${diff > 0 ? "+" : ""}${diff})`
              );
            }
          }
        }

        // Check for missing required args
        if (changeType === "signature-shape" || changeType === "parameter-type") {
          const requiredCount = expectedParams.filter((p) => !p.optional).length;
          if (site.args.length < requiredCount) {
            warnings.push(
              `⚠ ${file}:${site.line} passes ${site.args.length} args but ${requiredCount} required`
            );
          }
        }
      }
      lines.push("");
    }
  }

  // 3. Show type references (for return-type changes)
  if (changeType === "return-type" || changeType === "removal") {
    lines.push(`── Downstream Usages ──`);
    const refs = ts.findReferences(symbol);
    const nonDefNonCall = refs.filter((r) => {
      if (r.isDefinition) return false;
      // Check if it's NOT a call-site (approximate by checking if line text has (
      // after the symbol)
      return !r.text.includes(`${symbol}(`);
    });

    if (nonDefNonCall.length > 0) {
      lines.push(
        `  ${nonDefNonCall.length} non-call reference(s) that may depend on return type:`
      );
      for (const ref of nonDefNonCall) {
        lines.push(`    ${ref.file}:${ref.line}: ${ref.text}`);
      }
    } else {
      lines.push("  (no non-call references found)");
    }
    lines.push("");
  }

  // 4. Summary & warnings
  if (warnings.length > 0) {
    lines.push(`── Warnings (${warnings.length}) ──`);
    for (const w of warnings) {
      lines.push(`  ${w}`);
    }
    lines.push("");
  }

  lines.push(`── Summary ──`);
  lines.push(`  Symbol: ${symbol}`);
  lines.push(`  Change type: ${changeType}`);
  lines.push(`  Call sites: ${callSites.length}`);
  lines.push(`  Files affected: ${byFile.size}`);
  lines.push(`  Warnings: ${warnings.length}`);

  return lines.join("\n");
}
