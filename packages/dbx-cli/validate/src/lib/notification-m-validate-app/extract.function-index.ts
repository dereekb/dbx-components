/**
 * Index of the API side's named functions, shared by the notification extractors that chase factory calls
 * (`extract.ts`, `extract.taskbot.ts`), and {@link resolveApiFunctionReference}, which resolves a reference to the API
 * function it is bound to where it sits.
 */

import { posix } from 'node:path';
import { Node, SyntaxKind, type ArrowFunction, type FunctionDeclaration, type FunctionExpression, type Identifier, type ImportClause, type ImportSpecifier, type SourceFile } from 'ts-morph';
import { apiRelPath, isDereekbModuleSpecifier, resolveLocalValue, unwrapAsExpressions, type DereekbImportIndex } from '../_core/_validate/ast.js';

/**
 * A named function declared in an API source file — a function declaration, or a variable initialized with an arrow
 * function or function expression.
 */
export interface ApiFunctionEntry {
  readonly node: FunctionDeclaration | ArrowFunction | FunctionExpression;
  readonly sourceFile: SourceFile;
  readonly relPath: string;
}

/**
 * Lookups of the API side's named functions: by name, by node, and by what each file exports.
 */
export interface ApiFunctionIndex {
  /**
   * Each function by name; a later function of the same name replaces an earlier one. The template and NotificationTaskBot
   * readers look functions up here by name. The handlers trace resolves a reference to the function it is bound to instead
   * ({@link resolveApiFunctionReference}).
   */
  readonly functionsByName: ReadonlyMap<string, ApiFunctionEntry>;
  /**
   * Every indexed function by its node, including one a later same-named function replaces in {@link functionsByName}.
   */
  readonly functionsByNode: ReadonlyMap<Node, ApiFunctionEntry>;
  /**
   * What each API file exports from its own top-level functions and variables, by file path, then by exported name: the
   * function for a function declaration or a variable holding an indexed function, `undefined` for any other variable. It
   * reads `export` on the declaration, an `export { … }` list and `export default <name>`. Re-exports
   * (`export … from`), classes and enums are left out.
   */
  readonly exportsByFilePath: ReadonlyMap<string, ReadonlyMap<string, ApiFunctionEntry | undefined>>;
  /**
   * The functions the API files export under each name ({@link exportsByFilePath}), `default` left out.
   */
  readonly exportedFunctionsByName: ReadonlyMap<string, readonly ApiFunctionEntry[]>;
}

/**
 * Indexes every named function across the given API sources, and what each file exports. A later declaration with the
 * same name replaces an earlier one in {@link ApiFunctionIndex.functionsByName}; {@link ApiFunctionIndex.functionsByNode}
 * keeps both.
 *
 * @param sources - The API source files.
 * @returns The function index.
 */
export function buildApiFunctionIndex(sources: readonly SourceFile[]): ApiFunctionIndex {
  const functionsByName = new Map<string, ApiFunctionEntry>();
  const functionsByNode = new Map<Node, ApiFunctionEntry>();
  const add = (name: string, entry: ApiFunctionEntry): void => {
    functionsByName.set(name, entry);
    functionsByNode.set(entry.node, entry);
  };
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    indexFunctionDeclarations(sf, rel, add);
    indexFunctionVariableDeclarations(sf, rel, add);
  }
  const exportsByFilePath = new Map<string, ReadonlyMap<string, ApiFunctionEntry | undefined>>();
  const exportedFunctionsByName = new Map<string, ApiFunctionEntry[]>();
  for (const sf of sources) {
    const exports = readOwnExports(sf, functionsByNode);
    exportsByFilePath.set(sf.getFilePath(), exports);
    for (const [name, entry] of exports) {
      if (entry && name !== 'default') {
        const named = exportedFunctionsByName.get(name) ?? [];
        named.push(entry);
        exportedFunctionsByName.set(name, named);
      }
    }
  }
  const result: ApiFunctionIndex = { functionsByName, functionsByNode, exportsByFilePath, exportedFunctionsByName };
  return result;
}

function indexFunctionDeclarations(sf: SourceFile, rel: string, add: (name: string, entry: ApiFunctionEntry) => void): void {
  for (const fn of sf.getFunctions()) {
    const name = fn.getName();
    if (name) {
      add(name, { node: fn, sourceFile: sf, relPath: rel });
    }
  }
}

function indexFunctionVariableDeclarations(sf: SourceFile, rel: string, add: (name: string, entry: ApiFunctionEntry) => void): void {
  for (const stmt of sf.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const initializer = unwrapAsExpressions(decl.getInitializer());
      if (!initializer) continue;
      if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
        add(decl.getName(), { node: initializer, sourceFile: sf, relPath: rel });
      }
    }
  }
}

/**
 * Reads what a file exports from its own top-level declarations (see {@link ApiFunctionIndex.exportsByFilePath}).
 *
 * @param sf - The API file.
 * @param functionsByNode - The indexed functions.
 * @returns The exported names.
 */
function readOwnExports(sf: SourceFile, functionsByNode: ReadonlyMap<Node, ApiFunctionEntry>): Map<string, ApiFunctionEntry | undefined> {
  const locals = new Map<string, ApiFunctionEntry | undefined>(); // each top-level function and variable by name: its indexed function, or undefined
  const exportedLocals = new Map<string, string>(); // each exported name: the local name it exports
  for (const fn of sf.getFunctions()) {
    const name = fn.getName();
    if (name !== undefined) {
      locals.set(name, functionsByNode.get(fn));
      if (fn.hasExportKeyword()) {
        exportedLocals.set(fn.hasDefaultKeyword() ? 'default' : name, name);
      }
    }
  }
  for (const stmt of sf.getVariableStatements()) {
    for (const decl of stmt.getDeclarations().filter((x) => Node.isIdentifier(x.getNameNode()))) {
      const initializer = unwrapAsExpressions(decl.getInitializer());
      locals.set(decl.getName(), initializer ? functionsByNode.get(initializer) : undefined);
      if (stmt.hasExportKeyword()) {
        exportedLocals.set(decl.getName(), decl.getName());
      }
    }
  }
  const exportLists = sf.getExportDeclarations().filter((x) => !x.hasModuleSpecifier() && !x.isTypeOnly());
  for (const specifier of exportLists.flatMap((x) => x.getNamedExports()).filter((x) => !x.isTypeOnly())) {
    exportedLocals.set(specifier.getAliasNode()?.getText() ?? specifier.getName(), specifier.getName());
  }
  for (const assignment of sf.getExportAssignments().filter((x) => !x.isExportEquals())) {
    exportedLocals.set('default', assignment.getExpression().getText());
  }
  return new Map(
    Array.from(exportedLocals)
      .filter(([, local]) => locals.has(local))
      .map(([exported, local]) => [exported, locals.get(local)])
  );
}

/**
 * How {@link resolveApiFunctionReference} reads a reference:
 * - `function`: the API function it is bound to where it sits;
 * - `ambiguous`: more than one binding of its name is in scope there (`resolveLocalVariable` reads it as ambiguous too);
 * - `none`: it is bound to something else (a variable that holds no indexed function, a parameter, a nested function, an
 *   `@dereekb/*` import, an import the scan can't pin to one API function), or to nothing in its file.
 */
export type ApiFunctionResolution = { readonly kind: 'function'; readonly entry: ApiFunctionEntry } | { readonly kind: 'ambiguous' } | { readonly kind: 'none' };

/**
 * Input to {@link resolveApiFunctionReference}.
 */
export interface ResolveApiFunctionReferenceInput {
  readonly reference: Identifier;
  readonly index: ApiFunctionIndex;
  readonly imports: DereekbImportIndex;
}

/**
 * Resolves a reference to the API function it is bound to where it sits (`resolveLocalValue`): a top-level function
 * declaration of its file, a top-level variable of its file holding an indexed arrow function or function expression, or
 * a function another API file exports, through an import. Unlike a lookup in {@link ApiFunctionIndex.functionsByName},
 * same-named functions of different files are told apart, and a name bound to a parameter or to a variable that holds no
 * function is never read as an API function.
 *
 * An import is followed to the API file its relative module specifier names, and to that file's own export of the name
 * ({@link ApiFunctionIndex.exportsByFilePath}). When the scan can't read that export (a package or path alias, a file
 * outside the scanned folders, a re-export), a named import reads as the one function the API files export under its
 * name, and as `none` when no API file, or more than one, does. An `@dereekb/*` import is never an API function.
 *
 * @param input - The reference, the function index and the per-file bindings.
 * @returns The resolution.
 */
export function resolveApiFunctionReference(input: ResolveApiFunctionReferenceInput): ApiFunctionResolution {
  const { reference, index, imports } = input;
  const binding = resolveLocalValue(reference, imports);
  let result: ApiFunctionResolution = { kind: 'none' };
  if (binding.kind === 'ambiguous') {
    result = binding;
  } else if (binding.kind === 'function') {
    result = asFunctionResolution(index.functionsByNode.get(binding.declaration));
  } else if (binding.kind === 'variable') {
    const initializer = unwrapAsExpressions(binding.declaration.getInitializer());
    result = asFunctionResolution(initializer ? index.functionsByNode.get(initializer) : undefined);
  } else if (binding.kind === 'import') {
    result = resolveImportedApiFunction(binding.declaration, index);
  }
  return result;
}

function asFunctionResolution(entry: ApiFunctionEntry | undefined): ApiFunctionResolution {
  return entry ? { kind: 'function', entry } : { kind: 'none' };
}

/**
 * The suffixes a relative module specifier is tried with, in order: as written, as a `.ts` file, and as a folder's
 * `index.ts`. A `.js` extension is dropped first.
 */
const RELATIVE_MODULE_SUFFIXES: readonly string[] = ['', '.ts', '/index.ts'];

/**
 * Resolves an import binding to the API function it imports, for {@link resolveApiFunctionReference}.
 *
 * @param binding - A named import's specifier, or a default import's clause.
 * @param index - The function index.
 * @returns The resolution: never `ambiguous`.
 */
function resolveImportedApiFunction(binding: ImportSpecifier | ImportClause, index: ApiFunctionIndex): ApiFunctionResolution {
  const declaration = binding.getFirstAncestorByKindOrThrow(SyntaxKind.ImportDeclaration);
  const moduleSpecifier = declaration.getModuleSpecifierValue();
  const exportedName = Node.isImportSpecifier(binding) ? binding.getName() : 'default';
  let moduleExports: ReadonlyMap<string, ApiFunctionEntry | undefined> | undefined;
  if (moduleSpecifier.startsWith('.')) {
    const base = posix.join(posix.dirname(declaration.getSourceFile().getFilePath()), moduleSpecifier.replace(/\.js$/, ''));
    const path = RELATIVE_MODULE_SUFFIXES.map((x) => `${base}${x}`).find((x) => index.exportsByFilePath.has(x));
    moduleExports = path === undefined ? undefined : index.exportsByFilePath.get(path);
  }
  let result: ApiFunctionResolution;
  if (isDereekbModuleSpecifier(moduleSpecifier)) {
    result = { kind: 'none' };
  } else if (moduleExports?.has(exportedName)) {
    result = asFunctionResolution(moduleExports.get(exportedName));
  } else if (exportedName === 'default') {
    result = { kind: 'none' };
  } else {
    const candidates = index.exportedFunctionsByName.get(exportedName) ?? [];
    result = asFunctionResolution(candidates.length === 1 ? candidates[0] : undefined);
  }
  return result;
}
