/**
 * ts-morph browser shim
 *
 * Implements the subset of ts-morph API used by runar-compiler's 01-parse.ts,
 * backed by the raw TypeScript compiler API (which runs in browsers).
 *
 * This file is aliased to 'ts-morph' via Vite's resolve.alias config so that
 * the runar-compiler package can be bundled for the browser without modification.
 */

import typescript from 'typescript';

// Re-export the TypeScript namespace as `ts` (ts-morph re-exports this)
export { typescript as ts };

// Re-export SyntaxKind directly (ts-morph re-exports this at top level)
export const SyntaxKind = typescript.SyntaxKind;

// ---------------------------------------------------------------------------
// NodeWrapper — wraps ts.Node with ts-morph-compatible API
// ---------------------------------------------------------------------------

export class Node {
  constructor(
    protected readonly _node: typescript.Node,
    protected readonly _sourceFile: typescript.SourceFile,
  ) {}

  /** Raw TypeScript compiler node (escape hatch) */
  get compilerNode(): typescript.Node {
    return this._node;
  }

  getKind(): typescript.SyntaxKind {
    return this._node.kind;
  }

  getKindName(): string {
    return typescript.SyntaxKind[this._node.kind] ?? `Unknown(${this._node.kind})`;
  }

  getText(): string {
    return this._node.getText(this._sourceFile);
  }

  getStart(): number {
    return this._node.getStart(this._sourceFile);
  }

  getEnd(): number {
    return this._node.getEnd();
  }

  getStartLineNumber(): number {
    const pos = this._node.getStart(this._sourceFile);
    const lineAndChar = this._sourceFile.getLineAndCharacterOfPosition(pos);
    return lineAndChar.line + 1; // ts-morph uses 1-based lines
  }

  getSourceFile(): SourceFile {
    return new SourceFile(this._sourceFile);
  }

  getChildren(): Node[] {
    return this._node.getChildren(this._sourceFile).map(c => wrap(c, this._sourceFile));
  }

  getChildrenOfKind(kind: typescript.SyntaxKind): Node[] {
    return this._node
      .getChildren(this._sourceFile)
      .filter(c => c.kind === kind)
      .map(c => wrap(c, this._sourceFile));
  }

  getFirstChildByKind(kind: typescript.SyntaxKind): Node | undefined {
    const child = this._node
      .getChildren(this._sourceFile)
      .find(c => c.kind === kind);
    return child ? wrap(child, this._sourceFile) : undefined;
  }

  getFirstChildByKindOrThrow(kind: typescript.SyntaxKind): Node {
    const result = this.getFirstChildByKind(kind);
    if (!result) {
      throw new Error(
        `Expected child of kind ${typescript.SyntaxKind[kind]} but none found`,
      );
    }
    return result;
  }

  isKind(kind: typescript.SyntaxKind): boolean {
    return this._node.kind === kind;
  }

  /**
   * ts-morph's asKindOrThrow returns a more specific wrapper type.
   * We just verify the kind and return `this` — the caller uses
   * the returned node's specific methods (which are all on Node).
   */
  asKindOrThrow(kind: typescript.SyntaxKind): Node {
    if (this._node.kind !== kind) {
      throw new Error(
        `Expected ${typescript.SyntaxKind[kind]} but got ${this.getKindName()}`,
      );
    }
    return this;
  }

  // --- Statement-level helpers ---

  /** For Block nodes: return the statements inside the block */
  getStatements(): Node[] {
    if (typescript.isBlock(this._node)) {
      return this._node.statements.map(s => wrap(s, this._sourceFile));
    }
    return [];
  }

  // --- Expression helpers (used by all expression nodes) ---

  getExpression(): Node {
    const n = this._node as Record<string, typescript.Node | undefined>;
    const expr = n['expression'];
    if (!expr) {
      throw new Error(`No expression on ${this.getKindName()}`);
    }
    return wrap(expr, this._sourceFile);
  }

  getName(): string {
    const n = this._node as Record<string, typescript.Node | undefined>;
    // ClassDeclaration, MethodDeclaration, PropertyDeclaration, etc.
    const name = n['name'];
    if (name) {
      return name.getText(this._sourceFile);
    }
    return '';
  }

  // --- PropertyDeclaration helpers ---

  isReadonly(): boolean {
    if (typescript.isPropertyDeclaration(this._node)) {
      return this._node.modifiers?.some(
        m => m.kind === typescript.SyntaxKind.ReadonlyKeyword,
      ) ?? false;
    }
    return false;
  }

  getTypeNode(): Node | undefined {
    const n = this._node as { type?: typescript.TypeNode };
    if (n.type) {
      return wrap(n.type, this._sourceFile);
    }
    return undefined;
  }

  getInitializer(): Node | undefined {
    const n = this._node as { initializer?: typescript.Expression };
    if (n.initializer) {
      return wrap(n.initializer, this._sourceFile);
    }
    return undefined;
  }

  // --- ClassDeclaration helpers ---

  getExtends(): Node | undefined {
    if (typescript.isClassDeclaration(this._node)) {
      const heritageClauses = this._node.heritageClauses;
      if (heritageClauses) {
        for (const clause of heritageClauses) {
          if (clause.token === typescript.SyntaxKind.ExtendsKeyword) {
            // Return the first ExpressionWithTypeArguments
            const firstType = clause.types[0];
            if (firstType) {
              return wrap(firstType, this._sourceFile);
            }
          }
        }
      }
    }
    return undefined;
  }

  getProperties(): Node[] {
    if (typescript.isClassDeclaration(this._node)) {
      return this._node.members
        .filter(typescript.isPropertyDeclaration)
        .map(m => wrap(m, this._sourceFile));
    }
    return [];
  }

  getMethods(): Node[] {
    if (typescript.isClassDeclaration(this._node)) {
      return this._node.members
        .filter(typescript.isMethodDeclaration)
        .map(m => wrap(m, this._sourceFile));
    }
    return [];
  }

  getConstructors(): Node[] {
    if (typescript.isClassDeclaration(this._node)) {
      return this._node.members
        .filter(typescript.isConstructorDeclaration)
        .map(m => wrap(m, this._sourceFile));
    }
    return [];
  }

  // --- MethodDeclaration/ConstructorDeclaration helpers ---

  hasModifier(kind: typescript.SyntaxKind): boolean {
    const n = this._node as { modifiers?: readonly typescript.ModifierLike[] };
    return n.modifiers?.some(m => m.kind === kind) ?? false;
  }

  getBody(): Node | undefined {
    const n = this._node as { body?: typescript.Node };
    if (n.body) {
      return wrap(n.body, this._sourceFile);
    }
    return undefined;
  }

  getParameters(): Node[] {
    const n = this._node as { parameters?: typescript.NodeArray<typescript.ParameterDeclaration> };
    if (n.parameters) {
      return Array.from(n.parameters).map(p => wrap(p, this._sourceFile));
    }
    return [];
  }

  // --- BinaryExpression helpers ---

  getLeft(): Node {
    const n = this._node as { left?: typescript.Node };
    if (!n.left) throw new Error('No left on node');
    return wrap(n.left, this._sourceFile);
  }

  getRight(): Node {
    const n = this._node as { right?: typescript.Node };
    if (!n.right) throw new Error('No right on node');
    return wrap(n.right, this._sourceFile);
  }

  getOperatorToken(): Node | typescript.SyntaxKind {
    const n = this._node as { operatorToken?: typescript.Node };
    if (n.operatorToken) {
      return wrap(n.operatorToken, this._sourceFile);
    }
    // For prefix/postfix unary: ts-morph returns the raw SyntaxKind number
    const unary = this._node as { operator?: typescript.SyntaxKind };
    if (unary.operator !== undefined) {
      return unary.operator;
    }
    throw new Error('No operator token on node');
  }

  // --- PrefixUnaryExpression / PostfixUnaryExpression ---

  getOperand(): Node {
    const n = this._node as { operand?: typescript.Node };
    if (!n.operand) throw new Error('No operand on node');
    return wrap(n.operand, this._sourceFile);
  }

  // --- CallExpression ---

  getArguments(): Node[] {
    if (typescript.isCallExpression(this._node)) {
      return this._node.arguments.map(a => wrap(a, this._sourceFile));
    }
    return [];
  }

  // --- ArrayLiteralExpression ---

  getElements(): Node[] {
    const n = this._node as { elements?: typescript.NodeArray<typescript.Node> };
    if (n.elements) {
      return Array.from(n.elements).map(e => wrap(e, this._sourceFile));
    }
    return [];
  }

  // --- ConditionalExpression (ternary) ---

  getCondition(): Node {
    const n = this._node as { condition?: typescript.Node };
    if (!n.condition) throw new Error('No condition on node');
    return wrap(n.condition, this._sourceFile);
  }

  getWhenTrue(): Node {
    const n = this._node as { whenTrue?: typescript.Node };
    if (!n.whenTrue) throw new Error('No whenTrue on node');
    return wrap(n.whenTrue, this._sourceFile);
  }

  getWhenFalse(): Node {
    const n = this._node as { whenFalse?: typescript.Node };
    if (!n.whenFalse) throw new Error('No whenFalse on node');
    return wrap(n.whenFalse, this._sourceFile);
  }

  // --- IfStatement ---

  getThenStatement(): Node {
    const n = this._node as { thenStatement?: typescript.Node };
    if (!n.thenStatement) throw new Error('No thenStatement');
    return wrap(n.thenStatement, this._sourceFile);
  }

  getElseStatement(): Node | undefined {
    const n = this._node as { elseStatement?: typescript.Node };
    if (n.elseStatement) {
      return wrap(n.elseStatement, this._sourceFile);
    }
    return undefined;
  }

  // --- ForStatement ---

  getIncrementor(): Node | undefined {
    const n = this._node as { incrementor?: typescript.Node };
    if (n.incrementor) {
      return wrap(n.incrementor, this._sourceFile);
    }
    return undefined;
  }

  getStatement(): Node {
    const n = this._node as { statement?: typescript.Node };
    if (!n.statement) throw new Error('No statement on node');
    return wrap(n.statement, this._sourceFile);
  }

  // --- VariableStatement ---

  getDeclarationList(): Node {
    const n = this._node as { declarationList?: typescript.Node };
    if (!n.declarationList) throw new Error('No declarationList');
    return wrap(n.declarationList, this._sourceFile);
  }

  getDeclarations(): Node[] {
    const n = this._node as { declarations?: typescript.NodeArray<typescript.Node> };
    if (n.declarations) {
      return Array.from(n.declarations).map(d => wrap(d, this._sourceFile));
    }
    return [];
  }

  getFlags(): typescript.NodeFlags {
    return this._node.flags;
  }

  // --- ElementAccessExpression ---

  getArgumentExpression(): Node | undefined {
    const n = this._node as { argumentExpression?: typescript.Node };
    if (n.argumentExpression) {
      return wrap(n.argumentExpression, this._sourceFile);
    }
    return undefined;
  }

  // --- TypeReference ---

  getTypeName(): Node {
    const n = this._node as { typeName?: typescript.Node };
    if (!n.typeName) throw new Error('No typeName on node');
    return wrap(n.typeName, this._sourceFile);
  }

  getTypeArguments(): Node[] {
    const n = this._node as { typeArguments?: typescript.NodeArray<typescript.Node> };
    if (n.typeArguments) {
      return Array.from(n.typeArguments).map(t => wrap(t, this._sourceFile));
    }
    return [];
  }

  // --- ReturnStatement ---

  // getExpression() already handles this (ReturnStatement.expression)
}

/**
 * Special wrapper for prefix/postfix unary operator tokens.
 * In ts-morph, getOperatorToken() returns a node, but in the raw TS API,
 * PrefixUnaryExpression and PostfixUnaryExpression store the operator
 * as a SyntaxKind number, not a node. This wrapper bridges the gap.
 */
class OperatorKindNode extends Node {
  private readonly _kind: typescript.SyntaxKind;

  constructor(kind: typescript.SyntaxKind, sourceFile: typescript.SourceFile) {
    // Create a dummy node — we only use getKind() and getText()
    super(sourceFile, sourceFile);
    this._kind = kind;
  }

  override getKind(): typescript.SyntaxKind {
    return this._kind;
  }

  override getText(): string {
    return typescript.SyntaxKind[this._kind] ?? String(this._kind);
  }
}

// ---------------------------------------------------------------------------
// SourceFile wrapper
// ---------------------------------------------------------------------------

export class SourceFile extends Node {
  constructor(private readonly _sf: typescript.SourceFile) {
    super(_sf, _sf);
  }

  override getSourceFile(): SourceFile {
    return this;
  }

  getClasses(): Node[] {
    const result: Node[] = [];
    typescript.forEachChild(this._sf, (node) => {
      if (typescript.isClassDeclaration(node)) {
        result.push(wrap(node, this._sf));
      }
    });
    return result;
  }

  getLineAndColumnAtPos(pos: number): { line: number; column: number } {
    const lineAndChar = this._sf.getLineAndCharacterOfPosition(pos);
    return {
      line: lineAndChar.line + 1,       // 1-based
      column: lineAndChar.character + 1, // 1-based (ts-morph convention)
    };
  }
}

// ---------------------------------------------------------------------------
// Project — creates in-memory source files
// ---------------------------------------------------------------------------

export class Project {
  private readonly _compilerOptions: typescript.CompilerOptions;

  constructor(opts?: {
    useInMemoryFileSystem?: boolean;
    compilerOptions?: typescript.CompilerOptions;
  }) {
    this._compilerOptions = opts?.compilerOptions ?? {};
  }

  createSourceFile(fileName: string, sourceText: string): SourceFile {
    const sf = typescript.createSourceFile(
      fileName,
      sourceText,
      this._compilerOptions.target ?? typescript.ScriptTarget.ES2022,
      /* setParentNodes */ true,
      typescript.ScriptKind.TS,
    );
    return new SourceFile(sf);
  }
}

// ---------------------------------------------------------------------------
// Helper: wrap a raw ts.Node into our Node wrapper
// ---------------------------------------------------------------------------

function wrap(node: typescript.Node, sourceFile: typescript.SourceFile): Node {
  if (typescript.isSourceFile(node)) {
    return new SourceFile(node);
  }
  return new Node(node, sourceFile);
}

// ---------------------------------------------------------------------------
// Type re-exports (ts-morph exports these as types)
// ---------------------------------------------------------------------------

// These are type-only exports used in the parser's type annotations.
// Since our Node class handles all methods, these are just type aliases.
export type ClassDeclaration = Node;
export type MethodDeclaration = Node;
export type ConstructorDeclaration = Node;
export type ParameterDeclaration = Node;
