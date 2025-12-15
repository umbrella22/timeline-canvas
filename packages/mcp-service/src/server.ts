import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";

const inferredCwd = process.cwd();
const cwdBase = path.basename(inferredCwd).toLowerCase();
let defaultRoot = inferredCwd;
if (cwdBase === "mcp" || cwdBase === "mcp-service") {
  const parent = path.dirname(inferredCwd);
  defaultRoot =
    path.basename(parent).toLowerCase() === "packages"
      ? path.join(inferredCwd, "..", "..")
      : path.join(inferredCwd, "..");
}

const workspaceRoot = path.resolve(process.env.MCP_WORKSPACE_ROOT ?? defaultRoot);

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-mcp",
  ".azure",
  ".rspress",
]);

type TextMatch = {
  file: string;
  line: number;
  col: number;
  lineText: string;
  snippet: { line: number; text: string }[];
};

type TraceHit = { file: string; label: string; line?: number; note?: string };

function resolveInWorkspace(relativePath: string): string {
  const cleaned = relativePath.replace(/\\/g, "/");
  const resolved = path.resolve(workspaceRoot, cleaned);
  const rel = path.relative(workspaceRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes workspace: ${relativePath}`);
  }
  return resolved;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toPosixPath(p: string): string {
  return p.replace(/\\/g, "/");
}

async function listFilesRecursive(params: {
  roots: string[];
  extensions: string[];
  maxFiles: number;
}): Promise<string[]> {
  const exts = new Set(params.extensions.map((e) => e.replace(/^\./, "").toLowerCase()));
  const maxFiles = Math.max(1, Math.min(50_000, params.maxFiles));
  const out: string[] = [];

  async function walkDir(absDir: string, relDir: string): Promise<void> {
    if (out.length >= maxFiles) return;
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (out.length >= maxFiles) return;
      const name = entry.name;
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(name)) continue;
        await walkDir(path.join(absDir, name), relDir ? `${relDir}/${name}` : name);
      } else if (entry.isFile()) {
        const ext = name.split(".").pop()?.toLowerCase() ?? "";
        if (!exts.has(ext)) continue;
        const rel = relDir ? `${relDir}/${name}` : name;
        out.push(toPosixPath(rel));
      }
    }
  }

  for (const root of params.roots) {
    const abs = resolveInWorkspace(root);
    if (!(await pathExists(abs))) continue;
    await walkDir(abs, toPosixPath(root));
    if (out.length >= maxFiles) break;
  }

  return out;
}

async function readLinesBounded(params: {
  file: string;
  startLine: number;
  endLine: number;
  maxLines: number;
}): Promise<{ ok: true; lines: { line: number; text: string }[] } | { ok: false; error: string }> {
  const abs = resolveInWorkspace(params.file);
  if (!(await pathExists(abs))) return { ok: false, error: `Missing file: ${params.file}` };
  const start = Math.max(1, Math.floor(params.startLine));
  const end = Math.max(start, Math.floor(params.endLine));
  const maxLines = Math.max(1, Math.min(500, Math.floor(params.maxLines)));
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

async function findFirstLine(params: {
  file: string;
  pattern: RegExp;
}): Promise<number | undefined> {
  const abs = resolveInWorkspace(params.file);
  if (!(await pathExists(abs))) return undefined;
  const stat = await fs.stat(abs);
  if (stat.size > 800_000) return undefined;
  const text = await fs.readFile(abs, "utf8");
  if (text.includes("\u0000")) return undefined;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (params.pattern.test(lines[i])) return i + 1;
  }
  return undefined;
}

function formatTraceHit(hit: TraceHit): string {
  const loc = hit.line ? `${hit.file}:${hit.line}` : hit.file;
  return `- ${hit.label}: ${loc}${hit.note ? ` (${hit.note})` : ""}`;
}

async function traceEntrypoints(params: {
  includeDocs?: boolean;
}): Promise<string> {
  const includeDocs = params.includeDocs ?? true;

  const hits: TraceHit[] = [];

  const add = async (hit: Omit<TraceHit, "line"> & { linePattern?: RegExp; file: string }) => {
    const line = hit.linePattern
      ? await findFirstLine({ file: hit.file, pattern: hit.linePattern })
      : undefined;
    hits.push({ file: hit.file, label: hit.label, line, note: hit.note });
  };

  // 1) Primary entry
  await add({
    label: "Public exports",
    file: "src/index.ts",
    linePattern: /^export \{ Timeline \} from/,
  });
  await add({
    label: "Timeline class",
    file: "src/core/Timeline.ts",
    linePattern: /export\s+class\s+Timeline\b/,
  });
  await add({
    label: "Timeline constructor",
    file: "src/core/Timeline.ts",
    linePattern: /constructor\s*\(/,
    note: "初始化配置/状态/管理器通常在这里",
  });
  await add({
    label: "Plugin usage (look for usePlugin/loadPlugin)",
    file: "src/core/Timeline.ts",
    linePattern: /(usePlugin|loadPlugin|pluginManager)/,
    note: "插件装载与生命周期",
  });

  // 2) Managers
  await add({
    label: "PluginManager",
    file: "src/core/managers/PluginManager.ts",
    linePattern: /export\s+class\s+PluginManager\b/,
    note: "registerRenderLayer/registerEventHandler/loadPlugin",
  });
  await add({
    label: "RenderManager",
    file: "src/core/managers/RenderManager.ts",
    linePattern: /export\s+class\s+RenderManager\b/,
    note: "统一调度 draw/渲染层",
  });
  await add({
    label: "ViewportManager",
    file: "src/core/managers/ViewportManager.ts",
    linePattern: /export\s+class\s+ViewportManager\b/,
    note: "缩放/滚动/视口变换",
  });
  await add({
    label: "StateManager",
    file: "src/core/managers/StateManager.ts",
    linePattern: /export\s+class\s+StateManager\b/,
    note: "state 变更与通知",
  });
  await add({
    label: "ChangeScheduler",
    file: "src/core/managers/ChangeScheduler.ts",
    linePattern: /export\s+class\s+ChangeScheduler\b/,
    note: "批量合并变更/触发重绘",
  });
  await add({
    label: "EventIndexManager",
    file: "src/core/managers/EventIndexManager.ts",
    linePattern: /export\s+class\s+EventIndexManager\b/,
    note: "事件索引/查询性能相关",
  });

  // 3) Interaction handlers & states
  await add({
    label: "MouseHandler",
    file: "src/core/handlers/MouseHandler.ts",
    linePattern: /export\s+class\s+MouseHandler\b/,
    note: "鼠标交互入口",
  });
  await add({
    label: "WheelHandler",
    file: "src/core/handlers/WheelHandler.ts",
    linePattern: /export\s+class\s+WheelHandler\b/,
    note: "滚轮缩放/滚动入口",
  });
  await add({
    label: "Interaction states index",
    file: "src/core/handlers/states/index.ts",
    linePattern: /export\s*\{/, 
    note: "Dragging/Resizing/Scrolling 等状态机",
  });

  // 4) Render pipeline
  await add({
    label: "RenderPipeline",
    file: "src/core/renderers/core/RenderPipeline.ts",
    linePattern: /export\s+class\s+RenderPipeline\b/,
    note: "分层渲染管线核心",
  });
  await add({
    label: "Renderer layers index",
    file: "src/core/renderers/layers/index.ts",
    linePattern: /export\s*\{/, 
    note: "各 layer 渲染器入口",
  });
  await add({
    label: "TimelineRenderer",
    file: "src/core/renderers/layers/TimelineRenderer.ts",
    linePattern: /export\s+class\s+TimelineRenderer\b/,
    note: "时间刻度/背景",
  });
  await add({
    label: "EventsRenderer",
    file: "src/core/renderers/layers/EventsRenderer.ts",
    linePattern: /export\s+class\s+EventsRenderer\b/,
    note: "事件渲染",
  });
  await add({
    label: "InteractionRenderer",
    file: "src/core/renderers/layers/InteractionRenderer.ts",
    linePattern: /export\s+class\s+InteractionRenderer\b/,
    note: "拖拽预览/交互覆盖层",
  });

  // 5) Defaults & plugin types
  await add({
    label: "Defaults",
    file: "src/core/utils/defaults.ts",
    linePattern: /export\s+const\s+DEFAULT/i,
    note: "默认配置/颜色/样式",
  });
  await add({
    label: "Plugin types",
    file: "src/plugins/types.ts",
    linePattern: /export\s+interface\s+TimelinePlugin\b/,
    note: "插件生命周期与 API",
  });

  if (includeDocs) {
    await add({
      label: "Docs: plugin development index",
      file: "docs/plugins/plugin-development/index.md",
      linePattern: /^#\s+/,
    });
    await add({
      label: "Docs: timeline API",
      file: "docs/api/timeline/index.md",
      linePattern: /^#\s+/,
    });
  }

  const existing: TraceHit[] = [];
  const missing: TraceHit[] = [];
  for (const h of hits) {
    const abs = resolveInWorkspace(h.file);
    if (await pathExists(abs)) existing.push(h);
    else missing.push(h);
  }

  const out: string[] = [];
  out.push("Entry-point trace (quick navigation):");
  out.push("");
  out.push("## Runtime entrypoints");
  out.push(...existing.map(formatTraceHit));
  if (missing.length > 0) {
    out.push("");
    out.push("## Missing (not found in workspace)");
    out.push(...missing.map(formatTraceHit));
  }
  out.push("");
  out.push("Tips:");
  out.push("- 用 timeline_search 先搜报错/关键字，命中后再用 timeline_read_excerpt 精读小段。");
  out.push("- 遇到交互问题优先看 handlers/states；渲染问题优先看 renderers/layers；插件问题优先看 PluginManager + plugins/types。");

  return out.join("\n");
}

async function searchWorkspace(params: {
  query: string;
  mode: "literal" | "regex";
  caseSensitive: boolean;
  roots: string[];
  extensions: string[];
  maxResults: number;
  contextLines: number;
}): Promise<TextMatch[]> {
  const maxResults = Math.max(1, Math.min(200, params.maxResults));
  const contextLines = Math.max(0, Math.min(10, params.contextLines));
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

  const needle = params.caseSensitive ? params.query : params.query.toLowerCase();
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

async function buildRepoMap(params: {
  roots: string[];
  maxEntries: number;
}): Promise<string> {
  const maxEntries = Math.max(50, Math.min(2000, params.maxEntries));
  const files = await listFilesRecursive({
    roots: params.roots,
    extensions: ["ts", "tsx", "md", "mdx", "json"],
    maxFiles: maxEntries,
  });

  const important: string[] = [];
  const buckets: Array<{ title: string; prefix: string }> = [
    { title: "Core", prefix: "src/core/" },
    { title: "Renderers", prefix: "src/core/renderers/" },
    { title: "Managers", prefix: "src/core/managers/" },
    { title: "Handlers", prefix: "src/core/handlers/" },
    { title: "Plugins", prefix: "src/plugins/" },
    { title: "Docs", prefix: "docs/" },
  ];
  for (const b of buckets) {
    const grouped = files
      .filter((f) => f.startsWith(b.prefix))
      .slice(0, 120)
      .sort((a, c) => a.localeCompare(c));
    if (grouped.length === 0) continue;
    important.push(`## ${b.title}`);
    important.push(...grouped.map((f) => `- ${f}`));
    important.push("");
  }
  if (important.length === 0) return "No files found for repo map.";
  return important.join("\n").trimEnd();
}

function kebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function enumKeyFromPluginType(t: string): string {
  // matches src/plugins/types.ts PluginType keys
  const map: Record<string, string> = {
    render: "RENDER",
    event_handler: "EVENT_HANDLER",
    data_source: "DATA_SOURCE",
    theme: "THEME",
    tool: "TOOL",
    extension: "EXTENSION",
  };
  const key = map[t];
  if (!key) throw new Error(`Unsupported pluginType: ${t}`);
  return key;
}

async function scaffoldBuiltinPlugin(args: {
  exportName: string;
  pluginType:
    | "render"
    | "event_handler"
    | "data_source"
    | "theme"
    | "tool"
    | "extension";
  metadataName?: string;
  description?: string;
  version?: string;
  withReexport?: boolean;
  withIndexExport?: boolean;
}): Promise<string> {
  const exportName = args.exportName;
  const implRel = `src/plugins/builtin/${exportName}.ts`;
  const reexportRel = `src/builtin-plugin/${exportName}.ts`;
  const indexRel = `src/index.ts`;

  const implPath = resolveInWorkspace(implRel);
  const reexportPath = resolveInWorkspace(reexportRel);
  const indexPath = resolveInWorkspace(indexRel);

  if (await pathExists(implPath)) {
    throw new Error(`Already exists: ${implRel}`);
  }
  const withReexport = args.withReexport ?? true;
  const withIndexExport = args.withIndexExport ?? true;
  const version = args.version ?? "1.0.0";

  if (withReexport && (await pathExists(reexportPath))) {
    throw new Error(`Already exists: ${reexportRel}`);
  }

  const metadataName = args.metadataName ?? kebabCase(exportName);
  const description =
    args.description ?? `Builtin plugin: ${exportName} (${args.pluginType})`;
  const typeKey = enumKeyFromPluginType(args.pluginType);

  const implContent =
    `import type { TimelinePlugin } from "../types";\n` +
    `import { PluginType } from "../types";\n\n` +
    `export const ${exportName}: TimelinePlugin = {\n` +
    `  metadata: {\n` +
    `    name: "${metadataName}",\n` +
    `    version: "${version}",\n` +
    `    description: "${description.replace(/"/g, "\\\"")}",\n` +
    `    type: PluginType.${typeKey},\n` +
    `  },\n` +
    `  activate(_context) {\n` +
    `    // TODO: implement\n` +
    `  },\n` +
    `  deactivate(_context) {\n` +
    `    // TODO: cleanup\n` +
    `  },\n` +
    `};\n`;

  await fs.mkdir(path.dirname(implPath), { recursive: true });
  await fs.writeFile(implPath, implContent, "utf8");

  if (withReexport) {
    const reexportContent = `export { ${exportName} } from "../plugins/builtin/${exportName}";\n`;
    await fs.mkdir(path.dirname(reexportPath), { recursive: true });
    await fs.writeFile(reexportPath, reexportContent, "utf8");
  }

  let indexUpdated = false;
  if (withIndexExport) {
    if (!(await pathExists(indexPath))) {
      throw new Error(`Missing: ${indexRel}`);
    }
    const indexText = await fs.readFile(indexPath, "utf8");
    const exportLine = `export { ${exportName} } from "./plugins/builtin/${exportName}";`;
    if (!indexText.includes(exportLine)) {
      const lines = indexText.split(/\r?\n/);
      // insert after the last builtin plugin export
      let insertAt = -1;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^export \{\s*\w+\s*\} from "\.\/plugins\/builtin\//.test(l)) {
          insertAt = i;
        }
      }
      if (insertAt === -1) {
        // fallback: after Timeline export
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('export { Timeline } from "./core/Timeline"')) {
            insertAt = i;
            break;
          }
        }
      }
      if (insertAt === -1) insertAt = 0;
      lines.splice(insertAt + 1, 0, exportLine);
      await fs.writeFile(indexPath, lines.join("\n"), "utf8");
      indexUpdated = true;
    }
  }

  return (
    `Created ${implRel}` +
    (withReexport ? `\nCreated ${reexportRel}` : "") +
    (withIndexExport
      ? `\n${indexUpdated ? "Updated" : "No change"} ${indexRel}`
      : "")
  );
}

async function validateBuiltinPlugin(args: { exportName: string }): Promise<string> {
  const exportName = args.exportName;

  const implRel = `src/plugins/builtin/${exportName}.ts`;
  const reexportRel = `src/builtin-plugin/${exportName}.ts`;
  const indexRel = `src/index.ts`;

  const implPath = resolveInWorkspace(implRel);
  const reexportPath = resolveInWorkspace(reexportRel);
  const indexPath = resolveInWorkspace(indexRel);

  const problems: string[] = [];

  if (!(await pathExists(implPath))) problems.push(`Missing ${implRel}`);
  if (!(await pathExists(reexportPath))) problems.push(`Missing ${reexportRel}`);
  if (await pathExists(implPath)) {
    const text = await fs.readFile(implPath, "utf8");
    const ok =
      new RegExp(`export\\s+(const|function)\\s+${exportName}\\b`).test(text) ||
      new RegExp(`export\\s*\\{[^}]*\\b${exportName}\\b[^}]*\\}`).test(text);
    if (!ok) problems.push(`No exported symbol '${exportName}' in ${implRel}`);
  }
  if (await pathExists(indexPath)) {
    const text = await fs.readFile(indexPath, "utf8");
    const exportLine = `export { ${exportName} } from "./plugins/builtin/${exportName}";`;
    if (!text.includes(exportLine)) {
      problems.push(`Missing export in ${indexRel}: ${exportLine}`);
    }
  } else {
    problems.push(`Missing ${indexRel}`);
  }

  return problems.length === 0
    ? `OK: builtin plugin '${exportName}' looks wired up.`
    : `Problems:\n- ${problems.join("\n- ")}`;
}

async function listBuiltinPlugins(): Promise<string> {
  const dirRel = "src/plugins/builtin";
  const dirPath = resolveInWorkspace(dirRel);
  if (!(await pathExists(dirPath))) {
    return `Missing directory: ${dirRel}`;
  }
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const names = entries
    .filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => e.name.replace(/\.ts$/, ""))
    .sort((a, b) => a.localeCompare(b));
  return names.join("\n");
}

async function runRepoScript(args: {
  script: "lint" | "build" | "dev" | "docs:dev" | "docs:build" | "typecheck";
}): Promise<string> {

  const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  const result = await new Promise<{ code: number | null; out: string }>(
    (resolve, reject) => {
      const child = spawn(pnpmCmd, ["-s", "run", args.script], {
        cwd: workspaceRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      const limit = 60_000;
      child.stdout.on("data", (d) => {
        out += d.toString();
        if (out.length > limit) out = out.slice(0, limit) + "\n...<truncated>\n";
      });
      child.stderr.on("data", (d) => {
        out += d.toString();
        if (out.length > limit) out = out.slice(0, limit) + "\n...<truncated>\n";
      });
      child.on("error", (err) => reject(err));
      child.on("close", (code) => resolve({ code, out }));
    }
  );

  return `pnpm run ${args.script}\nexitCode=${result.code}\n\n${result.out}`;
}

async function runMcpScript(args: {
  script: "start" | "dev" | "typecheck";
}): Promise<string> {

  const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const mcpDir = resolveInWorkspace("packages/mcp-service");

  const result = await new Promise<{ code: number | null; out: string }>(
    (resolve, reject) => {
      const child = spawn(pnpmCmd, ["-s", "run", args.script], {
        cwd: mcpDir,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      const limit = 60_000;
      child.stdout.on("data", (d) => {
        out += d.toString();
        if (out.length > limit) out = out.slice(0, limit) + "\n...<truncated>\n";
      });
      child.stderr.on("data", (d) => {
        out += d.toString();
        if (out.length > limit) out = out.slice(0, limit) + "\n...<truncated>\n";
      });
      child.on("error", (err) => reject(err));
      child.on("close", (code) => resolve({ code, out }));
    }
  );

  return `pnpm -C packages/mcp-service run ${args.script}\nexitCode=${result.code}\n\n${result.out}`;
}

async function main() {
  const server = new McpServer({
    name: "timeline-canvas-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "timeline_scaffold_builtin_plugin",
    {
      title: "Scaffold Builtin Plugin",
      description:
        "Create a new builtin plugin (src/plugins/builtin + src/builtin-plugin re-export) and wire export in src/index.ts.",
      inputSchema: {
        exportName: z
          .string()
          .min(1)
          .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, "exportName must be a valid identifier"),
        pluginType: z.enum([
          "render",
          "event_handler",
          "data_source",
          "theme",
          "tool",
          "extension",
        ]),
        metadataName: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        version: z.string().min(1).optional().default("1.0.0"),
        withReexport: z.boolean().optional().default(true),
        withIndexExport: z.boolean().optional().default(true),
      },
    },
    async (input) => {
      try {
        const text = await scaffoldBuiltinPlugin(input);
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err?.message ?? String(err)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_validate_builtin_plugin",
    {
      title: "Validate Builtin Plugin",
      description:
        "Validate builtin plugin wiring: file exists, export symbol exists, and src/index.ts exports it.",
      inputSchema: {
        exportName: z
          .string()
          .min(1)
          .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, "exportName must be a valid identifier"),
      },
    },
    async (input) => {
      try {
        const text = await validateBuiltinPlugin(input);
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err?.message ?? String(err)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_list_builtin_plugins",
    {
      title: "List Builtin Plugins",
      description: "List builtin plugin names under src/plugins/builtin.",
      inputSchema: {},
    },
    async () => {
      try {
        const text = await listBuiltinPlugins();
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err?.message ?? String(err)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_run_repo_script",
    {
      title: "Run Repo Script",
      description:
        "Run an allowlisted pnpm script in this repo (lint/build/typecheck/docs).",
      inputSchema: {
        script: z.enum(["lint", "build", "dev", "docs:dev", "docs:build", "typecheck"]),
      },
    },
    async (input) => {
      try {
        const text = await runRepoScript(input);
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err?.message ?? String(err)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_run_mcp_script",
    {
      title: "Run MCP Script",
      description:
        "Run an allowlisted pnpm script in packages/mcp-service (start/dev/typecheck).",
      inputSchema: {
        script: z.enum(["start", "dev", "typecheck"]),
      },
    },
    async (input) => {
      try {
        const text = await runMcpScript(input);
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err?.message ?? String(err)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_repo_map",
    {
      title: "Repo Map",
      description:
        "Summarize key files (src/docs/plugins/renderers/managers) to help quickly orient and locate likely code locations without bulk reading.",
      inputSchema: {
        roots: z.array(z.string().min(1)).optional().default(["src", "docs"]),
        maxEntries: z.number().int().min(50).max(2000).optional().default(800),
      },
    },
    async (input) => {
      try {
        const text = await buildRepoMap(input);
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err?.message ?? String(err)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_search",
    {
      title: "Search Workspace",
      description:
        "Search across src/ and docs/ with line+column and small snippets. Designed for fast issue localization without rereading large files.",
      inputSchema: {
        query: z.string().min(1),
        mode: z.enum(["literal", "regex"]).optional().default("literal"),
        caseSensitive: z.boolean().optional().default(false),
        roots: z.array(z.string().min(1)).optional().default(["src", "docs"]),
        extensions: z
          .array(z.string().min(1))
          .optional()
          .default(["ts", "tsx", "md", "mdx"]),
        maxResults: z.number().int().min(1).max(200).optional().default(30),
        contextLines: z.number().int().min(0).max(10).optional().default(2),
      },
    },
    async (input) => {
      try {
        const matches = await searchWorkspace(input);
        if (matches.length === 0) {
          return { content: [{ type: "text", text: "No matches." }] };
        }
        const lines: string[] = [];
        for (const m of matches) {
          lines.push(`${m.file}:${m.line}:${m.col}`);
          for (const s of m.snippet) {
            const mark = s.line === m.line ? ">" : " ";
            lines.push(`${mark} ${String(s.line).padStart(4, " ")}: ${s.text}`);
          }
          lines.push("---");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err?.message ?? String(err)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_read_excerpt",
    {
      title: "Read Excerpt",
      description:
        "Read a small line range from a file (bounded) to avoid large file rereads.",
      inputSchema: {
        file: z.string().min(1),
        startLine: z.number().int().min(1),
        endLine: z.number().int().min(1),
        maxLines: z.number().int().min(1).max(500).optional().default(200),
      },
    },
    async (input) => {
      try {
        const res = await readLinesBounded(input);
        if (!res.ok) {
          return { content: [{ type: "text", text: `Error: ${res.error}` }], isError: true };
        }
        const text = res.lines
          .map((l) => `${String(l.line).padStart(4, " ")}: ${l.text}`)
          .join("\n");
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err?.message ?? String(err)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "timeline_trace_entrypoints",
    {
      title: "Trace Entrypoints",
      description:
        "Generate a navigation-friendly trace of key runtime entrypoints (Timeline → managers → handlers → render pipeline → plugin types/docs) with line hints.",
      inputSchema: {
        includeDocs: z.boolean().optional().default(true),
      },
    },
    async (input) => {
      try {
        const text = await traceEntrypoints(input);
        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err?.message ?? String(err)}` }],
          isError: true,
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
