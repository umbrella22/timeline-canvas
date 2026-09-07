import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import ts from "typescript";

interface PackResult {
  id: string;
  name: string;
  version: string;
  filename: string;
  files: Array<{ path: string }>;
}

interface ProjectInfo {
  root: string;
  installedVersion: string | null;
  testedVersion: string;
  compatibility: "tested-version" | "unverified-version" | "not-installed";
}

interface ReturnedFile {
  path: string;
  content: string;
}

interface GuideResult {
  project: ProjectInfo;
  framework: "vanilla" | "react" | "vue";
  files: ReturnedFile[];
  notes: string[];
}

interface GenerateResult {
  project: ProjectInfo;
  files: ReturnedFile[];
  usage: string;
  notes: string[];
}

interface ValidationResult {
  project: ProjectInfo;
  status: "passed" | "failed" | "blocked";
  exportName: string;
  diagnostics: Array<{
    severity: "error" | "warning";
    code: string;
    message: string;
  }>;
  checks: {
    types: "passed" | "failed" | "not-run";
    pluginContract: "passed" | "failed" | "not-run";
    lifecycle: "review-required" | "not-run";
    runtime: "not-run";
  };
  notes: string[];
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const timelinePackageRoot = path.join(repositoryRoot, "packages/timeline");
const temporaryRoot = await fs.realpath(
  await fs.mkdtemp(path.join(os.tmpdir(), "timeline-canvas-user-mcp-package-")),
);
const consumerRoot = path.join(temporaryRoot, "consumer");
const consumerNodeModules = path.join(consumerRoot, "node_modules");
const installedTimelineRoot = path.join(consumerNodeModules, "timeline-canvas");
const pluginRelativePath = "src/timeline-plugin.ts";
const exportName = "createCustomPlugin";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
let installedTimelineVersion: string;

function pack(packageDirectory: string): PackResult {
  const output = execFileSync(npmCommand, ["pack", "--json", "--pack-destination", temporaryRoot], {
    cwd: packageDirectory,
    encoding: "utf8",
  });
  const [result] = JSON.parse(output) as PackResult[];
  assert(result, `npm pack returned no artifact for ${packageDirectory}`);
  return result;
}

async function extractPackage(archivePath: string, destination: string): Promise<void> {
  await fs.mkdir(destination, { recursive: true });
  execFileSync("tar", ["-xzf", archivePath, "--strip-components=1", "-C", destination]);
}

function serverEnvironment(): Record<string, string> {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  return { ...inherited, MCP_WORKSPACE_ROOT: consumerRoot };
}

async function snapshotConsumer(): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();

  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (directory === consumerRoot && entry.name === "node_modules") continue;
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(consumerRoot, absolutePath);
      if (entry.isDirectory()) {
        snapshot.set(`${relativePath}/`, "directory");
        await visit(absolutePath);
      } else if (entry.isSymbolicLink()) {
        snapshot.set(relativePath, `symlink:${await fs.readlink(absolutePath)}`);
      } else {
        snapshot.set(relativePath, (await fs.readFile(absolutePath)).toString("base64"));
      }
    }
  }

  await visit(consumerRoot);
  return snapshot;
}

async function callWithoutWrites(client: Client, request: Parameters<Client["callTool"]>[0]) {
  const before = await snapshotConsumer();
  const result = await client.callTool(request);
  assert.deepEqual(
    await snapshotConsumer(),
    before,
    `${request.name} modified the consumer workspace`,
  );
  return result;
}

function structured<T>(result: unknown): T {
  assert(typeof result === "object" && result !== null, "tool result must be an object");
  const record = result as Record<string, unknown>;
  assert.notEqual(record.isError, true, JSON.stringify(result));
  assert(
    typeof record.structuredContent === "object" && record.structuredContent !== null,
    "successful tool result lacks structuredContent",
  );
  assert(Array.isArray(record.content), "tool content must be an array");
  const text = record.content.find(
    (item): item is { type: "text"; text: string } =>
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      item.type === "text" &&
      "text" in item &&
      typeof item.text === "string",
  );
  assert(text, "successful tool result lacks text content");
  assert.deepEqual(JSON.parse(text.text), record.structuredContent);
  return record.structuredContent as T;
}

function assertProject(project: ProjectInfo): void {
  assert.deepEqual(project, {
    root: consumerRoot,
    installedVersion: installedTimelineVersion,
    testedVersion: "1.5.0",
    compatibility: "tested-version",
  });
}

async function assertProtocol(client: Client): Promise<void> {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    "timeline_user_generate_plugin",
    "timeline_user_get_guide",
    "timeline_user_validate_plugin",
  ]);

  const expectedOutputProperties: Record<string, string[]> = {
    timeline_user_get_guide: ["files", "framework", "notes", "project"],
    timeline_user_generate_plugin: ["files", "notes", "project", "usage"],
    timeline_user_validate_plugin: [
      "checks",
      "diagnostics",
      "exportName",
      "notes",
      "project",
      "status",
    ],
  };
  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
    assert.equal(tool.annotations?.destructiveHint, false, tool.name);
    assert.equal(tool.outputSchema?.type, "object", tool.name);
    assert.deepEqual(
      Object.keys(tool.outputSchema?.properties ?? {}).sort(),
      expectedOutputProperties[tool.name],
      `${tool.name} has an unexpected output schema`,
    );
  }

  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  assert.deepEqual(byName.get("timeline_user_get_guide")?.inputSchema.properties?.framework, {
    type: "string",
    enum: ["vanilla", "react", "vue"],
  });
  assert.deepEqual(byName.get("timeline_user_generate_plugin")?.inputSchema.properties?.template, {
    type: "string",
    enum: ["basic", "render", "event-handler"],
  });
  assert.deepEqual(
    Object.keys(byName.get("timeline_user_validate_plugin")?.inputSchema.properties ?? {}).sort(),
    ["exportName", "filePath"],
  );
}

async function applyFiles(files: ReturnedFile[]): Promise<void> {
  await applyFilesUnder(consumerRoot, files);
}

async function applyFilesUnder(root: string, files: ReturnedFile[]): Promise<void> {
  assert(files.length > 0, "tool returned no files to apply");
  for (const file of files) {
    const destination = path.resolve(root, file.path);
    const relative = path.relative(root, destination);
    assert(
      relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
      `returned file escapes consumer root: ${file.path}`,
    );
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, file.content, "utf8");
  }
}

async function linkConsumerDependency(packageName: string): Promise<void> {
  const segments = packageName.split("/");
  const source = path.join(repositoryRoot, "node_modules", ...segments);
  const destination = path.join(consumerNodeModules, ...segments);
  await fs.access(source);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.symlink(source, destination, process.platform === "win32" ? "junction" : "dir");
}

async function compileGuide(guide: GuideResult): Promise<void> {
  const guideRoot = path.join(consumerRoot, "guides", guide.framework);
  await applyFilesUnder(guideRoot, guide.files);

  let sourcePath: string;
  if (guide.framework === "vanilla") {
    const main = guide.files.find((file) => file.path === "src/main.ts");
    assert(main, "vanilla guide must return src/main.ts");
    sourcePath = path.join(guideRoot, main.path);
  } else if (guide.framework === "react") {
    const component = guide.files.find((file) => file.path.endsWith(".tsx"));
    const stylesheet = guide.files.find((file) => file.path.endsWith(".css"));
    assert(component, "React guide must return a TSX component");
    assert(stylesheet, "React guide must return its imported stylesheet");
    await fs.access(path.join(guideRoot, stylesheet.path));
    sourcePath = path.join(guideRoot, component.path);
  } else {
    const component = guide.files.find((file) => file.path.endsWith(".vue"));
    assert(component, "Vue guide must return a component");
    const script = component.content.match(
      /<script\s+setup\s+lang=["']ts["']>([\s\S]*?)<\/script>/,
    );
    assert(script, "Vue guide must contain a TypeScript script setup block");
    sourcePath = path.join(guideRoot, "src/TimelineExample.script.ts");
    await fs.writeFile(sourcePath, script[1], "utf8");
  }

  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    noUncheckedSideEffectImports: false,
  };
  const timelineResolution = ts.resolveModuleName(
    "timeline-canvas",
    sourcePath,
    options,
    ts.sys,
  ).resolvedModule;
  assert(timelineResolution, `${guide.framework} did not resolve timeline-canvas`);
  const resolvedDeclaration = await fs.realpath(timelineResolution.resolvedFileName);
  const relativeDeclaration = path.relative(
    await fs.realpath(installedTimelineRoot),
    resolvedDeclaration,
  );
  assert(
    relativeDeclaration.startsWith(`dist${path.sep}`) &&
      !relativeDeclaration.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeDeclaration),
    `${guide.framework} resolved timeline-canvas outside the consumer package: ${resolvedDeclaration}`,
  );

  const program = ts.createProgram([sourcePath], options);
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      if (!diagnostic.file || diagnostic.start === undefined) return message;
      const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      return `${path.relative(consumerRoot, diagnostic.file.fileName)}:${location.line + 1}:${location.character + 1} ${message}`;
    });
  assert.deepEqual(
    errors,
    [],
    `${guide.framework} guide does not compile against the consumer package`,
  );
}

function assertPassedValidation(result: ValidationResult): void {
  assertProject(result.project);
  assert.equal(result.status, "passed");
  assert.equal(result.exportName, exportName);
  assert.deepEqual(result.checks, {
    types: "passed",
    pluginContract: "passed",
    lifecycle: "review-required",
    runtime: "not-run",
  });
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    false,
  );
}

async function withServer(
  label: string,
  command: string,
  args: string[],
  cwd: string,
  run: (client: Client) => Promise<void>,
): Promise<void> {
  const transport = new StdioClientTransport({
    command,
    args,
    cwd,
    env: serverEnvironment(),
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const client = new Client({
    name: `user-mcp-package-test-${label}`,
    version: "1.0.0",
  });

  try {
    await client.connect(transport);
    await run(client);
  } finally {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
  assert.equal(stderr, "", `${label} server wrote to stderr:\n${stderr}`);
}

try {
  await fs.mkdir(consumerNodeModules, { recursive: true });
  await fs.writeFile(
    path.join(consumerRoot, "package.json"),
    JSON.stringify({ name: "timeline-mcp-test-consumer", private: true }),
    "utf8",
  );

  const suppliedTimelineTarball = process.env.TIMELINE_CANVAS_TARBALL;
  if (suppliedTimelineTarball) {
    const archivePath = path.resolve(suppliedTimelineTarball);
    await fs.access(archivePath);
    await extractPackage(archivePath, installedTimelineRoot);
  } else {
    const timelinePack = pack(timelinePackageRoot);
    assert.equal(timelinePack.name, "timeline-canvas");
    assert.equal(timelinePack.version, "1.5.0");
    assert.equal(timelinePack.filename, "timeline-canvas-1.5.0.tgz");
    await extractPackage(path.join(temporaryRoot, timelinePack.filename), installedTimelineRoot);
  }
  const installedTimelinePackage = JSON.parse(
    await fs.readFile(path.join(installedTimelineRoot, "package.json"), "utf8"),
  ) as { name: string; version: string };
  assert.equal(installedTimelinePackage.name, "timeline-canvas");
  installedTimelineVersion = installedTimelinePackage.version;
  assert(["1.4.1", "1.5.0"].includes(installedTimelineVersion));
  await assert.rejects(
    fs.access(path.join(installedTimelineRoot, "src")),
    "consumer must validate against the packed package without source files",
  );
  for (const dependency of ["@types/react", "react", "vue"]) {
    await linkConsumerDependency(dependency);
  }

  const userMcpPack = pack(packageRoot);
  assert.equal(userMcpPack.id, "timeline-canvas-user-mcp@0.1.0");
  assert.equal(userMcpPack.name, "timeline-canvas-user-mcp");
  assert.equal(userMcpPack.version, "0.1.0");
  assert.equal(userMcpPack.filename, "timeline-canvas-user-mcp-0.1.0.tgz");
  const packedPaths = new Set(userMcpPack.files.map((file) => file.path));
  assert(packedPaths.has("bin/timeline-canvas-user-mcp.js"));
  assert(packedPaths.has("dist/server.mjs"));
  assert(
    ![...packedPaths].some((file) => /(^|\/)(?:templates|assets)(\/|$)/.test(file)),
    "inline templates must not be shipped as separate assets",
  );

  const installedMcpRoot = path.join(consumerNodeModules, "timeline-canvas-user-mcp");
  await extractPackage(path.join(temporaryRoot, userMcpPack.filename), installedMcpRoot);
  const installedMcpPackage = JSON.parse(
    await fs.readFile(path.join(installedMcpRoot, "package.json"), "utf8"),
  ) as { name: string; version: string; bin: Record<string, string> };
  assert.equal(installedMcpPackage.name, "timeline-canvas-user-mcp");
  assert.equal(installedMcpPackage.version, "0.1.0");
  assert.deepEqual(installedMcpPackage.bin, {
    "timeline-canvas-user-mcp": "./bin/timeline-canvas-user-mcp.js",
  });
  await fs.symlink(
    path.join(packageRoot, "node_modules"),
    path.join(installedMcpRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );

  await withServer(
    "source",
    process.execPath,
    ["--import", "tsx", path.join(packageRoot, "src/server.ts")],
    packageRoot,
    async (client) => {
      await assertProtocol(client);
      const badRequest = await callWithoutWrites(client, {
        name: "timeline_user_get_guide",
        arguments: { framework: "svelte" },
      });
      assert.equal(badRequest.isError, true);
      const recovered = structured<GuideResult>(
        await callWithoutWrites(client, {
          name: "timeline_user_get_guide",
          arguments: { framework: "vanilla" },
        }),
      );
      assert.equal(recovered.framework, "vanilla");
      assertProject(recovered.project);
    },
  );

  await withServer(
    "packed",
    process.execPath,
    [path.join(installedMcpRoot, "bin/timeline-canvas-user-mcp.js")],
    consumerRoot,
    async (client) => {
      await assertProtocol(client);

      for (const framework of ["vanilla", "react", "vue"] as const) {
        const guide = structured<GuideResult>(
          await callWithoutWrites(client, {
            name: "timeline_user_get_guide",
            arguments: { framework },
          }),
        );
        assert.equal(guide.framework, framework);
        assert(guide.files.length > 0);
        assert(guide.files.every((file) => file.path && file.content));
        assert(guide.notes.length > 0);
        assertProject(guide.project);
        await compileGuide(guide);
      }

      for (const template of ["basic", "render", "event-handler"] as const) {
        const generated = structured<GenerateResult>(
          await callWithoutWrites(client, {
            name: "timeline_user_generate_plugin",
            arguments: {
              template,
              exportName,
              name: `consumer-${template}`,
              description: `Packed ${template} integration test`,
            },
          }),
        );
        assert.deepEqual(
          generated.files.map((file) => file.path),
          [pluginRelativePath],
        );
        assert(generated.usage.includes(exportName));
        assert(generated.notes.join(" ").includes("1.4.1"));
        assertProject(generated.project);

        await applyFiles(generated.files);
        const validation = structured<ValidationResult>(
          await callWithoutWrites(client, {
            name: "timeline_user_validate_plugin",
            arguments: { filePath: pluginRelativePath, exportName },
          }),
        );
        assertPassedValidation(validation);
      }

      const pluginPath = path.join(consumerRoot, pluginRelativePath);
      await fs.appendFile(pluginPath, "\nconst staleCacheProof: string = 123;\n", "utf8");
      const staleCacheResult = structured<ValidationResult>(
        await callWithoutWrites(client, {
          name: "timeline_user_validate_plugin",
          arguments: { filePath: pluginRelativePath, exportName },
        }),
      );
      assert.equal(staleCacheResult.status, "failed");
      assert.equal(staleCacheResult.checks.types, "failed");
      assert(
        staleCacheResult.diagnostics.some(
          (diagnostic) => diagnostic.severity === "error" && diagnostic.code === "TS2322",
        ),
        "consecutive validation did not observe the new TypeScript error",
      );

      await fs.writeFile(pluginPath, "export const anotherPlugin = 1;\n", "utf8");
      const missingExport = structured<ValidationResult>(
        await callWithoutWrites(client, {
          name: "timeline_user_validate_plugin",
          arguments: { filePath: pluginRelativePath, exportName },
        }),
      );
      assert.equal(missingExport.status, "failed");
      assert(
        missingExport.diagnostics.some(
          (diagnostic) =>
            diagnostic.severity === "error" && diagnostic.code === "plugin-export-missing",
        ),
      );

      await fs.writeFile(pluginPath, `export const ${exportName} = 42;\n`, "utf8");
      const incompatibleExport = structured<ValidationResult>(
        await callWithoutWrites(client, {
          name: "timeline_user_validate_plugin",
          arguments: { filePath: pluginRelativePath, exportName },
        }),
      );
      assert.equal(incompatibleExport.status, "failed");
      assert(
        incompatibleExport.diagnostics.some(
          (diagnostic) =>
            diagnostic.severity === "error" && diagnostic.code === "invalid-plugin-export",
        ),
      );

      const outsideRoot = await callWithoutWrites(client, {
        name: "timeline_user_validate_plugin",
        arguments: { filePath: "../outside.ts", exportName },
      });
      assert.equal(outsideRoot.isError, true);

      const recoveredPlugin = structured<GenerateResult>(
        await callWithoutWrites(client, {
          name: "timeline_user_generate_plugin",
          arguments: { template: "basic", exportName },
        }),
      );
      await applyFiles(recoveredPlugin.files);
      assertPassedValidation(
        structured<ValidationResult>(
          await callWithoutWrites(client, {
            name: "timeline_user_validate_plugin",
            arguments: { filePath: pluginRelativePath, exportName },
          }),
        ),
      );
    },
  );

  console.log("Source and packed user MCP protocol/package checks passed.");
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
