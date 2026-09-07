import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import ts from "typescript";
import { afterAll, beforeEach, describe, expect, it } from "vite-plus/test";

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "timeline-canvas-mcp-scaffold-"));
const previousWorkspaceRoot = process.env.MCP_WORKSPACE_ROOT;
process.env.MCP_WORKSPACE_ROOT = temporaryRoot;

const { scaffoldPlugin } = await import("../src/tools/scaffold.js");

const indexRelativePath = "packages/timeline/src/index.ts";
const indexPath = path.join(temporaryRoot, indexRelativePath);
const initialIndex = 'export { Timeline } from "./core/Timeline";\n';

async function resetWorkspace(): Promise<void> {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
  await Promise.all([
    fs.mkdir(path.join(temporaryRoot, "packages/timeline/src/plugins/builtin"), {
      recursive: true,
    }),
    fs.mkdir(path.join(temporaryRoot, "packages/timeline/src/builtin-plugin"), {
      recursive: true,
    }),
    fs.mkdir(path.join(temporaryRoot, "packages/timeline/tests"), {
      recursive: true,
    }),
  ]);
  await fs.writeFile(indexPath, initialIndex, "utf8");
}

function generatedPath(relativePath: string): string {
  return path.join(temporaryRoot, relativePath);
}

function expectValidTypeScript(source: string, fileName: string): void {
  const result = ts.transpileModule(source, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const errors = result.diagnostics?.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  expect(errors).toEqual([]);
}

beforeEach(resetWorkspace);

afterAll(async () => {
  if (previousWorkspaceRoot === undefined) {
    delete process.env.MCP_WORKSPACE_ROOT;
  } else {
    process.env.MCP_WORKSPACE_ROOT = previousWorkspaceRoot;
  }
  await fs.rm(temporaryRoot, { recursive: true, force: true });
});

describe("scaffoldPlugin", () => {
  it("preserves an existing generated test and creates nothing", async () => {
    const testPath = generatedPath("packages/timeline/tests/ExistingTest.spec.ts");
    const marker = "// existing test must survive\n";
    await fs.writeFile(testPath, marker, "utf8");

    await expect(
      scaffoldPlugin({
        exportName: "ExistingTest",
        pluginType: "render",
        withTest: true,
      }),
    ).rejects.toThrow("Already exists: packages/timeline/tests/ExistingTest.spec.ts");

    await expect(fs.readFile(testPath, "utf8")).resolves.toBe(marker);
    await expect(
      fs.stat(generatedPath("packages/timeline/src/plugins/builtin/ExistingTest.ts")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.readFile(indexPath, "utf8")).resolves.toBe(initialIndex);
  });

  it("rolls back files when a later exclusive create fails", async () => {
    const reexportDirectory = generatedPath("packages/timeline/src/builtin-plugin");
    await fs.rm(reexportDirectory, { recursive: true });
    await fs.writeFile(reexportDirectory, "blocks directory creation", "utf8");

    await expect(
      scaffoldPlugin({
        exportName: "RollbackPlugin",
        pluginType: "extension",
        withTest: true,
      }),
    ).rejects.toThrow();

    for (const relativePath of [
      "packages/timeline/src/plugins/builtin/RollbackPlugin.ts",
      "packages/timeline/tests/RollbackPlugin.spec.ts",
    ]) {
      await expect(fs.stat(generatedPath(relativePath))).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
    await expect(fs.readFile(indexPath, "utf8")).resolves.toBe(initialIndex);
  });

  it("preserves both index exports from concurrent scaffold calls", async () => {
    await Promise.all([
      scaffoldPlugin({ exportName: "ConcurrentOne", pluginType: "extension" }),
      scaffoldPlugin({ exportName: "ConcurrentTwo", pluginType: "extension" }),
    ]);

    const indexText = await fs.readFile(indexPath, "utf8");
    expect(indexText).toContain('export { ConcurrentOne } from "./plugins/builtin/ConcurrentOne";');
    expect(indexText).toContain('export { ConcurrentTwo } from "./plugins/builtin/ConcurrentTwo";');
  });

  it("generates specialized templates with encoded user strings", async () => {
    const metadataName = 'name "quoted" \\ slash\nnext ${value}';
    const description = 'line one\nline "two" \\ end */ ${value}\u2028done';
    const version = '1.0.0-"custom"\\next';
    const cases = [
      { exportName: "BasicPlugin", pluginType: "extension" as const },
      { exportName: "RenderPlugin", pluginType: "render" as const },
      {
        exportName: "MediaPlugin",
        pluginType: "render" as const,
        features: ["media" as const],
      },
      { exportName: "ThemePlugin", pluginType: "theme" as const },
    ];

    for (const input of cases) {
      const output = await scaffoldPlugin({
        ...input,
        metadataName,
        description,
        version,
        withTest: true,
      });
      const implementationPath = generatedPath(
        `packages/timeline/src/plugins/builtin/${input.exportName}.ts`,
      );
      const testPath = generatedPath(`packages/timeline/tests/${input.exportName}.spec.ts`);
      const [implementation, test] = await Promise.all([
        fs.readFile(implementationPath, "utf8"),
        fs.readFile(testPath, "utf8"),
      ]);

      expect(output).toContain(`packages/timeline/tests/${input.exportName}.spec.ts`);
      expect(output).toContain("pnpm --filter timeline-canvas typecheck");
      expect(implementation).toContain(`name: ${JSON.stringify(metadataName)}`);
      expect(implementation).toContain(`description: ${JSON.stringify(description)}`);
      expect(implementation).not.toContain("{{");
      expect(test).toContain(
        `import { ${input.exportName} } from "../src/plugins/builtin/${input.exportName}";`,
      );
      expect(test).not.toContain("expect(true)");
      expectValidTypeScript(implementation, implementationPath);
      expectValidTypeScript(test, testPath);
    }

    await expect(
      fs.stat(generatedPath("packages/timeline/tests/MediaPlugin.test.ts")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.readFile(indexPath, "utf8")).resolves.toContain(
      'export { MediaPlugin } from "./plugins/builtin/MediaPlugin";',
    );
  });
});
