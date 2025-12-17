import type { TraceHit } from "./types.js";
import { findFirstLine, pathExists, resolveInWorkspace } from "./workspace.js";

function formatTraceHit(hit: TraceHit): string {
  const loc = hit.line ? `${hit.file}:${hit.line}` : hit.file;
  return `- ${hit.label}: ${loc}${hit.note ? ` (${hit.note})` : ""}`;
}

export async function traceEntrypoints(params: {
  includeDocs?: boolean;
}): Promise<string> {
  const includeDocs = params.includeDocs ?? true;

  const hits: TraceHit[] = [];

  const add = async (
    hit: Omit<TraceHit, "line"> & { linePattern?: RegExp; file: string }
  ) => {
    const line = hit.linePattern
      ? await findFirstLine({ file: hit.file, pattern: hit.linePattern })
      : undefined;
    hits.push({ file: hit.file, label: hit.label, line, note: hit.note });
  };

  await add({
    label: "Public exports",
    file: "packages/timeline/src/index.ts",
    linePattern: /^export \{ Timeline \} from/,
  });
  await add({
    label: "Timeline class",
    file: "packages/timeline/src/core/Timeline.ts",
    linePattern: /export\s+class\s+Timeline\b/,
  });
  await add({
    label: "Timeline constructor",
    file: "packages/timeline/src/core/Timeline.ts",
    linePattern: /constructor\s*\(/,
    note: "初始化配置/状态/管理器通常在这里",
  });
  await add({
    label: "Plugin usage (look for usePlugin/loadPlugin)",
    file: "packages/timeline/src/core/Timeline.ts",
    linePattern: /(usePlugin|loadPlugin|pluginManager)/,
    note: "插件装载与生命周期",
  });

  await add({
    label: "PluginManager",
    file: "packages/timeline/src/core/managers/PluginManager.ts",
    linePattern: /export\s+class\s+PluginManager\b/,
    note: "registerRenderLayer/registerEventHandler/loadPlugin",
  });
  await add({
    label: "RenderManager",
    file: "packages/timeline/src/core/managers/RenderManager.ts",
    linePattern: /export\s+class\s+RenderManager\b/,
    note: "统一调度 draw/渲染层",
  });
  await add({
    label: "ViewportManager",
    file: "packages/timeline/src/core/managers/ViewportManager.ts",
    linePattern: /export\s+class\s+ViewportManager\b/,
    note: "缩放/滚动/视口变换",
  });
  await add({
    label: "StateManager",
    file: "packages/timeline/src/core/managers/StateManager.ts",
    linePattern: /export\s+class\s+StateManager\b/,
    note: "state 变更与通知",
  });
  await add({
    label: "ChangeScheduler",
    file: "packages/timeline/src/core/managers/ChangeScheduler.ts",
    linePattern: /export\s+class\s+ChangeScheduler\b/,
    note: "批量合并变更/触发重绘",
  });
  await add({
    label: "EventIndexManager",
    file: "packages/timeline/src/core/managers/EventIndexManager.ts",
    linePattern: /export\s+class\s+EventIndexManager\b/,
    note: "事件索引/查询性能相关",
  });

  await add({
    label: "MouseHandler",
    file: "packages/timeline/src/handlers/MouseHandler.ts",
    linePattern: /export\s+class\s+MouseHandler\b/,
    note: "鼠标交互入口",
  });
  await add({
    label: "WheelHandler",
    file: "packages/timeline/src/handlers/WheelHandler.ts",
    linePattern: /export\s+class\s+WheelHandler\b/,
    note: "滚轮缩放/滚动入口",
  });
  await add({
    label: "Interaction states index",
    file: "packages/timeline/src/handlers/states/index.ts",
    linePattern: /export\s*\{/,
    note: "Dragging/Resizing/Scrolling 等状态机",
  });

  await add({
    label: "RenderPipeline",
    file: "packages/timeline/src/renderers/core/RenderPipeline.ts",
    linePattern: /export\s+class\s+RenderPipeline\b/,
    note: "分层渲染管线核心",
  });
  await add({
    label: "Renderer layers index",
    file: "packages/timeline/src/renderers/layers/index.ts",
    linePattern: /export\s*\{/,
    note: "各 layer 渲染器入口",
  });
  await add({
    label: "TimelineRenderer",
    file: "packages/timeline/src/renderers/layers/TimelineRenderer.ts",
    linePattern: /export\s+class\s+TimelineRenderer\b/,
    note: "时间刻度/背景",
  });
  await add({
    label: "EventsRenderer",
    file: "packages/timeline/src/renderers/layers/EventsRenderer.ts",
    linePattern: /export\s+class\s+EventsRenderer\b/,
    note: "事件渲染",
  });
  await add({
    label: "InteractionRenderer",
    file: "packages/timeline/src/renderers/layers/InteractionRenderer.ts",
    linePattern: /export\s+class\s+InteractionRenderer\b/,
    note: "拖拽预览/交互覆盖层",
  });

  await add({
    label: "Defaults",
    file: "packages/timeline/src/utils/defaults.ts",
    linePattern: /export\s+const\s+DEFAULT/i,
    note: "默认配置/颜色/样式",
  });
  await add({
    label: "Plugin types",
    file: "packages/timeline/src/plugins/types.ts",
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
  out.push(
    "- 用 timeline_search 先搜报错/关键字，命中后再用 timeline_read_excerpt 精读小段。"
  );
  out.push(
    "- 遇到交互问题优先看 handlers/states；渲染问题优先看 renderers/layers；插件问题优先看 PluginManager + plugins/types。"
  );

  return out.join("\n");
}
