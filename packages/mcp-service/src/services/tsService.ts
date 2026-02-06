/**
 * TypeScript Language Service wrapper for semantic analysis tools.
 *
 * Provides cached access to the TypeScript program, type checker,
 * and common semantic queries (find references, get type info, etc.).
 *
 * Uses the workspace's own TypeScript installation (peerDependency).
 */

import * as path from "node:path";
import { workspaceRoot } from "../workspace.js";

// Dynamically resolve TypeScript from the workspace
function loadTypeScript(): typeof import("typescript") {
  // Try workspace node_modules first, then fallback to require
  const candidates = [
    path.join(workspaceRoot, "node_modules", "typescript"),
    path.join(
      workspaceRoot,
      "packages",
      "timeline",
      "node_modules",
      "typescript"
    ),
    "typescript",
  ];
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(candidate);
    } catch {
      // try next
    }
  }
  throw new Error(
    "TypeScript not found. Ensure typescript is installed in the workspace."
  );
}

export interface DefinitionInfo {
  file: string; // relative to workspace
  line: number;
  character: number;
  text: string; // the source line
}

export interface ReferenceInfo {
  file: string;
  line: number;
  character: number;
  text: string;
  isDefinition: boolean;
  isTypeOnly: boolean;
}

export interface TypeMemberInfo {
  name: string;
  typeText: string;
  optional: boolean;
}

export interface TypeInfo {
  name: string;
  file: string;
  line: number;
  kind: string; // 'interface' | 'type' | 'class' | 'enum'
  members: TypeMemberInfo[];
  fullText: string;
}

export class TsService {
  private ts: typeof import("typescript") | null = null;
  private program: import("typescript").Program | null = null;
  private checker: import("typescript").TypeChecker | null = null;
  private languageService: import("typescript").LanguageService | null = null;
  private sourceFiles: Map<string, import("typescript").SourceFile> = new Map();
  private lastBuildTime = 0;
  private tsconfigPath: string;

  constructor() {
    this.tsconfigPath = path.join(
      workspaceRoot,
      "packages",
      "timeline",
      "tsconfig.json"
    );
  }

  private getTs(): typeof import("typescript") {
    if (!this.ts) {
      this.ts = loadTypeScript();
    }
    return this.ts;
  }

  /**
   * Lazily initializes the TypeScript program. Caches until source files change.
   */
  ensureProgram(): import("typescript").Program {
    const ts = this.getTs();
    const now = Date.now();

    // Rebuild if stale (>30s since last build) or never built
    if (this.program && now - this.lastBuildTime < 30_000) {
      return this.program;
    }

    const configFile = ts.readConfigFile(this.tsconfigPath, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(
        `Failed to read tsconfig: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}`
      );
    }

    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(this.tsconfigPath)
    );

    this.program = ts.createProgram({
      rootNames: parsed.fileNames,
      options: parsed.options,
    });
    this.checker = this.program.getTypeChecker();
    this.sourceFiles.clear();

    for (const sf of this.program.getSourceFiles()) {
      if (!sf.isDeclarationFile) {
        const rel = path.relative(workspaceRoot, sf.fileName).replace(/\\/g, "/");
        this.sourceFiles.set(rel, sf);
      }
    }

    this.lastBuildTime = now;
    return this.program;
  }

  getChecker(): import("typescript").TypeChecker {
    this.ensureProgram();
    return this.checker!;
  }

  getSourceFiles(): Map<string, import("typescript").SourceFile> {
    this.ensureProgram();
    return this.sourceFiles;
  }

  /**
   * Find all definitions of a symbol by name.
   */
  findDefinitions(symbolName: string): DefinitionInfo[] {
    const ts = this.getTs();
    this.ensureProgram();
    const results: DefinitionInfo[] = [];

    for (const [rel, sf] of this.sourceFiles) {
      ts.forEachChild(sf, function visit(node) {
        if (ts.isIdentifier(node) && node.text === symbolName) {
          const parent = node.parent;
          const isDefinition =
            ts.isClassDeclaration(parent) ||
            ts.isInterfaceDeclaration(parent) ||
            ts.isTypeAliasDeclaration(parent) ||
            ts.isEnumDeclaration(parent) ||
            ts.isFunctionDeclaration(parent) ||
            ts.isVariableDeclaration(parent) ||
            ts.isPropertyDeclaration(parent) ||
            ts.isPropertySignature(parent) ||
            ts.isMethodDeclaration(parent);

          if (isDefinition) {
            const { line, character } =
              sf.getLineAndCharacterOfPosition(node.getStart());
            const lineText = sf
              .getFullText()
              .split(/\r?\n/)
              [line]?.trim() ?? "";
            results.push({
              file: rel,
              line: line + 1,
              character,
              text: lineText,
            });
          }
        }
        ts.forEachChild(node, visit);
      });
    }
    return results;
  }

  /**
   * Find all references (usages) of a symbol by name.
   */
  findReferences(symbolName: string): ReferenceInfo[] {
    const ts = this.getTs();
    this.ensureProgram();
    const results: ReferenceInfo[] = [];

    for (const [rel, sf] of this.sourceFiles) {
      const fullText = sf.getFullText();
      const lines = fullText.split(/\r?\n/);

      ts.forEachChild(sf, function visit(node) {
        if (ts.isIdentifier(node) && node.text === symbolName) {
          const { line, character } =
            sf.getLineAndCharacterOfPosition(node.getStart());
          const lineText = lines[line]?.trim() ?? "";

          const parent = node.parent;
          const isDefinition =
            ts.isClassDeclaration(parent) ||
            ts.isInterfaceDeclaration(parent) ||
            ts.isTypeAliasDeclaration(parent) ||
            ts.isEnumDeclaration(parent) ||
            ts.isFunctionDeclaration(parent) ||
            ts.isVariableDeclaration(parent);

          // Check if inside a type-only import
          let isTypeOnly = false;
          let ancestor: import("typescript").Node = node;
          while (ancestor.parent) {
            if (ts.isImportDeclaration(ancestor.parent)) {
              const importClause = ancestor.parent.importClause;
              if (importClause?.isTypeOnly) isTypeOnly = true;
              break;
            }
            if (ts.isTypeReferenceNode(ancestor.parent)) {
              isTypeOnly = true;
              break;
            }
            ancestor = ancestor.parent;
          }

          results.push({
            file: rel,
            line: line + 1,
            character,
            text: lineText,
            isDefinition,
            isTypeOnly,
          });
        }
        ts.forEachChild(node, visit);
      });
    }
    return results;
  }

  /**
   * Get detailed type information for an interface/type/class/enum.
   */
  getTypeInfo(typeName: string): TypeInfo | null {
    const ts = this.getTs();
    this.ensureProgram();
    const checker = this.checker!;

    for (const [rel, sf] of this.sourceFiles) {
      const lines = sf.getFullText().split(/\r?\n/);

      let found: TypeInfo | null = null;
      ts.forEachChild(sf, (node) => {
        if (found) return;

        let name: string | undefined;
        let kind: string | undefined;

        if (ts.isInterfaceDeclaration(node) && node.name.text === typeName) {
          name = node.name.text;
          kind = "interface";
        } else if (
          ts.isTypeAliasDeclaration(node) &&
          node.name.text === typeName
        ) {
          name = node.name.text;
          kind = "type";
        } else if (
          ts.isClassDeclaration(node) &&
          node.name?.text === typeName
        ) {
          name = node.name.text;
          kind = "class";
        } else if (
          ts.isEnumDeclaration(node) &&
          node.name.text === typeName
        ) {
          name = node.name.text;
          kind = "enum";
        }

        if (!name || !kind) return;

        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        const endLine =
          sf.getLineAndCharacterOfPosition(node.getEnd()).line;
        const fullText = lines.slice(line, endLine + 1).join("\n");

        const members: TypeMemberInfo[] = [];
        const type = checker.getTypeAtLocation(node);
        for (const prop of type.getProperties()) {
          const decl = prop.valueDeclaration ?? prop.declarations?.[0];
          const propType = decl
            ? checker.getTypeOfSymbolAtLocation(prop, decl)
            : undefined;
          members.push({
            name: prop.name,
            typeText: propType
              ? checker.typeToString(propType)
              : "unknown",
            optional: !!(prop.flags & ts.SymbolFlags.Optional),
          });
        }

        found = {
          name,
          file: rel,
          line: line + 1,
          kind,
          members,
          fullText,
        };
      });

      if (found) return found;
    }
    return null;
  }

  /**
   * Find usages of a specific member of a type (read/write).
   */
  findMemberUsages(
    memberName: string
  ): Array<{ file: string; line: number; text: string; kind: "read" | "write" }> {
    const ts = this.getTs();
    this.ensureProgram();
    const results: Array<{
      file: string;
      line: number;
      text: string;
      kind: "read" | "write";
    }> = [];

    for (const [rel, sf] of this.sourceFiles) {
      const lines = sf.getFullText().split(/\r?\n/);

      ts.forEachChild(sf, function visit(node) {
        if (
          ts.isPropertyAccessExpression(node) &&
          node.name.text === memberName
        ) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
          const lineText = lines[line]?.trim() ?? "";

          // Determine read vs write
          const parent = node.parent;
          const isWrite =
            ts.isBinaryExpression(parent) &&
            parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            parent.left === node;

          results.push({
            file: rel,
            line: line + 1,
            text: lineText,
            kind: isWrite ? "write" : "read",
          });
        }
        ts.forEachChild(node, visit);
      });
    }
    return results;
  }

  /**
   * Get import graph: for each source file, list its imports.
   */
  getImportGraph(): Map<
    string,
    Array<{
      from: string;
      symbols: string[];
      isTypeOnly: boolean;
    }>
  > {
    const ts = this.getTs();
    this.ensureProgram();
    const graph = new Map<
      string,
      Array<{ from: string; symbols: string[]; isTypeOnly: boolean }>
    >();

    for (const [rel, sf] of this.sourceFiles) {
      const imports: Array<{
        from: string;
        symbols: string[];
        isTypeOnly: boolean;
      }> = [];

      ts.forEachChild(sf, (node) => {
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const from = node.moduleSpecifier.text;
          const isTypeOnly = !!node.importClause?.isTypeOnly;
          const symbols: string[] = [];

          const clause = node.importClause;
          if (clause) {
            if (clause.name) symbols.push(clause.name.text);
            const bindings = clause.namedBindings;
            if (bindings && ts.isNamedImports(bindings)) {
              for (const el of bindings.elements) {
                symbols.push(el.name.text);
              }
            }
          }

          imports.push({ from, symbols, isTypeOnly });
        }
      });

      if (imports.length > 0) {
        graph.set(rel, imports);
      }
    }

    return graph;
  }

  /**
   * Run typecheck and return diagnostics.
   */
  typecheck(): string[] {
    const ts = this.getTs();
    const program = this.ensureProgram();
    const diagnostics = ts.getPreEmitDiagnostics(program);
    return diagnostics.map((d) => {
      const file = d.file
        ? path.relative(workspaceRoot, d.file.fileName).replace(/\\/g, "/")
        : "<unknown>";
      const line = d.file && d.start !== undefined
        ? d.file.getLineAndCharacterOfPosition(d.start).line + 1
        : 0;
      const msg = ts.flattenDiagnosticMessageText(d.messageText, " ");
      return `${file}:${line}: ${msg}`;
    });
  }

  /**
   * Force rebuild on next access.
   */
  invalidate(): void {
    this.program = null;
    this.checker = null;
    this.languageService = null;
    this.sourceFiles.clear();
    this.lastBuildTime = 0;
  }

  // ─── LanguageService-based APIs ───

  /**
   * Creates or returns a cached TypeScript LanguageService for precise
   * rename/reference operations.
   */
  private ensureLanguageService(): import("typescript").LanguageService {
    if (this.languageService) return this.languageService;

    const ts = this.getTs();
    const configFile = ts.readConfigFile(this.tsconfigPath, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(
        `Failed to read tsconfig: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}`
      );
    }
    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(this.tsconfigPath)
    );

    const fileVersions = new Map<string, string>();
    for (const f of parsed.fileNames) {
      fileVersions.set(f, "0");
    }

    const host: import("typescript").LanguageServiceHost = {
      getScriptFileNames: () => parsed.fileNames,
      getScriptVersion: (fileName) => fileVersions.get(fileName) ?? "0",
      getScriptSnapshot: (fileName) => {
        const content = ts.sys.readFile(fileName);
        if (content === undefined) return undefined;
        return ts.ScriptSnapshot.fromString(content);
      },
      getCurrentDirectory: () => path.dirname(this.tsconfigPath),
      getCompilationSettings: () => parsed.options,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
    };

    this.languageService = ts.createLanguageService(
      host,
      ts.createDocumentRegistry()
    );
    return this.languageService;
  }

  /**
   * Find all rename locations for a symbol using the TS LanguageService.
   * Much more precise than text-based findReferences — respects scoping,
   * overloads, and symbol identity.
   */
  findRenameLocations(
    symbolName: string
  ): Array<{
    file: string;
    line: number;
    character: number;
    start: number;
    length: number;
    text: string;
  }> {
    this.getTs(); // ensure TS is loaded
    const ls = this.ensureLanguageService();
    const program = ls.getProgram();
    if (!program) throw new Error("LanguageService has no program");

    // Find definition position(s) to seed rename
    const defs = this.findDefinitions(symbolName);
    if (defs.length === 0) return [];

    const results: Array<{
      file: string;
      line: number;
      character: number;
      start: number;
      length: number;
      text: string;
    }> = [];
    const seen = new Set<string>();

    for (const def of defs) {
      const absPath = path.resolve(workspaceRoot, def.file);
      const sourceFile = program.getSourceFile(absPath);
      if (!sourceFile) continue;

      const pos = sourceFile.getPositionOfLineAndCharacter(
        def.line - 1,
        def.character
      );
      const locations = ls.findRenameLocations(absPath, pos, false, false);
      if (!locations) continue;

      for (const loc of locations) {
        const key = `${loc.fileName}:${loc.textSpan.start}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const sf = program.getSourceFile(loc.fileName);
        if (!sf || sf.isDeclarationFile) continue;

        const relFile = path
          .relative(workspaceRoot, loc.fileName)
          .replace(/\\/g, "/");
        const { line, character } = sf.getLineAndCharacterOfPosition(
          loc.textSpan.start
        );
        const lineText =
          sf.getFullText().split(/\r?\n/)[line]?.trim() ?? "";

        results.push({
          file: relFile,
          line: line + 1,
          character,
          start: loc.textSpan.start,
          length: loc.textSpan.length,
          text: lineText,
        });
      }
    }

    return results;
  }

  /**
   * Find all call-site locations for a function/method, including argument info.
   */
  findCallSites(
    symbolName: string
  ): Array<{
    file: string;
    line: number;
    text: string;
    args: Array<{ index: number; expression: string }>;
  }> {
    const ts = this.getTs();
    this.ensureProgram();
    const results: Array<{
      file: string;
      line: number;
      text: string;
      args: Array<{ index: number; expression: string }>;
    }> = [];

    for (const [rel, sf] of this.sourceFiles) {
      const fullText = sf.getFullText();
      const lines = fullText.split(/\r?\n/);

      ts.forEachChild(sf, function visit(node) {
        if (ts.isCallExpression(node)) {
          let calleeName: string | undefined;

          // Direct call: foo()
          if (ts.isIdentifier(node.expression)) {
            calleeName = node.expression.text;
          }
          // Method call: obj.foo()
          else if (
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.name)
          ) {
            calleeName = node.expression.name.text;
          }

          if (calleeName === symbolName) {
            const { line } = sf.getLineAndCharacterOfPosition(
              node.getStart()
            );
            const lineText = lines[line]?.trim() ?? "";
            const args = node.arguments.map((arg, i) => ({
              index: i,
              expression: arg.getText(sf).substring(0, 120), // cap length
            }));

            results.push({
              file: rel,
              line: line + 1,
              text: lineText,
              args,
            });
          }
        }
        ts.forEachChild(node, visit);
      });
    }

    return results;
  }

  /**
   * Get function/method signature: parameter names, types, return type.
   */
  getFunctionSignature(
    symbolName: string
  ): Array<{
    file: string;
    line: number;
    params: Array<{ name: string; type: string; optional: boolean }>;
    returnType: string;
  }> {
    const ts = this.getTs();
    this.ensureProgram();
    const checker = this.checker!;
    const results: Array<{
      file: string;
      line: number;
      params: Array<{ name: string; type: string; optional: boolean }>;
      returnType: string;
    }> = [];

    for (const [rel, sf] of this.sourceFiles) {
      ts.forEachChild(sf, function visit(node) {
        let name: string | undefined;
        let signatureNode:
          | import("typescript").FunctionDeclaration
          | import("typescript").MethodDeclaration
          | import("typescript").ArrowFunction
          | undefined;

        if (
          ts.isFunctionDeclaration(node) &&
          node.name?.text === symbolName
        ) {
          name = node.name.text;
          signatureNode = node;
        } else if (
          ts.isMethodDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === symbolName
        ) {
          name = node.name.text;
          signatureNode = node;
        } else if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === symbolName &&
          node.initializer &&
          ts.isArrowFunction(node.initializer)
        ) {
          name = node.name.text;
          signatureNode = node.initializer;
        }

        if (name && signatureNode) {
          const { line } = sf.getLineAndCharacterOfPosition(
            signatureNode.getStart()
          );
          const params = signatureNode.parameters.map((p) => {
            const pName = p.name.getText(sf);
            const pType = p.type
              ? checker.typeToString(checker.getTypeFromTypeNode(p.type))
              : checker.typeToString(
                  checker.getTypeAtLocation(p)
                );
            const optional = !!p.questionToken || !!p.initializer;
            return { name: pName, type: pType, optional };
          });

          const sig = checker.getSignatureFromDeclaration(signatureNode);
          const returnType = sig
            ? checker.typeToString(checker.getReturnTypeOfSignature(sig))
            : "unknown";

          results.push({ file: rel, line: line + 1, params, returnType });
        }

        ts.forEachChild(node, visit);
      });
    }

    return results;
  }
}

// Singleton instance
let instance: TsService | null = null;
export function getTsService(): TsService {
  if (!instance) instance = new TsService();
  return instance;
}
