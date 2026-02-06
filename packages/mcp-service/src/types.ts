// ─── Shared types for MCP tools ───

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function fail(err: unknown): ToolResult {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

// ─── Plugin scaffold types ───

export type PluginTypeKey =
  | "render"
  | "event_handler"
  | "data_source"
  | "theme"
  | "tool"
  | "extension";

export type PluginFeature =
  | "renderLayer"
  | "eventHandler"
  | "config"
  | "lifecycle"
  | "init";

export interface ScaffoldInput {
  exportName: string;
  pluginType: PluginTypeKey;
  features?: PluginFeature[];
  metadataName?: string;
  description?: string;
  version?: string;
  withReexport?: boolean;
  withIndexExport?: boolean;
  withTest?: boolean;
}

export interface ValidateInput {
  name?: string; // specific plugin name, or undefined = check all
}

// ─── Dependency graph types ───

export type DependencyDirection = "dependents" | "dependencies" | "both";

export interface DependencyGraphInput {
  symbol: string;
  direction: DependencyDirection;
  depth?: number;
}

export interface DependencyEntry {
  file: string;
  importType: "value" | "type";
  usages: Array<{ line: number; context: string }>;
}

// ─── Type query types ───

export interface TypeQueryInput {
  type: string;
  member?: string;
}

export interface TypeDefinitionInfo {
  file: string;
  line: number;
  fullText: string;
  members: string[];
}

export interface MemberUsage {
  file: string;
  line: number;
  context: string;
  kind: "read" | "write";
}

// ─── Consistency check types ───

export type ConsistencyCheckName =
  | "plugin-exports"
  | "render-layers"
  | "state-fields"
  | "change-types"
  | "boundary-conditions";

export interface ConsistencyCheckInput {
  checks?: ConsistencyCheckName[];
}

export interface CheckResult {
  name: string;
  passed: boolean;
  details: string[];
}

// ─── Performance annotate types ───

export type PerfTarget = "render" | "highlight" | "interaction" | "all";

export interface PerfAnnotateInput {
  target: PerfTarget;
}

export interface PerfHotspot {
  file: string;
  line: number;
  severity: "high" | "medium" | "low";
  description: string;
  suggestion: string;
}

// ─── Migration helper types ───

export type MigrationScope = "api" | "types" | "plugins";

export interface MigrationHelperInput {
  scope: MigrationScope;
}

export interface MigrationDiff {
  kind: "added-not-documented" | "documented-but-removed" | "renamed";
  symbol: string;
  details: string;
}
