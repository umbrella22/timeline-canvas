import path from "node:path";
import { realpath } from "node:fs/promises";
import ts from "typescript";
import { compilerDefaults, inspectProject, isWithinRoot, resolvePluginFile } from "./project.js";
import type { ProjectInfo } from "./project.js";

export interface PluginDiagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface ValidationResult {
  project: ProjectInfo;
  status: "passed" | "failed" | "blocked";
  exportName: string;
  diagnostics: PluginDiagnostic[];
  checks: {
    types: "passed" | "failed" | "not-run";
    pluginContract: "passed" | "failed" | "not-run";
    lifecycle: "review-required" | "not-run";
    runtime: "not-run";
  };
  notes: string[];
}

function diagnosticFromTs(diagnostic: ts.Diagnostic, root: string): PluginDiagnostic {
  const location =
    diagnostic.file && diagnostic.start !== undefined
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      : undefined;
  return {
    severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error" : "warning",
    code: `TS${diagnostic.code}`,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    ...(diagnostic.file ? { file: path.relative(root, diagnostic.file.fileName) } : {}),
    ...(location ? { line: location.line + 1, column: location.character + 1 } : {}),
  };
}

function getOptions(
  file: string,
  root: string,
): {
  options: ts.CompilerOptions;
  errors: ts.Diagnostic[];
} {
  const configPath = ts.findConfigFile(path.dirname(file), ts.sys.fileExists);
  if (!configPath || !isWithinRoot(root, configPath)) {
    return { options: compilerDefaults, errors: [] };
  }
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) return { options: compilerDefaults, errors: [config.error] };
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  return {
    options: {
      ...compilerDefaults,
      ...parsed.options,
      moduleResolution:
        parsed.options.moduleResolution ??
        (parsed.options.module === undefined ? compilerDefaults.moduleResolution : undefined),
      strict: true,
      noEmit: true,
      allowJs: true,
      checkJs: true,
      composite: false,
      incremental: false,
      declaration: false,
      declarationMap: false,
      emitDeclarationOnly: false,
      rootDir: undefined,
      outDir: undefined,
      tsBuildInfoFile: undefined,
    },
    // A plugin may be intentionally outside the application's include globs.
    errors: parsed.errors.filter((error) => error.code !== 18003),
  };
}

export async function validatePlugin(
  workspaceRoot: string,
  input: { filePath: string; exportName: string },
): Promise<ValidationResult> {
  const file = await resolvePluginFile(workspaceRoot, input.filePath);
  const root = await realpath(workspaceRoot);
  const project = inspectProject(root, file);
  const result: ValidationResult = {
    project: project.info,
    status: "blocked",
    exportName: input.exportName,
    diagnostics: [],
    checks: {
      types: "not-run",
      pluginContract: "not-run",
      lifecycle: "not-run",
      runtime: "not-run",
    },
    notes: [
      "Checks use the installed timeline-canvas declarations and TypeScript 6 with strict mode.",
      "Plugin code is not executed. Canvas output, interaction behavior, performance, and complete resource cleanup require runtime verification.",
    ],
  };
  if (!project.declarationFile) {
    result.diagnostics.push({
      severity: "error",
      code: "timeline-not-installed",
      message: "Install timeline-canvas in the consumer project before validating plugins.",
    });
    return result;
  }

  const { options, errors } = getOptions(file, root);
  // A fresh program makes consecutive checks observe edits and newly added imports.
  const program = ts.createProgram([file, project.declarationFile], options);
  result.diagnostics.push(
    ...[...errors, ...ts.getPreEmitDiagnostics(program)].map((d) => diagnosticFromTs(d, root)),
  );
  result.checks.types = result.diagnostics.some((d) => d.severity === "error")
    ? "failed"
    : "passed";
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  const declaration = program.getSourceFile(project.declarationFile);
  const publicModule = declaration && checker.getSymbolAtLocation(declaration);
  const sourceModule = source && checker.getSymbolAtLocation(source);
  const contractExport =
    publicModule &&
    checker.getExportsOfModule(publicModule).find((s) => s.name === "TimelinePlugin");
  const pluginExport =
    sourceModule &&
    checker.getExportsOfModule(sourceModule).find((s) => s.name === input.exportName);

  if (!contractExport) {
    result.diagnostics.push({
      severity: "error",
      code: "plugin-contract-unavailable",
      message: "The installed package does not export a TimelinePlugin type.",
    });
    return result;
  }
  result.checks.pluginContract = "failed";
  if (!source || !pluginExport) {
    result.diagnostics.push({
      severity: "error",
      code: "plugin-export-missing",
      message: `No export named ${JSON.stringify(input.exportName)} was found in the plugin module.`,
    });
  } else {
    const target =
      contractExport.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(contractExport)
        : contractExport;
    const contract = checker.getDeclaredTypeOfSymbol(target);
    const exportedType = checker.getTypeOfSymbolAtLocation(pluginExport, source);
    const signatures = exportedType.getCallSignatures();
    const candidates = signatures.length
      ? signatures.map((s) => checker.getReturnTypeOfSignature(s))
      : [exportedType];
    const valid = candidates.every(
      (candidate) =>
        !(candidate.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) &&
        checker.isTypeAssignableTo(candidate, contract),
    );
    if (valid) {
      result.checks.pluginContract = "passed";
    } else {
      result.diagnostics.push({
        severity: "error",
        code: "invalid-plugin-export",
        message:
          "The export must be a TimelinePlugin object or a factory returning TimelinePlugin. any, unknown, and never cannot establish this contract.",
      });
    }
  }

  if (source) {
    const methods = new Set<string>();
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const symbol = checker.getSymbolAtLocation(node.expression.name);
        if (
          symbol?.declarations?.some(
            (d) =>
              d.getSourceFile().fileName === project.declarationFile ||
              d
                .getSourceFile()
                .fileName.startsWith(path.dirname(project.declarationFile!) + path.sep),
          )
        ) {
          methods.add(node.expression.name.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    for (const suffix of ["RenderLayer", "CoreLayerHook", "EventHandler"]) {
      if (methods.has(`register${suffix}`) && !methods.has(`unregister${suffix}`)) {
        result.diagnostics.push({
          severity: "warning",
          code: "cleanup-review",
          file: path.relative(root, file),
          message: `register${suffix} is called but no unregister${suffix} call was found in this file. Review cleanup, including any cleanup delegated to other modules.`,
        });
      }
    }
    result.checks.lifecycle = "review-required";
  }
  result.status =
    result.checks.types === "passed" && result.checks.pluginContract === "passed"
      ? "passed"
      : "failed";
  return result;
}
