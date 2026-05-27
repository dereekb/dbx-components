import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Maybe } from '@dereekb/util';

/**
 * Module that publishes the `@dereekb/firebase` Firestore constraint factories (`where`, `orderBy`, etc.).
 */
export const FIREBASE_MODULE = '@dereekb/firebase';

/**
 * Subpath, relative to the `@dereekb/firebase` package root, where the framework Firestore model
 * declarations live (`firestoreModelIdentity(...)` calls in source, identity type-annotations in the
 * shipped `.d.ts`).
 */
const FIREBASE_MODEL_SUBPATH: string = join('src', 'lib', 'model');

const installedFirebaseModelDirCache: Map<string, Maybe<string>> = new Map();

/**
 * Resolves the absolute path to the installed `@dereekb/firebase` package's `src/lib/model`
 * directory, as seen from the ESLint `cwd`. Used by rules that need to read the framework model
 * declarations (identities, service factories) directly from the package a consumer has installed —
 * the downstream case where these live under `node_modules/@dereekb/firebase/...` as compiled
 * bundles plus `.d.ts` rather than a scannable source tree.
 *
 * Resolution uses Node's own module resolver (`require.resolve('@dereekb/firebase/package.json')`
 * anchored at `cwd`), so it transparently handles hoisting / nested `node_modules`. Returns null
 * when `@dereekb/firebase` is not resolvable as a dependency from `cwd` (e.g. inside the
 * dbx-components monorepo itself, where it is consumed via TS path mapping rather than
 * `node_modules`) — callers fall back to their cwd-relative source globs in that case.
 *
 * @param cwd - The ESLint working directory to resolve the dependency from.
 * @returns The absolute model directory, or null when it cannot be resolved.
 */
export function resolveInstalledFirebaseModelDir(cwd: string): Maybe<string> {
  let result: Maybe<string>;
  if (installedFirebaseModelDirCache.has(cwd)) {
    result = installedFirebaseModelDirCache.get(cwd) ?? null;
  } else {
    result = null;
    try {
      const requireFromCwd = createRequire(join(cwd, '__dbx_firebase_model_resolver__.js'));
      const packageJsonPath: string = requireFromCwd.resolve(`${FIREBASE_MODULE}/package.json`, { paths: [cwd] });
      const candidate: string = join(dirname(packageJsonPath), FIREBASE_MODEL_SUBPATH);
      if (existsSync(candidate)) {
        result = candidate;
      }
    } catch {
      result = null;
    }
    installedFirebaseModelDirCache.set(cwd, result);
  }
  return result;
}

/**
 * Resolves the referenced type name from either a `TSTypeReference` (`Foo<…>` / `ns.Foo<…>`) or a
 * `TSImportType` (`import("…").Foo<…>` — the form the TypeScript compiler emits in declaration
 * files for cross-module type references). Returns the rightmost identifier name in a qualified
 * name.
 *
 * @param node - A `TSTypeReference` or `TSImportType` node (or anything else).
 * @returns The referenced type name, or null when the node is neither shape.
 */
export function referencedTypeName(node: AstNode): Maybe<string> {
  let result: Maybe<string> = null;
  if (node?.type === 'TSTypeReference') {
    result = qualifiedNameTail(node.typeName);
  } else if (node?.type === 'TSImportType') {
    result = qualifiedNameTail(node.qualifier);
  }
  return result;
}

function qualifiedNameTail(node: AstNode): Maybe<string> {
  let result: Maybe<string> = null;
  if (node?.type === 'Identifier') {
    result = node.name;
  } else if (node?.type === 'TSQualifiedName' && node.right?.type === 'Identifier') {
    result = node.right.name;
  }
  return result;
}

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

// MARK: CRUD Function / Api Details
/**
 * Default CRUD verb names that combine with the `ModelFunction` suffix to form a type-name
 * pattern the api-details rules treat as a CRUD function declaration (e.g. `OnCallCreateModelFunction`,
 * `DemoUpdateModelFunction`).
 *
 * Mirrors the verbs supported by `ModelFirebaseCrudFunctionConfigMap` — see
 * `packages/firebase/src/lib/client/function/model.function.factory.ts`.
 */
export const DEFAULT_CRUD_FUNCTION_TYPE_VERBS: readonly string[] = ['Create', 'Read', 'Update', 'Delete', 'Query', 'Invoke'];

/**
 * Default factory function name that wraps CRUD function declarations and attaches the
 * `_apiDetails` metadata (`inputType`, `outputType`, `mcp.visibility`, `analytics`) consumed
 * by the MCP manifest builder. Defined in `packages/firebase-server/src/lib/nest/model/api.details.ts`.
 */
export const DEFAULT_API_DETAILS_FACTORY_NAME: string = 'withApiDetails';

/**
 * Property name on the `withApiDetails(...)` config object that declares the handler's input
 * parameter type (consumed by the MCP manifest builder to generate the tool input schema).
 */
export const INPUT_TYPE_PROPERTY_NAME: string = 'inputType';

/**
 * Module the default api-details factory ({@link DEFAULT_API_DETAILS_FACTORY_NAME}) is exported
 * from. Used by the require-api-details auto-fix to insert a missing import.
 */
export const API_DETAILS_IMPORT_MODULE: string = '@dereekb/firebase-server';

/**
 * Unwraps `TSAsExpression` and `TSTypeAssertion` wrappers around an initializer so callers see the
 * underlying expression (matches the helper in `require-complete-crud-function-config-map.rule.ts`).
 *
 * @param node - The AST node to unwrap.
 * @returns The innermost wrapped expression, or `node` when no cast is present.
 */
export function unwrapTypeAssertion(node: AstNode): AstNode {
  let current: AstNode = node;
  while (current && (current.type === 'TSAsExpression' || current.type === 'TSTypeAssertion') && current.expression) {
    current = current.expression;
  }
  return current;
}

/**
 * Resolves the identifier name from a `TSTypeReference` annotation, when present.
 *
 * @param node - A `TSTypeReference` node (or anything else).
 * @returns The identifier name when `node` is a TSTypeReference whose typeName is an Identifier; otherwise null.
 */
export function typeReferenceTypeName(node: AstNode): Maybe<string> {
  let result: Maybe<string> = null;
  if (node?.type === 'TSTypeReference' && node.typeName?.type === 'Identifier') {
    result = node.typeName.name;
  }
  return result;
}

/**
 * Resolves the type-argument nodes of a `TSTypeReference`, normalizing across `@typescript-eslint`
 * versions (`typeArguments` in v6+, `typeParameters` in older releases).
 *
 * @param node - A `TSTypeReference` node (or anything else).
 * @returns The generic argument nodes, or null when the reference has no type arguments.
 */
export function typeReferenceTypeArguments(node: AstNode): Maybe<AstNode[]> {
  const container: Maybe<AstNode> = node?.typeArguments ?? node?.typeParameters;
  return (container?.params as Maybe<AstNode[]>) ?? null;
}

/**
 * Resolves the callee identifier name from a `CallExpression`, looking through both bare identifier
 * callees (`withApiDetails(...)`) and member-expression callees (`api.withApiDetails(...)`).
 *
 * @param callee - The `CallExpression.callee` node.
 * @returns The callee name when resolvable; otherwise null.
 */
export function callExpressionCalleeName(callee: AstNode): Maybe<string> {
  let result: Maybe<string> = null;
  if (callee?.type === 'Identifier') {
    result = callee.name;
  } else if (callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier') {
    result = callee.property.name;
  }
  return result;
}

/**
 * Determines whether the (already-unwrapped) initializer is a call to the configured api-details factory.
 *
 * @param initializer - The unwrapped initializer node.
 * @param factoryName - The expected factory identifier name.
 * @returns True when the initializer is a `CallExpression` whose callee resolves to `factoryName`.
 */
export function isApiDetailsCall(initializer: AstNode, factoryName: string): boolean {
  return initializer?.type === 'CallExpression' && callExpressionCalleeName(initializer.callee) === factoryName;
}

/**
 * Returns the declarator's identifier name, when present.
 *
 * @param declaratorId - The `VariableDeclarator.id` node.
 * @returns The identifier name, or null when the declarator binds a destructuring pattern.
 */
export function declaratorName(declaratorId: AstNode): Maybe<string> {
  return declaratorId?.type === 'Identifier' ? (declaratorId.name as Maybe<string>) : null;
}

/**
 * Returns the CRUD verb fragment that `typeName` ends with — i.e. the `<Verb>` in a
 * `<Verb>ModelFunction` suffix for one of the configured verbs (e.g. `OnCallCreateModelFunction` →
 * `Create`, `DemoUpdateModelFunction` → `Update`).
 *
 * @param typeName - The type-reference identifier name.
 * @param verbs - The allowed verb fragments.
 * @returns The matched verb, or null when the suffix matches no recognized CRUD verb.
 */
export function matchedCrudFunctionVerb(typeName: string, verbs: Iterable<string>): Maybe<string> {
  let result: Maybe<string> = null;
  for (const verb of verbs) {
    if (typeName.endsWith(`${verb}ModelFunction`)) {
      result = verb;
      break;
    }
  }
  return result;
}

/**
 * Returns true when `typeName` ends with `<Verb>ModelFunction` for one of the configured verbs.
 *
 * @param typeName - The type-reference identifier name.
 * @param verbs - The allowed verb fragments.
 * @returns True when the suffix matches a recognized CRUD verb.
 */
export function isCrudFunctionTypeName(typeName: string, verbs: Iterable<string>): boolean {
  return matchedCrudFunctionVerb(typeName, verbs) != null;
}

/**
 * Index of the input-parameter generic argument within a CRUD function type reference. Canonical
 * `On(?:Call)?<Verb>ModelFunction<Context, Input, Output>` names place the context at index 0 and the
 * input at index 1; app-side aliases (`Demo<Verb>ModelFunction<Input, Output>`) place the input at
 * index 0. Distinguished by the `On` prefix (a syntactic heuristic).
 *
 * @param typeName - The CRUD function type-reference name.
 * @returns The generic-argument index that holds the input type.
 */
function crudFunctionInputGenericIndex(typeName: string): number {
  return typeName.startsWith('On') ? 1 : 0;
}

/**
 * Resolves the input-parameter type-argument node from a CRUD function type reference.
 *
 * @param typeRef - The `TSTypeReference` annotation node.
 * @param typeName - The resolved type-reference name (selects the generic position).
 * @returns The input type-argument node, or null when absent.
 */
export function crudFunctionInputTypeArgNode(typeRef: AstNode, typeName: string): Maybe<AstNode> {
  const params = typeReferenceTypeArguments(typeRef);
  const index = crudFunctionInputGenericIndex(typeName);
  return params?.[index] ?? null;
}

/**
 * Returns true when an input type-argument node is an empty object type literal (`{}`).
 *
 * @param node - The type-argument node.
 * @returns True when the node is a `TSTypeLiteral` with no members.
 */
function isEmptyObjectTypeNode(node: AstNode): boolean {
  return node?.type === 'TSTypeLiteral' && (node.members?.length ?? 0) === 0;
}

/**
 * Returns true when a CRUD function declares no meaningful input — either the input generic argument
 * is absent or it is an empty object type literal (`{}`). Such handlers need no MCP input schema, so
 * the require-input-type rule exempts them.
 *
 * @param typeRef - The `TSTypeReference` annotation node.
 * @param typeName - The resolved type-reference name.
 * @returns True when the input generic is empty or absent.
 */
export function isEmptyOrAbsentInputGeneric(typeRef: AstNode, typeName: string): boolean {
  const inputArg = crudFunctionInputTypeArgNode(typeRef, typeName);
  return inputArg == null || isEmptyObjectTypeNode(inputArg);
}

/**
 * Resolves the static name of an object-literal property key (`Identifier` or string `Literal`).
 *
 * @param key - The property `key` node.
 * @returns The key name, or null for computed/non-static keys.
 */
function propertyKeyName(key: AstNode): Maybe<string> {
  let result: Maybe<string> = null;
  if (key?.type === 'Identifier') {
    result = key.name;
  } else if (key?.type === 'Literal' && typeof key.value === 'string') {
    result = key.value;
  }
  return result;
}

/**
 * Returns true when an `ObjectExpression` has an own (non-computed) property with the given name.
 *
 * @param objExpr - The `ObjectExpression` node.
 * @param propName - The property name to look for.
 * @returns True when a matching property is present.
 */
export function objectExpressionHasProperty(objExpr: AstNode, propName: string): boolean {
  const properties: AstNode[] = objExpr?.properties ?? [];
  return properties.some((p) => p.type === 'Property' && !p.computed && propertyKeyName(p.key) === propName);
}

/**
 * Returns true when an `ObjectExpression` contains a spread element (`{ ...base }`), whose contents
 * cannot be introspected statically.
 *
 * @param objExpr - The `ObjectExpression` node.
 * @returns True when any property is a spread element.
 */
export function objectExpressionHasSpread(objExpr: AstNode): boolean {
  const properties: AstNode[] = objExpr?.properties ?? [];
  return properties.some((p) => p.type === 'SpreadElement' || p.type === 'ExperimentalSpreadProperty');
}

/**
 * Returns the character offset at which an auto-fixer should insert a new import — the start of the
 * first existing `ImportDeclaration`, or offset 0 when the file has no imports yet.
 *
 * @param program - The `Program` AST node.
 * @returns The character offset for the import-insertion point.
 */
export function findImportInsertionOffset(program: AstNode): number {
  const body: AstNode[] = program?.body ?? [];
  let offset = 0;

  for (const stmt of body) {
    if (stmt.type === 'ImportDeclaration' && offset === 0) {
      offset = stmt.range[0];
    }
  }

  return offset;
}

/**
 * Returns true when an import declaration binds the given local name.
 *
 * @param stmt - The `ImportDeclaration` node.
 * @param name - The local binding name to look for.
 * @returns True when a specifier's local name matches.
 */
function importBindsLocalName(stmt: AstNode, name: string): boolean {
  const specifiers: AstNode[] = stmt.specifiers ?? [];
  return specifiers.some((spec) => spec.local?.name === name);
}

/**
 * Returns true when a declaration node binds the given name (function/declare-function/class
 * declarations by id, variable declarations by any declarator identifier).
 *
 * @param node - The declaration node.
 * @param name - The binding name to look for.
 * @returns True when the declaration introduces `name`.
 */
function declarationBindsName(node: AstNode, name: string): boolean {
  let result = false;

  if ((node.type === 'FunctionDeclaration' || node.type === 'TSDeclareFunction' || node.type === 'ClassDeclaration') && node.id?.name === name) {
    result = true;
  } else if (node.type === 'VariableDeclaration') {
    result = (node.declarations ?? []).some((d: AstNode) => d.id?.type === 'Identifier' && d.id.name === name);
  }

  return result;
}

/**
 * Returns true when a top-level statement brings the given name into the module scope — via an
 * import specifier, a top-level declaration, or an `export`-wrapped declaration.
 *
 * @param stmt - The top-level statement node.
 * @param name - The binding name to look for.
 * @returns True when the statement binds `name`.
 */
function statementBindsName(stmt: AstNode, name: string): boolean {
  let result = false;

  if (stmt.type === 'ImportDeclaration') {
    result = importBindsLocalName(stmt, name);
  } else if (stmt.type === 'ExportNamedDeclaration' && stmt.declaration) {
    result = declarationBindsName(stmt.declaration, name);
  } else {
    result = declarationBindsName(stmt, name);
  }

  return result;
}

/**
 * Returns true when the given identifier name is already in the module's top-level scope (imported
 * or declared). Used by the require-api-details auto-fix to avoid inserting a duplicate import.
 *
 * @param program - The `Program` AST node.
 * @param name - The identifier name to check.
 * @returns True when an existing import or declaration brings `name` into scope.
 */
export function isFactoryNameInScope(program: AstNode, name: string): boolean {
  const body: AstNode[] = program?.body ?? [];
  return body.some((stmt) => statementBindsName(stmt, name));
}
