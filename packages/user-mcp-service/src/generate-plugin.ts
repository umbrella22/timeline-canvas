import ts from "typescript";

export type PluginTemplate = "basic" | "render" | "event-handler";

export interface GeneratePluginInput {
  template: PluginTemplate;
  exportName: string;
  name?: string;
  description?: string;
}

export interface GeneratedPlugin {
  files: Array<{ path: string; content: string }>;
  usage: string;
  notes: string[];
}

function validateExportName(exportName: string): void {
  const fileName = "plugin-export-name.ts";
  const sourceText = `export function ${exportName}(): void {}`;
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const compilerOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    noLib: true,
    noResolve: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
  };
  const defaultHost = ts.createCompilerHost(compilerOptions);
  const host: ts.CompilerHost = {
    ...defaultHost,
    fileExists: (requestedName) => requestedName === fileName,
    getSourceFile: (requestedName) => (requestedName === fileName ? sourceFile : undefined),
    readFile: (requestedName) => (requestedName === fileName ? sourceText : undefined),
    writeFile: () => undefined,
  };
  const program = ts.createProgram([fileName], compilerOptions, host);
  const declaration = sourceFile.statements[0];
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file === sourceFile);
  const hasExactFunctionName =
    sourceFile.statements.length === 1 &&
    ts.isFunctionDeclaration(declaration) &&
    declaration.name !== undefined &&
    declaration.name.getText(sourceFile) === exportName;

  if (!hasExactFunctionName || diagnostics.length > 0) {
    throw new Error("exportName must be a valid, non-reserved TypeScript function identifier");
  }
}

function encodeStringLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function createMetadata(
  template: PluginTemplate,
  exportName: string,
  name: string | undefined,
  description: string | undefined,
): { nameLiteral: string; descriptionLiteral: string; typeMember: string } {
  const defaultDescription = `Generated ${template} plugin for timeline-canvas.`;
  const typeMember =
    template === "render" ? "RENDER" : template === "event-handler" ? "EVENT_HANDLER" : "EXTENSION";

  return {
    nameLiteral: encodeStringLiteral(name ?? exportName),
    descriptionLiteral: encodeStringLiteral(description ?? defaultDescription),
    typeMember,
  };
}

function generateBasicSource(
  exportName: string,
  nameLiteral: string,
  descriptionLiteral: string,
  typeMember: string,
): string {
  return `import { PluginType, type TimelinePlugin } from "timeline-canvas";

export function ${exportName}(): TimelinePlugin {
  return {
    metadata: {
      name: ${nameLiteral},
      version: "1.0.0",
      description: ${descriptionLiteral},
      type: PluginType.${typeMember},
    },
  };
}
`;
}

function generateRenderSource(
  exportName: string,
  nameLiteral: string,
  descriptionLiteral: string,
  typeMember: string,
): string {
  return `import { PluginType, type TimelinePlugin } from "timeline-canvas";

export function ${exportName}(): TimelinePlugin {
  const layerName = ${nameLiteral} + ":frame";
  let registered = false;

  return {
    metadata: {
      name: ${nameLiteral},
      version: "1.0.0",
      description: ${descriptionLiteral},
      type: PluginType.${typeMember},
    },
    activate(context) {
      if (registered) return;

      context.api.registerRenderLayer({
        name: layerName,
        position: "overlay",
        render(ctx, canvas) {
          ctx.save();
          try {
            ctx.strokeStyle = "rgba(37, 99, 235, 0.8)";
            ctx.lineWidth = 1;
            ctx.strokeRect(0.5, 0.5, Math.max(0, canvas.width - 1), Math.max(0, canvas.height - 1));
          } finally {
            ctx.restore();
          }
        },
      });
      registered = true;
    },
    deactivate(context) {
      if (!registered) return;
      context.api.unregisterRenderLayer(layerName);
      registered = false;
    },
  };
}
`;
}

function generateEventHandlerSource(
  exportName: string,
  nameLiteral: string,
  descriptionLiteral: string,
  typeMember: string,
): string {
  return `import { PluginType, type TimelinePlugin } from "timeline-canvas";

export function ${exportName}(): TimelinePlugin {
  let moveHandler: ((payload: unknown) => boolean) | undefined;

  return {
    metadata: {
      name: ${nameLiteral},
      version: "1.0.0",
      description: ${descriptionLiteral},
      type: PluginType.${typeMember},
    },
    activate(context) {
      if (moveHandler) return;

      const handler = (payload: unknown): boolean => {
        if (!payload || typeof payload !== "object") return true;
        const move = payload as { newStartTime?: unknown; duration?: unknown };
        return (
          typeof move.newStartTime !== "number" ||
          typeof move.duration !== "number" ||
          (move.newStartTime >= context.config.startTime && move.duration > 0)
        );
      };

      context.api.registerEventHandler("validate:event:move", handler);
      moveHandler = handler;
    },
    deactivate(context) {
      if (!moveHandler) return;
      context.api.unregisterEventHandler("validate:event:move", moveHandler);
      moveHandler = undefined;
    },
  };
}
`;
}

export function generatePlugin(input: GeneratePluginInput): GeneratedPlugin {
  validateExportName(input.exportName);
  if (
    input.template !== "basic" &&
    input.template !== "render" &&
    input.template !== "event-handler"
  ) {
    throw new Error(`Unsupported plugin template: ${String(input.template)}`);
  }

  const metadata = createMetadata(input.template, input.exportName, input.name, input.description);
  const sourceFactory =
    input.template === "render"
      ? generateRenderSource
      : input.template === "event-handler"
        ? generateEventHandlerSource
        : generateBasicSource;
  const content = sourceFactory(
    input.exportName,
    metadata.nameLiteral,
    metadata.descriptionLiteral,
    metadata.typeMember,
  );

  return {
    files: [{ path: "src/timeline-plugin.ts", content }],
    usage: `import { ${input.exportName} } from "./src/timeline-plugin";\n\nawait timeline.usePlugin(${input.exportName}());`,
    notes: [
      "The template uses only the public timeline-canvas 1.4.1 API.",
      "Static templates are tested against timeline-canvas 1.4.1, 1.5.0 and 1.6.0 and do not claim compatibility with every version.",
    ],
  };
}
