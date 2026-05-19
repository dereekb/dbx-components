import type { Maybe } from '@dereekb/util';

/**
 * Module that publishes the `@dereekb/firebase` Firestore constraint factories (`where`, `orderBy`, etc.).
 */
export const FIREBASE_MODULE = '@dereekb/firebase';

/**
 * JSDoc tag name that marks an exported query factory whose body should be scanned by
 * `dbx-components-mcp`'s index extractor (`packages/dbx-components-mcp/src/scan/model-firebase-index-extract.ts`).
 */
export const DBX_MODEL_FIREBASE_INDEX_MARKER = 'dbxModelFirebaseIndex';

/**
 * The canonical suffix expected on every `@dbxModelFirebaseIndex`-tagged factory name.
 */
export const QUERY_SUFFIX = 'Query';

/**
 * Index-affecting Firestore constraint factory identifiers exported from `@dereekb/firebase`
 * (see `packages/firebase/src/lib/common/firestore/query/constraint.ts`). These shape the
 * composite index Firestore needs to satisfy the query — calls to them must originate inside
 * a `@dbxModelFirebaseIndex`-tagged function so the dbx-components-mcp index extractor can
 * collect them.
 *
 * `where` and `orderBy` are the only constraint factories that influence composite indexes;
 * pagination/cursor factories (`limit`, `limitToLast`, `whereDocumentId`, `startAt`/`After`,
 * `endAt`/`Before`) only narrow the cursor/window of an already-indexed query and may be
 * composed freely outside tagged factories — see {@link DEFAULT_PAGINATION_CONSTRAINT_NAMES}.
 */
export const DEFAULT_INDEX_AFFECTING_CONSTRAINT_NAMES: readonly string[] = ['where', 'orderBy'];

/**
 * Pagination/cursor Firestore constraint factory identifiers exported from `@dereekb/firebase`.
 * These do not influence composite indexes and may be composed externally — e.g. a generic
 * pagination helper that appends `limit` + `startAfter` onto a caller-supplied tagged-query
 * constraint array. The "tagged-firestore-constraints" rule does not flag calls to these by
 * default.
 */
export const DEFAULT_PAGINATION_CONSTRAINT_NAMES: readonly string[] = ['limit', 'limitToLast', 'whereDocumentId', 'startAt', 'startAfter', 'endAt', 'endBefore'];

/**
 * Combined list of every Firestore constraint factory exported from `@dereekb/firebase`. Used
 * by the body-coherence rule to ensure a tagged factory body contains at least one constraint
 * call of any kind (index-affecting or pagination) before warning that the marker is orphaned.
 */
export const DEFAULT_CONSTRAINT_FACTORY_NAMES: readonly string[] = [...DEFAULT_INDEX_AFFECTING_CONSTRAINT_NAMES, ...DEFAULT_PAGINATION_CONSTRAINT_NAMES];

/**
 * Loose AST node alias used by the rule implementations.
 */
export type AstNode = any;

/**
 * Per-file registry of import information used by the firebase-eslint rules.
 *
 * `localToImported` maps the local binding name (which may be a rename, e.g. `fbWhere` from
 * `import { where as fbWhere }`) back to the imported name (`where`) — the rules check the
 * imported name against the firestore-constraint allowlist.
 */
export interface ImportRegistry {
  readonly bySource: Map<string, Set<string>>;
  readonly localToSource: Map<string, string>;
  readonly localToImported: Map<string, string>;
}

/**
 * Creates an empty {@link ImportRegistry}.
 *
 * @returns A fresh empty registry.
 */
export function createImportRegistry(): ImportRegistry {
  return {
    bySource: new Map(),
    localToSource: new Map(),
    localToImported: new Map()
  };
}

/**
 * Records an `ImportDeclaration` node in the registry.
 *
 * @param registry - The registry to mutate.
 * @param node - The ImportDeclaration AST node.
 */
export function trackImportDeclaration(registry: ImportRegistry, node: AstNode): void {
  const source = node.source?.value as Maybe<string>;

  if (source) {
    const localNames = registry.bySource.get(source) ?? new Set<string>();

    for (const specifier of node.specifiers ?? []) {
      if (specifier.type === 'ImportSpecifier' || specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier') {
        const localName = specifier.local?.name as Maybe<string>;

        if (localName) {
          localNames.add(localName);
          registry.localToSource.set(localName, source);
          const importedName: Maybe<string> = specifier.type === 'ImportSpecifier' ? ((specifier.imported?.name as Maybe<string>) ?? localName) : localName;
          registry.localToImported.set(localName, importedName);
        }
      }
    }

    registry.bySource.set(source, localNames);
  }
}

/**
 * Returns true when the given local identifier name was imported from the given module.
 *
 * @param registry - The import registry built from the file's import declarations.
 * @param localName - The local identifier (as it appears in code).
 * @param fromSource - The expected source-module string.
 * @returns True when the local name maps to the given source.
 */
export function isImportedFrom(registry: ImportRegistry, localName: string, fromSource: string): boolean {
  return registry.localToSource.get(localName) === fromSource;
}

/**
 * Returns the statement-level anchor node that ESLint attaches leading comments to for the
 * given function-like node. For function declarations this is the declaration (or its
 * `Export*Declaration` wrapper); for arrow/function expressions assigned to a variable, it
 * is the variable declaration (or its `Export*Declaration` wrapper); otherwise `null`.
 *
 * @param node - The function-like AST node (FunctionDeclaration / FunctionExpression / ArrowFunctionExpression).
 * @returns The anchor statement node, or null when the function has no JSDoc-anchorable container.
 */
export function getFunctionJsdocAnchor(node: AstNode): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;

  if (node.type === 'FunctionDeclaration') {
    result = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
  } else if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
    const declarator = node.parent;
    if (declarator?.type === 'VariableDeclarator') {
      const declaration = declarator.parent;
      if (declaration?.type === 'VariableDeclaration') {
        result = declaration.parent?.type === 'ExportNamedDeclaration' || declaration.parent?.type === 'ExportDefaultDeclaration' ? declaration.parent : declaration;
      }
    }
  }

  return result;
}

/**
 * Returns the function name when resolvable: `node.id.name` for declarations, or the
 * containing `VariableDeclarator.id.name` for arrow/function expressions. Returns `null`
 * when the function is anonymous in an unrecognized context.
 *
 * @param node - The function-like AST node.
 * @returns The function name, or null when anonymous.
 */
export function getFunctionName(node: AstNode): Maybe<string> {
  let result: Maybe<string> = null;

  if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && node.id?.type === 'Identifier') {
    result = node.id.name;
  } else if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
    const declarator = node.parent;
    if (declarator?.type === 'VariableDeclarator' && declarator.id?.type === 'Identifier') {
      result = declarator.id.name;
    }
  }

  return result;
}

/**
 * Returns the name-bearing AST node for reporting on a function: the `id` for a
 * declaration, the `VariableDeclarator.id` for an arrow assignment, or the function node
 * itself as a last resort.
 *
 * @param node - The function-like AST node.
 * @returns The node to attach a `context.report` location to.
 */
export function getFunctionNameNode(node: AstNode): AstNode {
  let result: AstNode = node;

  if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && node.id) {
    result = node.id;
  } else if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    const declarator = node.parent;
    if (declarator?.type === 'VariableDeclarator' && declarator.id) {
      result = declarator.id;
    }
  }

  return result;
}
