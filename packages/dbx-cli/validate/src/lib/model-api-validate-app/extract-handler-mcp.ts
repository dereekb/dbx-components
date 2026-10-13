/**
 * Follows a verb-map handler reference from `crud.functions.ts` back to its `withApiDetails({ ... })` declaration under
 * `<apiDir>/src/app/function/` and reads the `mcp.readOnly` it declares, for the `HANDLER_MCP_READ_ONLY_UNSET` check.
 *
 * The walk never guesses: anything it can't follow to a literal `withApiDetails({ ... })` (an `@dereekb/*` import, a
 * file outside the scan, a factory-built or inline handler, a spread or non-literal config) reads as `unresolved`, so
 * it is listed as not checked instead of being flagged. Only `const` declarations are followed, through local aliases,
 * relative imports and re-exports, up to {@link MAX_HANDLER_HOPS} hops.
 */

import { Node, SyntaxKind, VariableDeclarationKind, type ExportDeclaration, type FunctionDeclaration, type ImportClause, type ImportSpecifier, type ObjectLiteralExpression, type SourceFile, type VariableDeclaration } from 'ts-morph';
import {
  apiRelPath,
  isDereekbModuleSpecifier,
  readCalleeName,
  readDereekbImportBindings,
  readOwnExportedDeclarations,
  readStaticProperty,
  resolveLocalObjectLiteral,
  resolveLocalValue,
  resolveRelativeModulePath,
  unwrapOuterExpressions,
  type DereekbImportBindings,
  type DereekbImportIndex
} from '../_core/_validate/ast.js';
import type { HandlerMcpReadOnly, HandlerMcpReadOnlyUnresolved } from './types.js';

/**
 * The factory whose config carries the handler's `mcp` block.
 */
const API_DETAILS_FACTORY_NAME = 'withApiDetails';

/**
 * How many alias `const`s, imports and re-exports the walk follows from a verb-map reference before giving up.
 */
const MAX_HANDLER_HOPS = 4;

/**
 * Longest snippet of an inline handler quoted in an `unresolved` reason.
 */
const MAX_REASON_SNIPPET_LENGTH = 60;

/**
 * Input to {@link buildHandlerMcpReadOnlyContext}.
 */
export interface BuildHandlerMcpReadOnlyContextInput {
  /**
   * The scanned API sources (from `buildInMemoryProject`).
   */
  readonly sources: readonly SourceFile[];
  /**
   * The API dir, prefixed to declaration citations.
   */
  readonly apiDir: string;
}

/**
 * The scanned API sources and the lazily built bindings {@link readHandlerMcpReadOnly} resolves names against.
 */
export interface HandlerMcpReadOnlyContext {
  readonly apiDir: string;
  readonly sourcesByPath: ReadonlyMap<string, SourceFile>;
  /**
   * The per-file bindings of every file the walk has touched so far.
   */
  readonly imports: DereekbImportIndex;
  /**
   * Indexes a file's bindings into {@link imports} on first use. Call it before resolving any name of the file.
   */
  readonly ensure: (sf: SourceFile) => void;
}

/**
 * Builds the context for {@link readHandlerMcpReadOnly}. Bindings are indexed only for the files the walk reaches (the
 * handler map and each followed declaration file), not for every scanned file.
 *
 * @param input - The scanned API sources and the API dir.
 * @returns The context.
 */
export function buildHandlerMcpReadOnlyContext(input: BuildHandlerMcpReadOnlyContextInput): HandlerMcpReadOnlyContext {
  const { sources, apiDir } = input;
  const bindingsByFilePath = new Map<string, DereekbImportBindings>();
  const ensure = (sf: SourceFile): void => {
    const path = sf.getFilePath();
    if (!bindingsByFilePath.has(path)) {
      bindingsByFilePath.set(path, readDereekbImportBindings(sf));
    }
  };
  const result: HandlerMcpReadOnlyContext = { apiDir, sourcesByPath: new Map(sources.map((x) => [x.getFilePath(), x])), imports: { bindingsByFilePath }, ensure };
  return result;
}

/**
 * Follows one verb-map handler reference to its `withApiDetails({ ... })` declaration and reads its `mcp.readOnly`:
 * - `declared` when the config has an explicit `mcp.readOnly` (property or shorthand) whose value is not `undefined`;
 * - `unset` when it has no `mcp` (or `mcp: undefined`), or an `mcp` literal without `readOnly` (or `readOnly: undefined`);
 * - `noApiDetails` for a plain-function handler, which never becomes an MCP tool;
 * - `unresolved` for anything the walk can't follow to a literal config.
 *
 * Object literals are read the way the runtime builds them: the last property of a name wins, and a spread or computed
 * key after it (or anywhere, when there is no explicit property) may supply it, which reads as `unresolved`.
 *
 * @param reference - The verb-map value (wrappers unwrapped), or a shorthand specifier's name node.
 * @param context - The context from {@link buildHandlerMcpReadOnlyContext}.
 * @returns How the handler declares its MCP read/write classification.
 */
export function readHandlerMcpReadOnly(reference: Node, context: HandlerMcpReadOnlyContext): HandlerMcpReadOnly {
  const followed = followHandlerReference(unwrapOuterExpressions(reference), context, 0);
  return followed.kind === 'declaration' ? readDeclarationMcpReadOnly(followed.declaration, context) : followed.status;
}

/**
 * What following a handler reference reached: the `const` declaration that builds it, or a final status.
 */
type FollowedHandler = { readonly kind: 'declaration'; readonly declaration: VariableDeclaration } | { readonly kind: 'status'; readonly status: HandlerMcpReadOnly };

function unresolved(reason: string, declarationSource?: string): HandlerMcpReadOnlyUnresolved {
  return declarationSource === undefined ? { kind: 'unresolved', reason } : { kind: 'unresolved', reason, declarationSource };
}

function stopAt(status: HandlerMcpReadOnly): FollowedHandler {
  return { kind: 'status', status };
}

function citeDeclaration(declaration: VariableDeclaration | FunctionDeclaration, context: HandlerMcpReadOnlyContext): string {
  return `${context.apiDir}/${apiRelPath(declaration.getSourceFile())}:${declaration.getStartLineNumber()}`;
}

function snippetOf(node: Node): string {
  const firstLine = node.getText().split('\n')[0].trim();
  return firstLine.length > MAX_REASON_SNIPPET_LENGTH ? `${firstLine.slice(0, MAX_REASON_SNIPPET_LENGTH)}…` : firstLine;
}

/**
 * Follows a reference to the declaration it names, where it sits: a `const` (through alias `const`s), a function, or an
 * import followed to the scanned file it names.
 *
 * @param reference - The reference, wrappers unwrapped.
 * @param context - The walk context.
 * @param hops - How many aliases, imports and re-exports were followed to get here.
 * @returns The `const` declaration reached, or a final status.
 */
function followHandlerReference(reference: Node, context: HandlerMcpReadOnlyContext, hops: number): FollowedHandler {
  let result: FollowedHandler;
  if (hops > MAX_HANDLER_HOPS) {
    result = stopAt(unresolved(`the scan stopped after ${MAX_HANDLER_HOPS} alias / import / re-export hops`));
  } else if (Node.isIdentifier(reference)) {
    context.ensure(reference.getSourceFile());
    const binding = resolveLocalValue(reference, context.imports);
    const name = reference.getText();
    switch (binding.kind) {
      case 'variable':
        result = followVariableDeclaration(binding.declaration, context, hops);
        break;
      case 'function':
        result = stopAt({ kind: 'noApiDetails', declarationSource: citeDeclaration(binding.declaration, context) });
        break;
      case 'import':
        result = followImport(binding.declaration, context, hops);
        break;
      case 'ambiguous':
        result = stopAt(unresolved(`more than one binding of \`${name}\` is in scope where it is wired`));
        break;
      default:
        result = stopAt(unresolved(`\`${name}\` is not bound to a declaration the scan can follow`));
        break;
    }
  } else {
    result = stopAt(unresolved(`the handler is built inline or read off another value (\`${snippetOf(reference)}\`)`));
  }
  return result;
}

/**
 * Follows a variable declaration: a `const` that holds another name (`export const d = real;`) is followed to it, any
 * other `const` is the declaration to read.
 *
 * @param declaration - The variable declaration.
 * @param context - The walk context.
 * @param hops - The hops so far.
 * @returns The `const` declaration reached, or a final status.
 */
function followVariableDeclaration(declaration: VariableDeclaration, context: HandlerMcpReadOnlyContext, hops: number): FollowedHandler {
  const initializer = unwrapOuterExpressions(declaration.getInitializer());
  let result: FollowedHandler;
  if (declaration.getVariableStatement()?.getDeclarationKind() !== VariableDeclarationKind.Const) {
    result = stopAt(unresolved(`\`${declaration.getName()}\` is not declared with \`const\``, citeDeclaration(declaration, context)));
  } else if (initializer && Node.isIdentifier(initializer)) {
    result = followHandlerReference(initializer, context, hops + 1);
  } else {
    result = { kind: 'declaration', declaration };
  }
  return result;
}

/**
 * Follows an import to the scanned file its relative module specifier names, and to that file's export of the name.
 *
 * @param binding - A named import's specifier, or a default import's clause.
 * @param context - The walk context.
 * @param hops - The hops so far.
 * @returns The `const` declaration reached, or a final status.
 */
function followImport(binding: ImportSpecifier | ImportClause, context: HandlerMcpReadOnlyContext, hops: number): FollowedHandler {
  const importDeclaration = binding.getFirstAncestorByKindOrThrow(SyntaxKind.ImportDeclaration);
  const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
  const exportedName = Node.isImportSpecifier(binding) ? binding.getName() : 'default';
  let result: FollowedHandler;
  if (isDereekbModuleSpecifier(moduleSpecifier)) {
    result = stopAt(unresolved(`imported from \`${moduleSpecifier}\``));
  } else {
    result = followModuleExport({ fromSourceFile: importDeclaration.getSourceFile(), moduleSpecifier, exportedName, hops: hops + 1 }, context);
  }
  return result;
}

interface FollowModuleExportInput {
  readonly fromSourceFile: SourceFile;
  readonly moduleSpecifier: string;
  readonly exportedName: string;
  readonly hops: number;
}

function followModuleExport(input: FollowModuleExportInput, context: HandlerMcpReadOnlyContext): FollowedHandler {
  const { fromSourceFile, moduleSpecifier, exportedName, hops } = input;
  const sourceFile = resolveModuleSourceFile(fromSourceFile, moduleSpecifier, context);
  let result: FollowedHandler;
  if (sourceFile === undefined) {
    const where = moduleSpecifier.startsWith('.') ? 'outside the scanned `src/app/function/`' : 'not a relative import the scan follows';
    result = stopAt(unresolved(`imported from \`${moduleSpecifier}\`, ${where}`));
  } else {
    result = followExport({ sourceFile, exportedName, hops }, context) ?? stopAt(unresolved(`\`${apiRelPath(sourceFile)}\` has no export named \`${exportedName}\` the scan can follow`));
  }
  return result;
}

function resolveModuleSourceFile(fromSourceFile: SourceFile, moduleSpecifier: string, context: HandlerMcpReadOnlyContext): SourceFile | undefined {
  const path = resolveRelativeModulePath({ fromFilePath: fromSourceFile.getFilePath(), moduleSpecifier, hasPath: (x) => context.sourcesByPath.has(x) });
  return path === undefined ? undefined : context.sourcesByPath.get(path);
}

interface FollowExportInput {
  readonly sourceFile: SourceFile;
  readonly exportedName: string;
  readonly hops: number;
}

/**
 * Follows a file's export of a name: its own exported declarations first, then `export { … } from` and
 * `export * from` re-exports of scanned files.
 *
 * @param input - The file, the exported name and the hops so far.
 * @param context - The walk context.
 * @returns The `const` declaration reached, a final status, or `undefined` when the file has no export of the name the scan can follow.
 */
function followExport(input: FollowExportInput, context: HandlerMcpReadOnlyContext): FollowedHandler | undefined {
  const { sourceFile, exportedName, hops } = input;
  const own = readOwnExportedDeclarations(sourceFile).get(exportedName);
  let result: FollowedHandler | undefined;
  if (hops > MAX_HANDLER_HOPS) {
    result = stopAt(unresolved(`the scan stopped after ${MAX_HANDLER_HOPS} alias / import / re-export hops`));
  } else if (own === undefined) {
    result = followReExport(input, context);
  } else if (Node.isFunctionDeclaration(own)) {
    result = stopAt({ kind: 'noApiDetails', declarationSource: citeDeclaration(own, context) });
  } else {
    result = followVariableDeclaration(own, context, hops);
  }
  return result;
}

function followReExport(input: FollowExportInput, context: HandlerMcpReadOnlyContext): FollowedHandler | undefined {
  const { sourceFile, exportedName, hops } = input;
  const reExports = readReExports(sourceFile);
  const named = reExports.flatMap(({ declaration, moduleSpecifier }) =>
    declaration
      .getNamedExports()
      .filter((x) => !x.isTypeOnly() && (x.getAliasNode()?.getText() ?? x.getName()) === exportedName)
      .map((x) => ({ moduleSpecifier, importedName: x.getName() }))
  );
  let result: FollowedHandler | undefined;
  if (named.length > 0) {
    result = followModuleExport({ fromSourceFile: sourceFile, moduleSpecifier: named[0].moduleSpecifier, exportedName: named[0].importedName, hops: hops + 1 }, context);
  } else {
    result = followStarExports(
      input,
      reExports.filter((x) => isStarExport(x.declaration)),
      context
    );
  }
  return result;
}

interface ReExport {
  readonly declaration: ExportDeclaration;
  readonly moduleSpecifier: string;
}

function readReExports(sourceFile: SourceFile): ReExport[] {
  const result: ReExport[] = [];
  for (const declaration of sourceFile.getExportDeclarations()) {
    const moduleSpecifier = declaration.getModuleSpecifierValue();
    if (moduleSpecifier !== undefined && !declaration.isTypeOnly()) {
      result.push({ declaration, moduleSpecifier });
    }
  }
  return result;
}

function isStarExport(declaration: ExportDeclaration): boolean {
  return declaration.getNamedExports().length === 0 && declaration.getNamespaceExport() === undefined;
}

/**
 * Follows `export * from` re-exports of scanned files. Two star exports that supply different declarations of the name
 * conflict (the runtime exports neither), which reads as `unresolved`.
 *
 * @param input - The re-exporting file, the exported name and the hops so far.
 * @param starExports - The file's `export * from` declarations.
 * @param context - The walk context.
 * @returns The one result reached, `unresolved` on a conflict, or `undefined` when no star export supplies the name.
 */
function followStarExports(input: FollowExportInput, starExports: readonly ReExport[], context: HandlerMcpReadOnlyContext): FollowedHandler | undefined {
  const { sourceFile, exportedName, hops } = input;
  const hits = new Map<unknown, FollowedHandler>();
  for (const starExport of starExports) {
    const target = resolveModuleSourceFile(sourceFile, starExport.moduleSpecifier, context);
    const hit = target ? followExport({ sourceFile: target, exportedName, hops: hops + 1 }, context) : undefined;
    if (hit) {
      hits.set(hit.kind === 'declaration' ? hit.declaration : JSON.stringify(hit.status), hit);
    }
  }
  let result: FollowedHandler | undefined;
  if (hits.size > 1) {
    result = stopAt(unresolved(`more than one \`export *\` of \`${apiRelPath(sourceFile)}\` supplies \`${exportedName}\``));
  } else {
    result = Array.from(hits.values())[0];
  }
  return result;
}

/**
 * Reads the `mcp.readOnly` a handler's `const` declaration builds into its `withApiDetails({ ... })`.
 *
 * @param declaration - The `const` declaration that builds the handler.
 * @param context - The walk context.
 * @returns How the declaration declares its MCP read/write classification.
 */
function readDeclarationMcpReadOnly(declaration: VariableDeclaration, context: HandlerMcpReadOnlyContext): HandlerMcpReadOnly {
  const declarationSource = citeDeclaration(declaration, context);
  const initializer = unwrapOuterExpressions(declaration.getInitializer());
  let result: HandlerMcpReadOnly;
  if (initializer === undefined) {
    result = unresolved(`\`${declaration.getName()}\` has no initializer`, declarationSource);
  } else if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
    result = { kind: 'noApiDetails', declarationSource };
  } else if (Node.isCallExpression(initializer)) {
    context.ensure(initializer.getSourceFile());
    const callee = readCalleeName(initializer, context.imports);
    if (callee === API_DETAILS_FACTORY_NAME) {
      const config = resolveLocalObjectLiteral(initializer.getArguments()[0], context.imports);
      result = config ? readConfigMcpReadOnly(config, declarationSource, context) : unresolved('its `withApiDetails(...)` config is not an object literal or a local `const` holding one', declarationSource);
    } else {
      result = unresolved(`it is built by \`${callee ?? snippetOf(initializer.getExpression())}(...)\`, not \`withApiDetails({ ... })\``, declarationSource);
    }
  } else {
    result = unresolved(`it is not built by \`withApiDetails({ ... })\` (\`${snippetOf(initializer)}\`)`, declarationSource);
  }
  return result;
}

function readConfigMcpReadOnly(config: ObjectLiteralExpression, declarationSource: string, context: HandlerMcpReadOnlyContext): HandlerMcpReadOnly {
  const mcp = readStaticProperty(config, 'mcp');
  let result: HandlerMcpReadOnly;
  if (mcp.kind === 'unknown') {
    result = unresolved('a spread or computed key in its `withApiDetails({ ... })` config may supply `mcp`', declarationSource);
  } else if (mcp.kind === 'absent' || isUndefinedValue(mcp.value)) {
    result = { kind: 'unset', hasMcp: false, declarationSource };
  } else {
    const mcpBlock = resolveLocalObjectLiteral(mcp.value, context.imports);
    result = mcpBlock ? readMcpBlockReadOnly(mcpBlock, declarationSource) : unresolved('its `mcp` is not an object literal or a local `const` holding one', declarationSource);
  }
  return result;
}

function readMcpBlockReadOnly(mcpBlock: ObjectLiteralExpression, declarationSource: string): HandlerMcpReadOnly {
  const readOnly = readStaticProperty(mcpBlock, 'readOnly');
  let result: HandlerMcpReadOnly;
  if (readOnly.kind === 'unknown') {
    result = unresolved('a spread or computed key in its `mcp` block may supply `readOnly`', declarationSource);
  } else if (readOnly.kind === 'absent' || isUndefinedValue(readOnly.value)) {
    result = { kind: 'unset', hasMcp: true, declarationSource };
  } else {
    result = { kind: 'declared', value: readBooleanLiteral(readOnly.value), declarationSource };
  }
  return result;
}

function readBooleanLiteral(node: Node): boolean | undefined {
  const kind = unwrapOuterExpressions(node).getKind();
  let result: boolean | undefined;
  if (kind === SyntaxKind.TrueKeyword) {
    result = true;
  } else if (kind === SyntaxKind.FalseKeyword) {
    result = false;
  }
  return result;
}

function isUndefinedValue(node: Node): boolean {
  const inner = unwrapOuterExpressions(node);
  return (Node.isIdentifier(inner) && inner.getText() === 'undefined') || Node.isVoidExpression(inner);
}
