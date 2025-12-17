import { listFilesRecursive } from "./workspace.js";
import { clampInt } from "./utils.js";

export async function buildRepoMap(params: {
  roots: string[];
  maxEntries: number;
}): Promise<string> {
  const maxEntries = clampInt(params.maxEntries, 50, 2000);
  const files = await listFilesRecursive({
    roots: params.roots,
    extensions: ["ts", "tsx", "md", "mdx", "json"],
    maxFiles: maxEntries,
  });

  const important: string[] = [];
  const buckets: Array<{ title: string; prefix: string }> = [
    { title: "Core", prefix: "packages/timeline/src/core/" },
    { title: "Renderers", prefix: "packages/timeline/src/renderers/" },
    { title: "Managers", prefix: "packages/timeline/src/core/managers/" },
    { title: "Handlers", prefix: "packages/timeline/src/handlers/" },
    { title: "Plugins", prefix: "packages/timeline/src/plugins/" },
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
