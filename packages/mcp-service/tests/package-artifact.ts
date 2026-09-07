import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

interface PackResult {
  filename: string;
  files: Array<{ path: string }>;
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "timeline-canvas-mcp-package-"));

try {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const packOutput = execFileSync(
    npmCommand,
    ["pack", "--json", "--pack-destination", temporaryRoot],
    { cwd: packageRoot, encoding: "utf8" },
  );
  const [packResult] = JSON.parse(packOutput) as PackResult[];
  assert(packResult, "npm pack returned no artifact");

  const packedPaths = new Set(packResult.files.map((file) => file.path));
  for (const template of [
    "plugin-basic.template",
    "plugin-media.template",
    "plugin-render.template",
    "plugin-theme.template",
    "test.template",
  ]) {
    assert(
      packedPaths.has(`templates/${template}`),
      `packed artifact is missing templates/${template}`,
    );
  }
  assert(
    ![...packedPaths].some((filePath) => filePath.startsWith("templates/templates/")),
    "packed templates must not be nested under templates/templates",
  );

  const archivePath = path.join(temporaryRoot, packResult.filename);
  execFileSync("tar", ["-xzf", archivePath, "-C", temporaryRoot]);

  const extractedPackageRoot = path.join(temporaryRoot, "package");
  await fs.symlink(
    path.join(packageRoot, "node_modules"),
    path.join(extractedPackageRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const workspaceRoot = path.join(temporaryRoot, "workspace");
  const timelineRoot = path.join(workspaceRoot, "packages/timeline");
  await Promise.all([
    fs.mkdir(path.join(timelineRoot, "src/plugins/builtin"), { recursive: true }),
    fs.mkdir(path.join(timelineRoot, "src/builtin-plugin"), { recursive: true }),
    fs.mkdir(path.join(timelineRoot, "tests"), { recursive: true }),
  ]);
  await fs.writeFile(
    path.join(timelineRoot, "src/index.ts"),
    'export { Timeline } from "./core/Timeline";\n',
    "utf8",
  );

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(extractedPackageRoot, "bin/timeline-canvas-mcp.js")],
    cwd: workspaceRoot,
    stderr: "pipe",
  });
  let serverStderr = "";
  transport.stderr?.on("data", (chunk) => {
    serverStderr += String(chunk);
  });

  const client = new Client({ name: "package-artifact-test", version: "1.0.0" });
  await client.connect(transport);
  try {
    const sharedInput = {
      metadataName: 'packed "name" \\ value',
      description: "packed\ndescription */ ${value}",
      version: '1.0.0-"packed"',
      withTest: true,
    };
    for (const input of [
      {
        ...sharedInput,
        exportName: "PackedMedia",
        pluginType: "render",
        features: ["media"],
      },
      { ...sharedInput, exportName: "PackedRender", pluginType: "render" },
      { ...sharedInput, exportName: "PackedTheme", pluginType: "theme" },
    ]) {
      const result = await client.callTool({
        name: "timeline_scaffold_plugin",
        arguments: input,
      });
      assert.notEqual(result.isError, true, JSON.stringify(result));
    }
  } finally {
    await client.close();
  }
  assert.equal(serverStderr, "", `packed server wrote to stderr:\n${serverStderr}`);

  const generatedMedia = await fs.readFile(
    path.join(timelineRoot, "src/plugins/builtin/PackedMedia.ts"),
    "utf8",
  );
  const generatedRender = await fs.readFile(
    path.join(timelineRoot, "src/plugins/builtin/PackedRender.ts"),
    "utf8",
  );
  const generatedTheme = await fs.readFile(
    path.join(timelineRoot, "src/plugins/builtin/PackedTheme.ts"),
    "utf8",
  );
  const generatedTest = await fs.readFile(
    path.join(timelineRoot, "tests/PackedMedia.spec.ts"),
    "utf8",
  );

  assert.match(generatedMedia, /export function PackedMedia/);
  assert.match(generatedMedia, /name: "packed \\"name\\" \\\\ value"/);
  assert.match(generatedRender, /registerRenderLayer/);
  assert.match(generatedTheme, /Partial<TimelineColors>/);
  assert.match(generatedTest, /from "vite-plus\/test"/);
  assert(!generatedMedia.includes("{{"), "generated media template has unresolved placeholders");

  console.log(
    "Packed MCP artifact generated media, render, theme, and .spec.ts files successfully.",
  );
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
