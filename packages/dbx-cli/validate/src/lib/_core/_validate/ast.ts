/**
 * Shared ts-morph leaf helpers and in-memory project builder used by
 * the two-side validate-app extractors
 * (`storagefile-m-validate-app/extract.ts`,
 * `notification-m-validate-app/extract.ts`).
 *
 * Every helper here is pure node-walking — no domain type names, no
 * per-validator branching. Callers wrap these in domain-specific
 * extraction functions that match against `STORAGEFILE_PURPOSE_TYPE`,
 * `NOTIF_TEMPLATE_TYPE`, and the like.
 *
 * The {@link buildInMemoryProject} helper bakes in the
 * `__component__/` and `__api__/` virtual prefixes so the relPath
 * helpers can reverse them without each caller re-encoding the
 * convention.
 */

import { Node, Project, SyntaxKind, VariableDeclarationKind, type ArrayLiteralExpression, type CallExpression, type Identifier, type ImportDeclaration, type ObjectLiteralExpression, type PropertyAccessExpression, type SourceFile, type TypeNode, type VariableDeclaration } from 'ts-morph';
import type { InspectedFile } from './inspection.types.js';

const COMPONENT_VIRTUAL_PREFIX = '__component__/';
const API_VIRTUAL_PREFIX = '__api__/';
const DEREEKB_MODULE_PREFIX = '@dereekb/';

/**
 * In-memory ts-morph project plus pre-collected source files for each
 * side, ready to feed the per-domain extractors.
 */
export interface InMemoryProject {
  readonly project: Project;
  readonly componentSources: readonly SourceFile[];
  readonly apiSources: readonly SourceFile[];
}

/**
 * Two-side inspection input accepted by {@link buildInMemoryProject}.
 * Structurally compatible with both
 * `AppStorageFilesInspection` and `AppNotificationsInspection`.
 */
export interface BuildInMemoryProjectInput {
  readonly component: { readonly files: readonly InspectedFile[] };
  readonly api: { readonly files: readonly InspectedFile[] };
}

/**
 * Builds a single in-memory ts-morph project containing every component
 * and api file from the inspection. Component files are placed under
 * `__component__/` and api files under `__api__/` so both
 * {@link componentRelPath} and {@link apiRelPath} can recover the
 * caller-relative path from a {@link SourceFile}.
 *
 * @param input - The prepared two-side inspection.
 * @returns The populated project plus per-side source-file arrays.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildInMemoryProject(input: BuildInMemoryProjectInput): InMemoryProject {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const componentSources: SourceFile[] = [];
  const apiSources: SourceFile[] = [];
  for (const file of input.component.files) {
    componentSources.push(project.createSourceFile(`${COMPONENT_VIRTUAL_PREFIX}${file.relPath}`, file.text, { overwrite: true }));
  }
  for (const file of input.api.files) {
    apiSources.push(project.createSourceFile(`${API_VIRTUAL_PREFIX}${file.relPath}`, file.text, { overwrite: true }));
  }
  const result: InMemoryProject = { project, componentSources, apiSources };
  return result;
}

/**
 * Returns the api-relative path for a {@link SourceFile} created by
 * {@link buildInMemoryProject}, stripping both the `__api__/` and
 * `__component__/` virtual prefixes — the storagefile validator
 * inspects component files when the storage-file processing handler
 * lives under `notification/handlers/...`, so api-side extraction may
 * also walk component sources.
 *
 * @param sourceFile - Source file produced by {@link buildInMemoryProject}
 * @returns The original relPath supplied to {@link buildInMemoryProject}
 */
export function apiRelPath(sourceFile: SourceFile): string {
  return sourceFile
    .getFilePath()
    .replace(new RegExp(`^/${API_VIRTUAL_PREFIX}`), '')
    .replace(new RegExp(`^/${COMPONENT_VIRTUAL_PREFIX}`), '');
}

/**
 * Returns the component-relative path for a {@link SourceFile} created
 * by {@link buildInMemoryProject}, stripping only the `__component__/`
 * virtual prefix.
 *
 * @param sourceFile - Source file produced by {@link buildInMemoryProject}
 * @returns The original relPath supplied to {@link buildInMemoryProject}
 */
export function componentRelPath(sourceFile: SourceFile): string {
  return sourceFile.getFilePath().replace(new RegExp(`^/${COMPONENT_VIRTUAL_PREFIX}`), '');
}

// MARK: Pure node walkers
/**
 * Strips any number of `as` casts off a node and returns the inner
 * expression. Useful when extractors want to unwrap
 * `STATUS as StatusType` style declarations before pattern-matching.
 *
 * @param node - The node to unwrap.
 * @returns The innermost non-as expression, or `undefined` when the
 *   input was `undefined`
 */
export function unwrapAsExpressions(node: Node | undefined): Node | undefined {
  let current: Node | undefined = node;
  while (current && Node.isAsExpression(current)) {
    current = current.getExpression();
  }
  return current;
}

/**
 * Narrows a node to an {@link ObjectLiteralExpression} after stripping
 * `as` casts.
 *
 * @param node - The node to narrow.
 * @returns The unwrapped object literal, or `undefined` when the node
 *   does not resolve to one.
 */
export function asObjectLiteral(node: Node | undefined): ObjectLiteralExpression | undefined {
  const inner = unwrapAsExpressions(node);
  if (inner && Node.isObjectLiteralExpression(inner)) {
    return inner;
  }
  return undefined;
}

/**
 * Narrows a node to an {@link ArrayLiteralExpression} after stripping
 * `as` casts.
 *
 * @param node - The node to narrow.
 * @returns The unwrapped array literal, or `undefined` when the node
 *   does not resolve to one.
 */
export function asArrayLiteral(node: Node | undefined): ArrayLiteralExpression | undefined {
  const inner = unwrapAsExpressions(node);
  if (inner && Node.isArrayLiteralExpression(inner)) {
    return inner;
  }
  return undefined;
}

/**
 * Reads the string-literal initializer of a variable declaration,
 * tolerating an `as` cast around the literal.
 *
 * @param decl - The variable declaration to inspect.
 * @returns The literal text, or `undefined` when the declaration's
 *   initializer is missing or not a string literal.
 */
export function readStringLiteralInitializer(decl: VariableDeclaration): string | undefined {
  const initializer = unwrapAsExpressions(decl.getInitializer());
  if (initializer && Node.isStringLiteral(initializer)) {
    return initializer.getLiteralText();
  }
  return undefined;
}

/**
 * Returns the textual type annotation of a variable declaration,
 * matching how each validator stringifies the type for comparison
 * against domain-specific constants like `StorageFilePurpose`.
 *
 * @param node - The variable declaration to inspect.
 * @returns The annotation text, or `undefined` when the declaration
 *   has no explicit type node.
 */
export function typeAnnotationText(node: VariableDeclaration): string | undefined {
  const tn = node.getTypeNode();
  return tn ? tn.getText() : undefined;
}

/**
 * Returns the value-position node for a property by name on an object
 * literal, supporting both property assignments
 * (`{ name: value }`) and shorthand property assignments
 * (`{ name }` — the name node itself stands in for the value).
 *
 * @param obj - The object literal to inspect.
 * @param name - The property name to look up.
 * @returns The initializer/name node, or `undefined` when the property
 *   is absent or carries no recognisable value position.
 */
export function getPropertyInitializer(obj: ObjectLiteralExpression, name: string): Node | undefined {
  const prop = obj.getProperty(name);
  if (!prop) return undefined;
  if (Node.isPropertyAssignment(prop)) {
    return prop.getInitializer();
  }
  if (Node.isShorthandPropertyAssignment(prop)) {
    return prop.getNameNode();
  }
  return undefined;
}

/**
 * Reads the string-literal value of a property on an object literal,
 * tolerating an `as` cast around the literal.
 *
 * @param obj - The object literal to inspect.
 * @param name - The property name to look up.
 * @returns The literal text, or `undefined` when the property is
 *   missing or not a string literal.
 */
export function readStringProperty(obj: ObjectLiteralExpression, name: string): string | undefined {
  const init = unwrapAsExpressions(getPropertyInitializer(obj, name));
  if (init && Node.isStringLiteral(init)) {
    return init.getLiteralText();
  }
  return undefined;
}

/**
 * Reads the boolean-literal value of a property on an object literal,
 * tolerating an `as` cast around the literal.
 *
 * @param obj - The object literal to inspect.
 * @param name - The property name to look up.
 * @returns The boolean value, or `undefined` when the property is missing
 *   or is not a `true` / `false` literal.
 */
export function readBooleanProperty(obj: ObjectLiteralExpression, name: string): boolean | undefined {
  const init = unwrapAsExpressions(getPropertyInitializer(obj, name));
  let result: boolean | undefined;
  if (init?.getKind() === SyntaxKind.TrueKeyword) {
    result = true;
  } else if (init?.getKind() === SyntaxKind.FalseKeyword) {
    result = false;
  }
  return result;
}

/**
 * Reads the identifier-name value of a property on an object literal,
 * tolerating an `as` cast around the identifier.
 *
 * @param obj - The object literal to inspect.
 * @param name - The property name to look up.
 * @returns The identifier text, or `undefined` when the property is
 *   missing or does not resolve to an identifier.
 */
export function readIdentifierProperty(obj: ObjectLiteralExpression, name: string): string | undefined {
  const init = unwrapAsExpressions(getPropertyInitializer(obj, name));
  if (init && Node.isIdentifier(init)) {
    return init.getText();
  }
  return undefined;
}

/**
 * Walks a function-like node and returns its first return expression.
 *
 * - For block-bodied functions, returns the expression of the first
 *   `return` statement (or `undefined` when none is present).
 * - For concise arrow bodies (`() => expr`), returns the body itself.
 * - Returns `undefined` when {@link fn} is not a function/arrow node.
 *
 * @param fn - The function/arrow/method node.
 * @returns The return expression, or `undefined`
 */
export function findReturnExpression(fn: Node): Node | undefined {
  if (!Node.isArrowFunction(fn) && !Node.isFunctionDeclaration(fn) && !Node.isFunctionExpression(fn)) {
    return undefined;
  }
  const body = fn.getBody();
  if (!body) return undefined;
  if (Node.isBlock(body)) {
    for (const stmt of body.getStatements()) {
      if (Node.isReturnStatement(stmt)) {
        return stmt.getExpression();
      }
    }
    return undefined;
  }
  return body;
}

/**
 * Returns the first variable declaration named {@link name} in a
 * source file, scanning top-level statements first and then any
 * descendant declarations (function-scoped or block-scoped).
 *
 * @param sf - The source file to scan.
 * @param name - The variable name to match.
 * @returns The matching declaration, or `undefined` when none is found.
 */
export function findLocalVariable(sf: SourceFile, name: string): VariableDeclaration | undefined {
  for (const stmt of sf.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      if (decl.getName() === name) return decl;
    }
  }
  for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    if (decl.getName() === name) return decl;
  }
  return undefined;
}

/**
 * Resolves a call argument to an object literal — either the literal itself, or an identifier bound to a local
 * object-literal variable in the same source file.
 *
 * @param node - The argument node.
 * @param sf - The source file used to chase identifier indirection.
 * @returns The resolved object literal, or `undefined` when the argument is neither shape.
 */
export function resolveObjectLiteralArgument(node: Node | undefined, sf: SourceFile): ObjectLiteralExpression | undefined {
  const inner = unwrapAsExpressions(node);
  let result: ObjectLiteralExpression | undefined;
  if (inner && Node.isObjectLiteralExpression(inner)) {
    result = inner;
  } else if (inner && Node.isIdentifier(inner)) {
    result = asObjectLiteral(findLocalVariable(sf, inner.getText())?.getInitializer());
  }
  return result;
}

/**
 * Resolves an array-literal property on an object literal — either written inline (`validate: [...]`), or as an
 * identifier bound to a local array-literal variable in the same source file (`validate: foo`).
 *
 * @param obj - The object literal carrying the property.
 * @param name - The property name to resolve.
 * @param sf - The source file used to chase identifier indirection.
 * @returns The resolved array literal, or `undefined` when the property is missing or not an array.
 */
export function resolveArrayLiteralProperty(obj: ObjectLiteralExpression, name: string, sf: SourceFile): ArrayLiteralExpression | undefined {
  const init = unwrapAsExpressions(getPropertyInitializer(obj, name));
  let result: ArrayLiteralExpression | undefined;
  if (init && Node.isArrayLiteralExpression(init)) {
    result = init;
  } else if (init && Node.isIdentifier(init)) {
    result = asArrayLiteral(findLocalVariable(sf, init.getText())?.getInitializer());
  }
  return result;
}

/**
 * Which side of a {@link buildInMemoryProject} project a source file came from, read from its virtual path prefix.
 *
 * @param sf - A source file created by {@link buildInMemoryProject}.
 * @returns `'component'` for component files, otherwise `'api'`.
 */
export function sourceSideOf(sf: SourceFile): 'component' | 'api' {
  return sf.getFilePath().startsWith(`/${COMPONENT_VIRTUAL_PREFIX}`) ? 'component' : 'api';
}

/**
 * Pushes the names of every `typeof X` query inside a type node onto
 * {@link out}.
 *
 * @param node - The type node to walk.
 * @param out - The mutable buffer that receives the referenced names.
 */
export function collectTypeofReferences(node: TypeNode, out: string[]): void {
  if (Node.isTypeQuery(node)) {
    out.push(node.getExprName().getText());
    return;
  }
  for (const tq of node.getDescendantsOfKind(SyntaxKind.TypeQuery)) {
    out.push(tq.getExprName().getText());
  }
}

/**
 * Adds every named or namespace identifier from an `@dereekb/*` import declaration to {@link out}.
 *
 * @param imp - The import declaration to inspect.
 * @param out - Mutable set that accumulates trusted identifier names.
 */
function collectTrustedIdentifiersFromImport(imp: ImportDeclaration, out: Set<string>): void {
  const spec = imp.getModuleSpecifierValue();
  if (!spec.startsWith(DEREEKB_MODULE_PREFIX)) return;
  for (const named of imp.getNamedImports()) {
    const alias = named.getAliasNode();
    out.add(alias ? alias.getText() : named.getNameNode().getText());
  }
  const namespace = imp.getNamespaceImport();
  if (namespace) {
    out.add(namespace.getText());
  }
}

/**
 * Builds the trust-list of identifiers imported from `@dereekb/*`
 * packages across the supplied sources. Validators consult this set
 * to suppress "unresolved" / "orphan" diagnostics for symbols that
 * cross into upstream packages and cannot be traced locally.
 *
 * @param sources - The source files to scan.
 * @returns The set of trusted identifier names.
 */
export function collectTrustedExternalIdentifiers(sources: readonly SourceFile[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const sf of sources) {
    for (const imp of sf.getImportDeclarations()) {
      collectTrustedIdentifiersFromImport(imp, out);
    }
  }
  return out;
}

/**
 * Hop limit for {@link readCalleeName} following one local `const` to the next (`const a = x; const b = a; b(...)`).
 */
const MAX_LOCAL_CONST_HOPS = 4;

/**
 * One value binding of a name that a `const <name> = <reference>;` statement of the file declares
 * (see {@link DereekbImportBindings.localConstBindings}).
 */
export interface LocalConstBinding {
  /**
   * Where the binding is visible. Exact for the `const` statement: the block, module block, case block or source file
   * that holds it. Every other binding of the name (a `let` or `var`, parameter, binding element, function, class, enum,
   * namespace or import) is widened to its enclosing function, or the source file, so it can only block more.
   */
  readonly scope: Node;
  /**
   * The `const` statement's initializer, `as` casts unwrapped: an identifier, or `ns.member` with an identifier `ns`.
   * `undefined` for every other binding, which is never followed.
   */
  readonly reference: Identifier | PropertyAccessExpression | undefined;
}

/**
 * The `@dereekb/*` import aliases and namespace imports of one source file, plus the local `const` references that
 * point at them, used to read a call's callee back to the name the upstream package exports. Aliases and namespaces
 * whose local name the file also declares elsewhere (a parameter, variable, binding element, function, class, enum or
 * namespace) are left out: the scan can't tell which binding a reference means.
 */
export interface DereekbImportBindings {
  /**
   * `import { exported as local } from '@dereekb/...'`: local name → exported name. Plain named imports are left out,
   * since their local name already is the exported name.
   */
  readonly aliases: ReadonlyMap<string, string>;
  /**
   * `import * as local from '@dereekb/...'`: the local names.
   */
  readonly namespaces: ReadonlySet<string>;
  /**
   * The local `const` references {@link readCalleeName} follows, by name: each `const <name> = <reference>;` statement,
   * plus every other value binding of the same name in the file, which blocks it wherever its scope reaches. Names no
   * such `const` declares are left out.
   */
  readonly localConstBindings: ReadonlyMap<string, readonly LocalConstBinding[]>;
}

/**
 * The {@link DereekbImportBindings} of every source file of an in-memory project, by file path.
 */
export interface DereekbImportIndex {
  readonly bindingsByFilePath: ReadonlyMap<string, DereekbImportBindings>;
}

/**
 * Whether {@link identifier} is the name a declaration binds in value space: a variable (including catch-clause and loop
 * variables), parameter, binding element, function, class, enum or namespace. Imports are not counted.
 *
 * @param identifier - The identifier to check.
 * @returns `true` when the identifier is a declaration's name.
 */
function isValueDeclarationName(identifier: Node): boolean {
  const parent = identifier.getParent();
  let result: boolean;
  if (Node.isModuleDeclaration(parent)) {
    // ts-morph 28 has no getNameNode() here; a module declaration's only identifier children are its name segments
    result = true;
  } else {
    const isNamed = Node.isVariableDeclaration(parent) || Node.isParameterDeclaration(parent) || Node.isBindingElement(parent) || Node.isFunctionDeclaration(parent) || Node.isFunctionExpression(parent) || Node.isClassDeclaration(parent) || Node.isClassExpression(parent) || Node.isEnumDeclaration(parent);
    result = isNamed && parent.getNameNode() === identifier;
  }
  return result;
}

/**
 * Whether {@link identifier} is the local name an import binds: a named import (or its alias), a default import, a
 * namespace import or `import x = ...`.
 *
 * @param identifier - The identifier to check.
 * @returns `true` when the identifier is an import's local name.
 */
function isImportedName(identifier: Node): boolean {
  const parent = identifier.getParent();
  let result = false;
  if (Node.isImportSpecifier(parent)) {
    result = (parent.getAliasNode() ?? parent.getNameNode()) === identifier;
  } else if (Node.isImportClause(parent)) {
    result = parent.getDefaultImport() === identifier;
  } else if (Node.isNamespaceImport(parent) || Node.isImportEqualsDeclaration(parent)) {
    result = parent.getNameNode() === identifier;
  }
  return result;
}

/**
 * Reads the followable reference a `const` declaration holds: its initializer, `as` casts unwrapped, when that is an
 * identifier or `ns.member` with an identifier `ns`.
 *
 * @param decl - The declaration to read.
 * @returns The held reference, or `undefined` for any other initializer.
 */
function readHeldReference(decl: VariableDeclaration): Identifier | PropertyAccessExpression | undefined {
  const initializer = unwrapAsExpressions(decl.getInitializer());
  let result: Identifier | PropertyAccessExpression | undefined;
  if (Node.isIdentifier(initializer) || (Node.isPropertyAccessExpression(initializer) && Node.isIdentifier(initializer.getExpression()))) {
    result = initializer;
  }
  return result;
}

/**
 * Reads the local `const` references of a source file for {@link DereekbImportBindings.localConstBindings}.
 *
 * @param sf - The source file to read.
 * @returns Each followable `const` statement by name, with every other value binding the file declares for that name.
 */
function readLocalConstBindings(sf: SourceFile): Map<string, LocalConstBinding[]> {
  const bindings = new Map<string, LocalConstBinding[]>();
  const constDeclarations = new Set<Node>();
  for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const statement = decl.getVariableStatement(); // undefined for catch-clause and for-loop declarations
    const holder = statement?.getParent();
    const isBlockLike = Node.isBlock(holder) || Node.isSourceFile(holder) || Node.isModuleBlock(holder) || Node.isCaseClause(holder) || Node.isDefaultClause(holder);
    const reference = readHeldReference(decl);
    if (isBlockLike && statement?.getDeclarationKind() === VariableDeclarationKind.Const && Node.isIdentifier(decl.getNameNode()) && reference) {
      // a case clause's declarations are scoped to the whole case block
      const scope = Node.isCaseClause(holder) || Node.isDefaultClause(holder) ? holder.getParentOrThrow() : holder;
      const named = bindings.get(decl.getName()) ?? [];
      named.push({ scope, reference });
      bindings.set(decl.getName(), named);
      constDeclarations.add(decl);
    }
  }

  if (bindings.size > 0) {
    for (const identifier of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const declaration = identifier.getParentOrThrow();
      const named = bindings.get(identifier.getText());
      if (named && !constDeclarations.has(declaration) && (isValueDeclarationName(identifier) || isImportedName(identifier))) {
        named.push({ scope: declaration.getFirstAncestor((x) => Node.isFunctionLikeDeclaration(x) || Node.isFunctionExpression(x)) ?? sf, reference: undefined });
      }
    }
  }

  return bindings;
}

/**
 * Reads the `@dereekb/*` import aliases and namespace imports of a source file, leaving out every local name the file
 * also declares as a parameter, variable, binding element, function, class, enum or namespace, and the file's local
 * `const` references (see {@link DereekbImportBindings.localConstBindings}).
 *
 * @param sf - The source file to read.
 * @returns The file's resolvable `@dereekb/*` import bindings.
 */
export function readDereekbImportBindings(sf: SourceFile): DereekbImportBindings {
  const aliases = new Map<string, string>();
  const namespaces = new Set<string>();
  for (const imp of sf.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue().startsWith(DEREEKB_MODULE_PREFIX)) {
      for (const named of imp.getNamedImports()) {
        const alias = named.getAliasNode()?.getText();
        const exported = named.getName();
        if (alias && alias !== exported) {
          aliases.set(alias, exported);
        }
      }
      const namespace = imp.getNamespaceImport();
      if (namespace) {
        namespaces.add(namespace.getText());
      }
    }
  }

  // Shadow guard: a local declaration of the same name makes every reference ambiguous.
  if (aliases.size > 0 || namespaces.size > 0) {
    for (const identifier of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const name = identifier.getText();
      if ((aliases.has(name) || namespaces.has(name)) && isValueDeclarationName(identifier)) {
        aliases.delete(name);
        namespaces.delete(name);
      }
    }
  }

  const result: DereekbImportBindings = { aliases, namespaces, localConstBindings: readLocalConstBindings(sf) };
  return result;
}

/**
 * Builds the {@link DereekbImportIndex} of the supplied sources.
 *
 * @param sources - The source files to index.
 * @returns The per-file `@dereekb/*` import bindings.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildDereekbImportIndex(sources: readonly SourceFile[]): DereekbImportIndex {
  const bindingsByFilePath = new Map<string, DereekbImportBindings>();
  for (const sf of sources) {
    bindingsByFilePath.set(sf.getFilePath(), readDereekbImportBindings(sf));
  }
  const result: DereekbImportIndex = { bindingsByFilePath };
  return result;
}

/**
 * Reads the name a call's callee refers to. An identifier bound to a local `const` that holds a reference
 * (`const create = sfHandler;`) reads as that reference does, when the `const` is the only binding of the name in scope
 * at the call; chains are followed up to {@link MAX_LOCAL_CONST_HOPS} hops. An identifier that is an `@dereekb/*`
 * import alias reads as the exported name; any other identifier reads as written (the validators' exact-name
 * convention), including one bound to a `let`, a parameter or a shadowed `const`. `ns.name` reads as `name` when `ns`
 * is an `@dereekb/*` namespace import of the call's file. Anything else (`obj.fn(...)`, `fn(...)(...)`, a namespace or
 * alias the file shadows, a namespace of another module) reads as `undefined`.
 *
 * @param call - The call expression to read.
 * @param imports - The per-file `@dereekb/*` import bindings.
 * @returns The resolved callee name, or `undefined` when the callee isn't a resolvable name.
 */
export function readCalleeName(call: CallExpression, imports: DereekbImportIndex): string | undefined {
  return readReferenceName(call.getExpression(), imports.bindingsByFilePath.get(call.getSourceFile().getFilePath()), 0);
}

/**
 * Reads the name {@link node} refers to, for {@link readCalleeName}.
 *
 * @param node - A callee, or the reference a followed local `const` holds.
 * @param bindings - The bindings of the node's file.
 * @param hops - How many local `const`s were followed to get here.
 * @returns The resolved name, or `undefined` when {@link node} isn't a resolvable name.
 */
function readReferenceName(node: Node, bindings: DereekbImportBindings | undefined, hops: number): string | undefined {
  let result: string | undefined;
  if (Node.isIdentifier(node)) {
    const name = node.getText();
    const visible = hops < MAX_LOCAL_CONST_HOPS ? (bindings?.localConstBindings.get(name) ?? []).filter((x) => x.scope.getPos() <= node.getPos() && node.getEnd() <= x.scope.getEnd()) : [];
    const held = visible.length === 1 ? visible[0].reference : undefined;
    result = held ? readReferenceName(held, bindings, hops + 1) : (bindings?.aliases.get(name) ?? name);
  } else if (Node.isPropertyAccessExpression(node)) {
    const target = node.getExpression();
    if (Node.isIdentifier(target) && bindings?.namespaces.has(target.getText())) {
      result = node.getName();
    }
  }
  return result;
}
