import { afterEach, describe, expect, it } from "vite-plus/test";
import { cp, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectProject, resolvePluginFile } from "../src/project.js";
import { validatePlugin } from "../src/validate-plugin.js";

const temporaryRoots: string[] = [];
const timelineRoot = fileURLToPath(new URL("../../timeline/", import.meta.url));
const validPlugin = `import { PluginType, type TimelinePlugin } from "timeline-canvas";
export function createPlugin(): TimelinePlugin {
  return {
    metadata: { name: "consumer", version: "1.0.0", description: "External plugin", type: PluginType.EXTENSION },
    activate() {},
    deactivate() {},
  };
}
`;

async function consumer(source = validPlugin, installTimeline = true): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "timeline-user-validation-"));
  temporaryRoots.push(root);
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src/plugin.ts"), source);
  if (installTimeline) {
    const installed = path.join(root, "node_modules/timeline-canvas");
    await mkdir(installed, { recursive: true });
    await cp(path.join(timelineRoot, "package.json"), path.join(installed, "package.json"));
    await cp(path.join(timelineRoot, "dist"), path.join(installed, "dist"), { recursive: true });
  }
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("consumer plugin validation", () => {
  it("validates a factory using public installed declarations without repository source", async () => {
    const root = await consumer();
    const result = await validatePlugin(root, {
      filePath: "src/plugin.ts",
      exportName: "createPlugin",
    });
    expect(result.status).toBe("passed");
    expect(result.project.compatibility).toBe("tested-version");
    expect(result.diagnostics).toEqual([]);
    expect(result.checks).toEqual({
      types: "passed",
      pluginContract: "passed",
      lifecycle: "review-required",
      runtime: "not-run",
    });
  });

  it("validates an exported object and never executes module code", async () => {
    const root = await consumer(
      validPlugin +
        "\nthrow new Error('This module must never execute');\nexport default createPlugin();\n",
    );
    expect(
      (await validatePlugin(root, { filePath: "src/plugin.ts", exportName: "default" })).status,
    ).toBe("passed");
  });

  it("checks the named export's actual contract even when its source has no type errors", async () => {
    const root = await consumer("export const createPlugin = () => ({ title: 'not a plugin' });\n");
    const result = await validatePlugin(root, {
      filePath: "src/plugin.ts",
      exportName: "createPlugin",
    });
    expect(result.checks.types).toBe("passed");
    expect(result.status).toBe("failed");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-plugin-export" }),
    );
  });

  it("does not accept any as proof of a valid plugin contract", async () => {
    const root = await consumer("export const createPlugin: any = {};\n");
    const result = await validatePlugin(root, {
      filePath: "src/plugin.ts",
      exportName: "createPlugin",
    });
    expect(result.status).toBe("failed");
    expect(result.checks.pluginContract).toBe("failed");
  });

  it("reports missing exports and fresh diagnostics after a file changes", async () => {
    const root = await consumer();
    const missing = await validatePlugin(root, {
      filePath: "src/plugin.ts",
      exportName: "missing",
    });
    expect(missing.diagnostics).toContainEqual(
      expect.objectContaining({ code: "plugin-export-missing" }),
    );
    const result = await validatePlugin(root, {
      filePath: "src/plugin.ts",
      exportName: "createPlugin",
    });
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("passed");
    await writeFile(
      path.join(root, "src/plugin.ts"),
      validPlugin + "\nconst duration: number = 'incorrect';\n",
    );
    const changed = await validatePlugin(root, {
      filePath: "src/plugin.ts",
      exportName: "createPlugin",
    });
    expect(changed.checks.types).toBe("failed");
    expect(changed.diagnostics).toContainEqual(
      expect.objectContaining({ code: "TS2322", file: "src/plugin.ts" }),
    );
  });

  it("reports an uninstalled package as blocked, with no checks marked passed", async () => {
    const root = await consumer(validPlugin, false);
    const result = await validatePlugin(root, {
      filePath: "src/plugin.ts",
      exportName: "createPlugin",
    });
    expect(result.status).toBe("blocked");
    expect(result.project.compatibility).toBe("not-installed");
    expect(result.checks.types).toBe("not-run");
    expect(result.checks.pluginContract).toBe("not-run");
  });

  it("honors consumer compiler options even when the plugin is outside include globs", async () => {
    const root = await consumer();
    await writeFile(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { target: "ES2022", module: "NodeNext", composite: true },
        include: ["application/**/*.ts"],
      }),
    );
    const result = await validatePlugin(root, {
      filePath: "src/plugin.ts",
      exportName: "createPlugin",
    });
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("passed");
  });

  it("marks missing unregister calls as review hints without claiming runtime validation", async () => {
    const root = await consumer(
      validPlugin.replace(
        "activate() {}",
        `activate(context) {
      context.api.registerRenderLayer({ name: "test", position: "overlay", render() {} });
    }`,
      ),
    );
    const result = await validatePlugin(root, {
      filePath: "src/plugin.ts",
      exportName: "createPlugin",
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "cleanup-review" }),
    );
    expect(result.checks.lifecycle).toBe("review-required");
    expect(result.checks.runtime).toBe("not-run");
  });

  it("does not infer package API support solely from its installed version", async () => {
    const root = await consumer();
    await writeFile(
      path.join(root, "node_modules/timeline-canvas/package.json"),
      JSON.stringify({
        name: "timeline-canvas",
        version: "99.0.0",
        type: "module",
        types: "./dist/index.d.mts",
      }),
    );
    expect(inspectProject(root).info).toMatchObject({
      installedVersion: "99.0.0",
      compatibility: "unverified-version",
    });
  });

  it("rejects traversal and escaping symlinks, while accepting ordinary dot-prefixed directories", async () => {
    const root = await consumer();
    const outside = await consumer();
    await expect(resolvePluginFile(root, "../outside.ts")).rejects.toThrow(
      "inside MCP_WORKSPACE_ROOT",
    );
    await symlink(path.join(outside, "src/plugin.ts"), path.join(root, "src/link.ts"));
    await expect(resolvePluginFile(root, "src/link.ts")).rejects.toThrow(
      "outside MCP_WORKSPACE_ROOT",
    );
    await mkdir(path.join(root, "..plugins"));
    await writeFile(path.join(root, "..plugins/plugin.ts"), validPlugin);
    expect(await resolvePluginFile(root, "..plugins/plugin.ts")).toBe(
      await realpath(path.join(root, "..plugins/plugin.ts")),
    );
  });
});
