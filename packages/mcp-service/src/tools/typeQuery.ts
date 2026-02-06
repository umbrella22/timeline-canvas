/**
 * timeline_type_query — Type information + member reference query.
 *
 * Uses TypeScript Compiler API to inspect interface/type/class/enum
 * definitions and find member access patterns across the codebase.
 */

import { getTsService } from "../services/tsService.js";
import type { TypeQueryInput } from "../types.js";

export async function typeQuery(args: TypeQueryInput): Promise<string> {
  const { type: typeName, member } = args;
  const ts = getTsService();

  const lines: string[] = [];

  // Get type definition
  const typeInfo = ts.getTypeInfo(typeName);
  if (!typeInfo) {
    return `Type '${typeName}' not found in project source files.`;
  }

  lines.push(`── ${typeInfo.kind} ${typeInfo.name} ──`);
  lines.push(`File: ${typeInfo.file}:${typeInfo.line}`);
  lines.push("");

  if (typeInfo.members.length > 0) {
    lines.push(`Members (${typeInfo.members.length}):`);
    for (const m of typeInfo.members) {
      const opt = m.optional ? "?" : "";
      lines.push(`  ${m.name}${opt}: ${m.typeText}`);
    }
    lines.push("");
  }

  // If a specific member is requested, find its usages
  if (member) {
    lines.push(`── Usages of '${member}' ──`);

    const usages = ts.findMemberUsages(member);
    if (usages.length === 0) {
      lines.push("  (no usages found)");
    } else {
      const reads = usages.filter((u) => u.kind === "read");
      const writes = usages.filter((u) => u.kind === "write");

      if (reads.length > 0) {
        lines.push(`  Reads (${reads.length}):`);
        for (const r of reads) {
          lines.push(`    ${r.file}:${r.line}: ${r.text}`);
        }
      }
      if (writes.length > 0) {
        lines.push(`  Writes (${writes.length}):`);
        for (const w of writes) {
          lines.push(`    ${w.file}:${w.line}: ${w.text}`);
        }
      }
    }
    lines.push("");
  }

  // Show full definition source
  lines.push("── Full Definition ──");
  lines.push(typeInfo.fullText);

  return lines.join("\n");
}
