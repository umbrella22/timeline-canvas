import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import ts from "typescript";
import { afterAll, describe, expect, it } from "vite-plus/test";

import { generatePlugin } from "../src/generate-plugin.js";
import { getUsageGuide } from "../src/guides.js";

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "timeline-canvas-user-mcp-content-"));
const packageRoot = path.resolve(import.meta.dirname, "..");

afterAll(async () => {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
});

async function expectProgramToCompile(
  source: string,
  fileName: string,
  scriptKind: ts.ScriptKind = ts.ScriptKind.TS,
): Promise<void> {
  const sourcePath = path.join(temporaryRoot, fileName);
  await fs.mkdir(path.dirname(sourcePath), { recursive: true });
  await fs.writeFile(sourcePath, source, "utf8");

  const compilerOptions: ts.CompilerOptions = {
    baseUrl: packageRoot,
    ignoreDeprecations: "6.0",
    jsx: ts.JsxEmit.ReactJSX,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    paths: {
      react: ["../../node_modules/@types/react/index.d.ts"],
      "react/jsx-runtime": ["../../node_modules/@types/react/jsx-runtime.d.ts"],
      "timeline-canvas": ["../timeline/dist/index.d.mts"],
      vue: ["../../node_modules/vue/dist/vue.d.ts"],
    },
    noUncheckedSideEffectImports: false,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
  };
  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (requestedName, languageVersion, onError, shouldCreate) => {
    if (requestedName === sourcePath) {
      return ts.createSourceFile(sourcePath, source, languageVersion, true, scriptKind);
    }
    return originalGetSourceFile(requestedName, languageVersion, onError, shouldCreate);
  };

  const program = ts.createProgram([sourcePath], compilerOptions, host);
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
  expect(errors).toEqual([]);
}

function executeGeneratedPlugin(source: string): Record<string, () => RuntimePlugin> {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} as Record<string, () => RuntimePlugin> };
  const load = (specifier: string): unknown => {
    if (specifier !== "timeline-canvas") {
      throw new Error(`Unexpected import: ${specifier}`);
    }
    return {
      PluginType: {
        EVENT_HANDLER: "event_handler",
        EXTENSION: "extension",
        RENDER: "render",
      },
    };
  };
  const run = new Function("require", "exports", "module", result.outputText);
  run(load, module.exports, module);
  return module.exports;
}

interface RuntimePlugin {
  metadata: { name: string; description: string; type: string };
  activate?: (context: RuntimeContext) => void;
  deactivate?: (context: RuntimeContext) => void;
}

interface RuntimeContext {
  config: { startTime: number };
  api: {
    registerRenderLayer: (layer: RuntimeRenderLayer) => void;
    unregisterRenderLayer: (name: string) => void;
    registerEventHandler: (event: string, handler: (payload: unknown) => boolean) => void;
    unregisterEventHandler: (event: string, handler: (payload: unknown) => boolean) => void;
  };
}

interface RuntimeRenderLayer {
  name: string;
  position: string;
  render: (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void;
}

function createRuntimeContext() {
  const renderLayers: RuntimeRenderLayer[] = [];
  const removedLayers: string[] = [];
  const eventHandlers: Array<{
    event: string;
    handler: (payload: unknown) => boolean;
  }> = [];
  const removedHandlers: Array<{
    event: string;
    handler: (payload: unknown) => boolean;
  }> = [];
  const context: RuntimeContext = {
    config: { startTime: 0 },
    api: {
      registerRenderLayer: (layer) => renderLayers.push(layer),
      unregisterRenderLayer: (name) => removedLayers.push(name),
      registerEventHandler: (event, handler) => eventHandlers.push({ event, handler }),
      unregisterEventHandler: (event, handler) => removedHandlers.push({ event, handler }),
    },
  };
  return {
    context,
    eventHandlers,
    removedHandlers,
    removedLayers,
    renderLayers,
  };
}

describe("getUsageGuide", () => {
  it("returns framework examples using the public package API and container resizing", async () => {
    for (const framework of ["vanilla", "react", "vue"] as const) {
      const guide = getUsageGuide({ framework });
      const source = guide.files.map((file) => file.content).join("\n");

      expect(guide.framework).toBe(framework);
      expect(guide.files.length).toBeGreaterThan(0);
      expect(source).toContain('from "timeline-canvas"');
      expect(source).toContain('import("timeline-canvas")');
      expect(source).toContain("LightThemePlugin");
      expect(source).toContain("loadData({");
      expect(source).toContain("tracks: [");
      expect(source).toContain('title: "Planning"');
      expect(source).toContain("secondWidth: 4");
      expect(source).toContain("autoFitOnInit: false");
      expect(source).toContain("destroy()");
      expect(source).toContain(".catch((error: unknown) =>");
      expect(source).toContain("new ResizeObserver");
      expect(source).toContain("adjustCanvasSize()");
      expect(source).toContain(".disconnect()");
      expect(source).toContain("Promise.resolve(");
      expect(source).not.toMatch(/timeline-canvas\/(src|dist|plugins|core)/);
      expect(guide.notes.join(" ")).toContain("ResizeObserver");
      expect(guide.notes.join(" ")).toContain("1.4.1");
    }

    const vanilla = getUsageGuide({ framework: "vanilla" });
    const vanillaMain = vanilla.files.find((file) => file.path === "src/main.ts");
    expect(vanillaMain).toBeDefined();
    await expectProgramToCompile(vanillaMain!.content, "guide/main.ts");
    expect(vanillaMain!.content).toContain("let disposed = false;");
    expect(vanillaMain!.content).toContain("if (disposed) return;");
    expect(vanillaMain!.content).toContain("disposed = true;");

    const react = getUsageGuide({ framework: "react" });
    const reactSource = react.files.find((file) => file.path.endsWith(".tsx"));
    expect(reactSource).toBeDefined();
    await expectProgramToCompile(
      reactSource!.content,
      "guide/TimelineExample.tsx",
      ts.ScriptKind.TSX,
    );
    expect(reactSource!.content).toContain("if (cancelled) return;");
    expect(reactSource!.content).toContain("if (cancelled) await timeline.destroy();");

    const vue = getUsageGuide({ framework: "vue" });
    const vueSource = vue.files.find((file) => file.path.endsWith(".vue"));
    const vueScript = vueSource?.content.match(
      /<script setup lang="ts">\n([\s\S]*?)<\/script>/,
    )?.[1];
    expect(vueScript).toBeDefined();
    await expectProgramToCompile(vueScript!, "guide/TimelineExample.vue.ts");
  });

  it("returns fresh file records on each call", () => {
    const first = getUsageGuide({ framework: "vanilla" });
    first.files[0].content = "changed";
    expect(getUsageGuide({ framework: "vanilla" }).files[0].content).not.toBe("changed");
  });
});

describe("generatePlugin", () => {
  it("generates every template against the installed public type surface", async () => {
    for (const template of ["basic", "render", "event-handler"] as const) {
      const result = generatePlugin({
        template,
        exportName: "createExamplePlugin",
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe("src/timeline-plugin.ts");
      expect(result.files[0].content).toContain(
        "export function createExamplePlugin(): TimelinePlugin",
      );
      expect(result.files[0].content).not.toMatch(/timeline-canvas\/(src|dist|plugins|core)/);
      expect(result.usage).toContain(
        'import { createExamplePlugin } from "./src/timeline-plugin";',
      );
      expect(result.usage).toContain("timeline.usePlugin(createExamplePlugin())");
      expect(result.notes.join(" ")).toContain("1.4.1");
      expect(result.notes.join(" ")).toContain("do not claim compatibility with every version");
      await expectProgramToCompile(result.files[0].content, `plugins/${template}.ts`);
    }
  });

  it("preserves encoded metadata strings through generated source", () => {
    const name = 'name "quoted" \\ slash\nnext ${value}';
    const description = 'line one\nline "two" \\ end */ ${value}\u2028done';

    for (const template of ["basic", "render", "event-handler"] as const) {
      const result = generatePlugin({
        template,
        exportName: "createEncodedPlugin",
        name,
        description,
      });
      const exports = executeGeneratedPlugin(result.files[0].content);
      const plugin = exports.createEncodedPlugin();

      expect(plugin.metadata.name).toBe(name);
      expect(plugin.metadata.description).toBe(description);
    }
  });

  it("accepts Unicode identifiers and rejects invalid or reserved names", async () => {
    const result = generatePlugin({
      template: "basic",
      exportName: "create\u65f6\u95f4\u7ebfPlugin",
    });
    expect(result.files[0].content).toContain("export function create\u65f6\u95f4\u7ebfPlugin()");
    await expectProgramToCompile(result.files[0].content, "plugins/unicode.ts");

    for (const exportName of [
      "class",
      "await",
      "let",
      "bad-name",
      "createPlugin() {} export function injected",
    ]) {
      expect(() => generatePlugin({ template: "basic", exportName })).toThrow(
        "exportName must be a valid",
      );
    }
  });

  it("keeps render resources isolated and restores canvas state on failure", () => {
    const source = generatePlugin({
      template: "render",
      exportName: "createRenderPlugin",
    }).files[0].content;
    const createPlugin = executeGeneratedPlugin(source).createRenderPlugin;
    const first = createRuntimeContext();
    const second = createRuntimeContext();
    const firstPlugin = createPlugin();
    const secondPlugin = createPlugin();

    firstPlugin.activate?.(first.context);
    secondPlugin.activate?.(second.context);
    firstPlugin.deactivate?.(first.context);

    expect(first.renderLayers).toHaveLength(1);
    expect(second.renderLayers).toHaveLength(1);
    expect(first.removedLayers).toEqual([first.renderLayers[0].name]);
    expect(second.removedLayers).toEqual([]);

    let restoreCalls = 0;
    const drawingContext = {
      save: () => undefined,
      restore: () => {
        restoreCalls += 1;
      },
      set strokeStyle(_value: string) {},
      set lineWidth(_value: number) {},
      strokeRect: () => {
        throw new Error("draw failed");
      },
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 640, height: 320 } as HTMLCanvasElement;

    expect(() => first.renderLayers[0].render(drawingContext, canvas)).toThrow("draw failed");
    expect(restoreCalls).toBe(1);
  });

  it("unregisters the same event handler without crossing factory instances", () => {
    const source = generatePlugin({
      template: "event-handler",
      exportName: "createMoveGuardPlugin",
    }).files[0].content;
    const createPlugin = executeGeneratedPlugin(source).createMoveGuardPlugin;
    const first = createRuntimeContext();
    const second = createRuntimeContext();
    const firstPlugin = createPlugin();
    const secondPlugin = createPlugin();

    firstPlugin.activate?.(first.context);
    secondPlugin.activate?.(second.context);
    firstPlugin.deactivate?.(first.context);

    expect(first.eventHandlers[0].event).toBe("validate:event:move");
    expect(first.removedHandlers[0]).toEqual(first.eventHandlers[0]);
    expect(second.removedHandlers).toEqual([]);
    expect(first.eventHandlers[0].handler({ newStartTime: -1, duration: 2 })).toBe(false);
    expect(first.eventHandlers[0].handler({ newStartTime: 1, duration: 2 })).toBe(true);

    secondPlugin.deactivate?.(second.context);
    expect(second.removedHandlers[0]).toEqual(second.eventHandlers[0]);
    expect(first.eventHandlers[0].handler).not.toBe(second.eventHandlers[0].handler);
  });
});
