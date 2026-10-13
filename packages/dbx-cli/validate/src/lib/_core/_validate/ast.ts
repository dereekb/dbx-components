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

import { Node, Project, SyntaxKind, VariableDeclarationKind, type ArrayLiteralExpression, type CallExpression, type Identifier, type ImportDeclaration, type ObjectLiteralExpression, type PropertyAccessExpression, type SourceFile, type TypeNode, type VariableDeclaration, type VariableStatement } from 'ts-morph';
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
 * It ignores scope: with two declarations of the name it returns whichever comes first. {@link resolveLocalVariable}
 * resolves a reference to the declaration in scope where it sits.
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
 * Whether a module specifier names an `@dereekb/*` package.
 *
 * @param specifier - The module specifier, e.g. `'@dereekb/firebase'`.
 * @returns `true` for an `@dereekb/*` package.
 */
export function isDereekbModuleSpecifier(specifier: string): boolean {
  return specifier.startsWith(DEREEKB_MODULE_PREFIX);
}

/**
 * An identifier read as the unaliased named import that binds it (`import { NAME } from 'module'`).
 */
export interface ImportedIdentifier {
  /**
   * The identifier, which is also the name the module exports.
   */
  readonly name: string;
  /**
   * The import's module specifier.
   */
  readonly moduleSpecifier: string;
}

/**
 * Reads a value node, after stripping `as` casts, as an identifier its source file binds with an unaliased value import:
 * `import { NAME } from 'module'`. Anything else reads as `undefined`:
 * - a node that is not an identifier, or a name the file doesn't import;
 * - an aliased (`import { x as NAME }`), type-only, default or namespace import;
 * - a name the file also declares as a value (a variable, parameter, binding element, function, class, enum or
 *   namespace), which could shadow the import where the node sits.
 *
 * @param node - The value node, e.g. a property initializer.
 * @returns The identifier and its module, or `undefined`.
 */
export function readImportedIdentifier(node: Node | undefined): ImportedIdentifier | undefined {
  const inner = unwrapAsExpressions(node);
  let result: ImportedIdentifier | undefined;
  if (inner !== undefined && Node.isIdentifier(inner)) {
    const name = inner.getText();
    const sf = inner.getSourceFile();
    const declaration = sf.getImportDeclarations().find((imp) => !imp.isTypeOnly() && imp.getNamedImports().some((x) => !x.isTypeOnly() && x.getAliasNode() === undefined && x.getName() === name));
    const shadowed = declaration !== undefined && sf.getDescendantsOfKind(SyntaxKind.Identifier).some((x) => x.getText() === name && isValueDeclarationName(x));
    if (declaration !== undefined && !shadowed) {
      result = { name, moduleSpecifier: declaration.getModuleSpecifierValue() };
    }
  }
  return result;
}

/**
 * Hop limit for {@link readCalleeName} following one local `const` to the next (`const a = x; const b = a; b(...)`).
 */
const MAX_LOCAL_CONST_HOPS = 4;

/**
 * One binding of a name {@link readCalleeName} and {@link readTypeReferenceName} can read through (see
 * {@link DereekbImportBindings.localBindings}): an `@dereekb/*` import alias or namespace import, a
 * `const <name> = <reference>;` statement, or any other binding of the same name, which only blocks. A reference reads
 * through a binding only when that binding is the only one of its name whose scope contains the reference.
 */
export interface LocalBinding {
  /**
   * Where the binding is visible. Exact for an `@dereekb/*` import (the source file) and for the `const` statement (the
   * block, module block, case block or source file that holds it). Every other binding of the name (a `let` or `var`,
   * parameter, binding element, function, class, enum, namespace, other import, type parameter, type alias or
   * interface) is widened to its enclosing function, or the source file, so it can only block more.
   */
  readonly scope: Node;
  /**
   * `import { exportedName as <name> } from '@dereekb/...'`: the name the upstream package exports.
   */
  readonly exportedName?: string;
  /**
   * `import * as <name> from '@dereekb/...'`: `<name>.member` reads as `member`.
   */
  readonly namespace?: boolean;
  /**
   * The `const` statement's initializer, `as` casts unwrapped: an identifier, or `ns.member` with an identifier `ns`.
   */
  readonly reference?: Identifier | PropertyAccessExpression;
  /**
   * Set for a type parameter, type alias or interface: it blocks type references only, so a callee still resolves.
   */
  readonly typeOnly?: boolean;
}

/**
 * One value binding of a name that a variable statement of the file declares (see
 * {@link DereekbImportBindings.localVariableBindings}), for {@link resolveLocalVariable}.
 */
export interface LocalVariableBinding {
  /**
   * Where the binding is visible. Exact for the variable statement: a `const`, `let` or `using` is visible in the block,
   * module block, case block or source file that holds it, a `var` in its function or the source file. Every other binding
   * of the name (a parameter, binding element, catch-clause or loop variable, function, class, enum, namespace or import)
   * is widened to its enclosing function, or the source file, so it can only block more.
   */
  readonly scope: Node;
  /**
   * The variable statement's declaration of a plain identifier, which a reference can resolve to. `undefined` for every
   * other binding, which only blocks.
   */
  readonly declaration: VariableDeclaration | undefined;
}

/**
 * How {@link resolveLocalVariable} reads a reference:
 * - `variable`: the one binding of its name in scope there is a variable statement's declaration, and the reference means it;
 * - `ambiguous`: more than one binding of its name is in scope there, so the scan can't tell which one it means;
 * - `none`: no binding of its name is in scope there, or the one that is can't be followed (a parameter, binding element,
 *   catch-clause or loop variable, function, class, enum, namespace or import).
 */
export type LocalVariableResolution = { readonly kind: 'variable'; readonly declaration: VariableDeclaration } | { readonly kind: 'ambiguous' } | { readonly kind: 'none' };

/**
 * The `@dereekb/*` import aliases and namespace imports of one source file, plus the local `const` references that
 * point at them, used to read a call's callee, or a type annotation, back to the name the upstream package exports, and
 * the local variable bindings {@link resolveLocalVariable} resolves references against.
 */
export interface DereekbImportBindings {
  /**
   * The bindings {@link readCalleeName} and {@link readTypeReferenceName} read through, by name: each `@dereekb/*`
   * import alias (`import { exported as local }`; a plain named import is left out, since its local name already is the
   * exported name), each `@dereekb/*` namespace import (`import * as local`) and each `const <name> = <reference>;`
   * statement, plus every other binding of the same name in the file, which blocks them wherever its scope reaches.
   * Names none of those declare are left out.
   */
  readonly localBindings: ReadonlyMap<string, readonly LocalBinding[]>;
  /**
   * The variable declarations {@link resolveLocalVariable} resolves references to, by name: each variable statement's
   * declaration of a plain identifier, plus every other value binding of the same name in the file, which blocks it
   * wherever its scope reaches. Names no variable statement declares are left out.
   */
  readonly localVariableBindings: ReadonlyMap<string, readonly LocalVariableBinding[]>;
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
 * Whether {@link identifier} is the name a declaration binds in type space only: a type parameter, type alias or
 * interface. Classes, enums and namespaces also bind a type, but {@link isValueDeclarationName} already counts them.
 *
 * @param identifier - The identifier to check.
 * @returns `true` when the identifier is a type-only declaration's name.
 */
function isTypeDeclarationName(identifier: Node): boolean {
  const parent = identifier.getParent();
  const isNamed = Node.isTypeParameterDeclaration(parent) || Node.isTypeAliasDeclaration(parent) || Node.isInterfaceDeclaration(parent);
  return isNamed && parent.getNameNode() === identifier;
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
 * Where the bindings of a `const`, `let` or `using` statement are visible: the block, module block, case block or source
 * file that holds it.
 *
 * @param statement - The variable statement.
 * @returns The scope, or `undefined` when the statement sits anywhere else (only a `var` can).
 */
function lexicalScopeOf(statement: VariableStatement): Node | undefined {
  const holder = statement.getParent();
  let result: Node | undefined;
  if (Node.isCaseClause(holder) || Node.isDefaultClause(holder)) {
    result = holder.getParentOrThrow(); // a case clause's declarations are scoped to the whole case block
  } else if (Node.isBlock(holder) || Node.isSourceFile(holder) || Node.isModuleBlock(holder)) {
    result = holder;
  }
  return result;
}

/**
 * The function around {@link node}, or its source file: the real scope of a `var` or a parameter, and the scope every other
 * binding the scope readers can't place exactly is widened to, so it can only block more.
 *
 * @param node - A declaration.
 * @returns The nearest enclosing function (arrow function, method, accessor, constructor, function declaration or
 *   function expression), or the source file.
 */
function functionScopeOf(node: Node): Node {
  // ts-morph 28's isFunctionLikeDeclaration does not cover FunctionExpression
  return node.getFirstAncestor((x) => Node.isFunctionLikeDeclaration(x) || Node.isFunctionExpression(x)) ?? node.getSourceFile();
}

/**
 * Whether {@link node} sits inside {@link scope}.
 *
 * @param node - A reference.
 * @param scope - A binding's scope.
 * @returns `true` when the scope contains the node.
 */
function isWithinScope(node: Node, scope: Node): boolean {
  return scope.getPos() <= node.getPos() && node.getEnd() <= scope.getEnd();
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
 * Reads the followable binding a `const <name> = <reference>;` declaration adds to
 * {@link DereekbImportBindings.localBindings}.
 *
 * @param decl - The declaration to read.
 * @returns The binding, scoped to the block, module block, case block or source file that holds the statement, or
 *   `undefined` for any other declaration (a `let` or `var`, a catch-clause, for-loop or destructured declaration, or an
 *   initializer that is not a followable reference).
 */
function readConstBinding(decl: VariableDeclaration): LocalBinding | undefined {
  const statement = decl.getVariableStatement(); // undefined for catch-clause and for-loop declarations
  const scope = statement?.getDeclarationKind() === VariableDeclarationKind.Const ? lexicalScopeOf(statement) : undefined;
  const reference = readHeldReference(decl);
  let result: LocalBinding | undefined;
  if (scope && Node.isIdentifier(decl.getNameNode()) && reference) {
    result = { scope, reference };
  }
  return result;
}

/**
 * Reads the blocking binding a declaration's name adds to {@link DereekbImportBindings.localBindings}, its scope widened
 * to the enclosing function or the source file.
 *
 * @param identifier - The identifier to read.
 * @returns A value binding, a type-only binding (a type parameter, type alias or interface), or `undefined` when the
 *   identifier is not a declaration's name.
 */
function readBlockingBinding(identifier: Identifier): LocalBinding | undefined {
  const isValueBinding = isValueDeclarationName(identifier) || isImportedName(identifier);
  let result: LocalBinding | undefined;
  if (isValueBinding || isTypeDeclarationName(identifier)) {
    result = { scope: functionScopeOf(identifier.getParentOrThrow()), typeOnly: !isValueBinding };
  }
  return result;
}

/**
 * Reads the bindings of a source file for {@link DereekbImportBindings.localBindings}.
 *
 * @param sf - The source file to read.
 * @returns Each `@dereekb/*` import alias, namespace import and followable `const` statement by name, with every other
 *   binding the file declares for that name.
 */
function readLocalBindings(sf: SourceFile): Map<string, LocalBinding[]> {
  const bindings = new Map<string, LocalBinding[]>();
  const resolvable = new Set<Node>(); // the declarations recorded below; the blocking pass skips them
  const addResolvable = (name: string, declaration: Node, binding: LocalBinding) => {
    const named = bindings.get(name) ?? [];
    named.push(binding);
    bindings.set(name, named);
    resolvable.add(declaration);
  };

  for (const imp of sf.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue().startsWith(DEREEKB_MODULE_PREFIX)) {
      for (const named of imp.getNamedImports()) {
        const alias = named.getAliasNode()?.getText();
        const exportedName = named.getName();
        if (alias && alias !== exportedName) {
          addResolvable(alias, named, { scope: sf, exportedName });
        }
      }
      const namespace = imp.getNamespaceImport();
      if (namespace) {
        addResolvable(namespace.getText(), namespace.getParentOrThrow(), { scope: sf, namespace: true });
      }
    }
  }

  for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const binding = readConstBinding(decl);
    if (binding) {
      addResolvable(decl.getName(), decl, binding);
    }
  }

  if (bindings.size > 0) {
    for (const identifier of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const named = bindings.get(identifier.getText());
      const blocking = named && !resolvable.has(identifier.getParentOrThrow()) ? readBlockingBinding(identifier) : undefined;
      if (named && blocking) {
        named.push(blocking);
      }
    }
  }

  return bindings;
}

/**
 * Reads the variable bindings of a source file for {@link DereekbImportBindings.localVariableBindings}.
 *
 * @param sf - The source file to read.
 * @returns Each variable statement's declaration of a plain identifier by name, with every other value binding the file
 *   declares for that name.
 */
function readLocalVariableBindings(sf: SourceFile): Map<string, LocalVariableBinding[]> {
  const bindings = new Map<string, LocalVariableBinding[]>();
  const declarations = new Set<Node>(); // the declarations recorded below; the blocking pass skips them
  for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const statement = decl.getVariableStatement(); // undefined for catch-clause and for-loop declarations
    let scope: Node | undefined;
    if (statement?.getDeclarationKind() === VariableDeclarationKind.Var) {
      scope = functionScopeOf(decl);
    } else if (statement) {
      scope = lexicalScopeOf(statement);
    }
    if (scope && Node.isIdentifier(decl.getNameNode())) {
      const named = bindings.get(decl.getName()) ?? [];
      named.push({ scope, declaration: decl });
      bindings.set(decl.getName(), named);
      declarations.add(decl);
    }
  }

  if (bindings.size > 0) {
    for (const identifier of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const declaration = identifier.getParentOrThrow();
      const named = bindings.get(identifier.getText());
      if (named && !declarations.has(declaration) && (isValueDeclarationName(identifier) || isImportedName(identifier))) {
        named.push({ scope: functionScopeOf(declaration), declaration: undefined });
      }
    }
  }

  return bindings;
}

/**
 * Reads the `@dereekb/*` import aliases and namespace imports of a source file and its local `const` references, each
 * with every other binding of its name (see {@link DereekbImportBindings.localBindings}), and the file's local variable
 * bindings (see {@link DereekbImportBindings.localVariableBindings}).
 *
 * @param sf - The source file to read.
 * @returns The file's `@dereekb/*` import bindings.
 */
export function readDereekbImportBindings(sf: SourceFile): DereekbImportBindings {
  const result: DereekbImportBindings = { localBindings: readLocalBindings(sf), localVariableBindings: readLocalVariableBindings(sf) };
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
 * Reads the name a call's callee refers to. A name reads through one of its file's bindings
 * ({@link DereekbImportBindings.localBindings}) only when that binding is the only one of the name in scope there:
 * - an identifier bound to an `@dereekb/*` import alias reads as the exported name;
 * - `ns.name` reads as `name` when `ns` is bound to an `@dereekb/*` namespace import;
 * - an identifier bound to a local `const` that holds a reference (`const create = sfHandler;`) reads as that reference
 *   does, read where the `const` holds it; chains are followed up to {@link MAX_LOCAL_CONST_HOPS} hops.
 *
 * Any other identifier reads as written (the validators' exact-name convention), including one bound to a `let`, a
 * parameter, or an alias or `const` with another binding of its name in scope. Anything else (`obj.fn(...)`,
 * `fn(...)(...)`, a namespace with another binding of its name in scope, a namespace of another module) reads as
 * `undefined`. Type parameters, type aliases and interfaces don't count as bindings here.
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
    const binding = findVisibleBinding(node, bindings, 'value');
    result = binding?.reference && hops < MAX_LOCAL_CONST_HOPS ? readReferenceName(binding.reference, bindings, hops + 1) : (binding?.exportedName ?? node.getText());
  } else if (Node.isPropertyAccessExpression(node)) {
    const target = node.getExpression();
    if (Node.isIdentifier(target) && findVisibleBinding(target, bindings, 'value')?.namespace) {
      result = node.getName();
    }
  }
  return result;
}

/**
 * Returns the binding {@link identifier} reads through: the one binding of its name whose scope contains it. A callee
 * (`'value'`) ignores type-only bindings; a type reference (`'type'`) counts every binding.
 *
 * @param identifier - A reference.
 * @param bindings - The bindings of the reference's file.
 * @param space - Whether the reference is a callee or a type reference.
 * @returns The binding, or `undefined` when no binding or more than one binding of the name is in scope there.
 */
function findVisibleBinding(identifier: Identifier, bindings: DereekbImportBindings | undefined, space: 'value' | 'type'): LocalBinding | undefined {
  const visible = (bindings?.localBindings.get(identifier.getText()) ?? []).filter((x) => (space === 'type' || !x.typeOnly) && isWithinScope(identifier, x.scope));
  return visible.length === 1 ? visible[0] : undefined;
}

/**
 * Resolves {@link reference} to the variable declaration it means: the one binding of its name in scope where it sits
 * (see {@link LocalVariableBinding.scope}). Same file only. Unlike {@link findLocalVariable}, which returns the first
 * declaration of the name anywhere in the file, two functions that each declare the name read their own; a name with more
 * than one declaration in scope reads as `ambiguous`, never as a guess.
 *
 * @param reference - An identifier in value position.
 * @param imports - The per-file bindings.
 * @returns The resolution.
 */
export function resolveLocalVariable(reference: Identifier, imports: DereekbImportIndex): LocalVariableResolution {
  const bindings = imports.bindingsByFilePath.get(reference.getSourceFile().getFilePath())?.localVariableBindings.get(reference.getText()) ?? [];
  const visible = bindings.filter((x) => isWithinScope(reference, x.scope));
  const declaration = visible.length === 1 ? visible[0].declaration : undefined;
  let result: LocalVariableResolution;
  if (visible.length > 1) {
    result = { kind: 'ambiguous' };
  } else if (declaration) {
    result = { kind: 'variable', declaration };
  } else {
    result = { kind: 'none' };
  }
  return result;
}

/**
 * Reads the name a type reference refers to: the type-position counterpart of {@link readCalleeName}. A name reads
 * through one of its file's bindings ({@link DereekbImportBindings.localBindings}) only when that binding is the only
 * one of the name in scope there, counting type parameters, type aliases and interfaces too: an identifier bound to an
 * `@dereekb/*` import alias reads as the exported name, and `ns.Name` reads as `Name` when `ns` is bound to an
 * `@dereekb/*` namespace import. Any other identifier reads as written (the validators' exact-name convention). Type
 * arguments don't change the name (`Cfg<D, S>` reads as `Cfg` does). Anything else (a deeper qualified name, a
 * namespace with another binding of its name in scope, a namespace of another module, a type that is not a reference)
 * reads as `undefined`.
 *
 * @param node - The type node to read, usually a declaration's `getTypeNode()`.
 * @param imports - The per-file `@dereekb/*` import bindings.
 * @returns The resolved type name, or `undefined` when the node isn't a resolvable type reference.
 */
export function readTypeReferenceName(node: Node | undefined, imports: DereekbImportIndex): string | undefined {
  let result: string | undefined;
  if (node && Node.isTypeReference(node)) {
    const bindings = imports.bindingsByFilePath.get(node.getSourceFile().getFilePath());
    const typeName = node.getTypeName();
    if (Node.isIdentifier(typeName)) {
      result = findVisibleBinding(typeName, bindings, 'type')?.exportedName ?? typeName.getText();
    } else {
      const left = typeName.getLeft();
      if (Node.isIdentifier(left) && findVisibleBinding(left, bindings, 'type')?.namespace) {
        result = typeName.getRight().getText();
      }
    }
  }
  return result;
}

/**
 * The generic array types {@link readArrayElementTypeNode} reads.
 */
const ARRAY_TYPE_NAMES: ReadonlySet<string> = new Set(['Array', 'ReadonlyArray']);

/**
 * Returns the element type node of an array type: `T[]`, `readonly T[]`, `Array<T>` or `ReadonlyArray<T>`.
 *
 * @param node - The type node to read, usually a declaration's `getTypeNode()`.
 * @returns The element type node, or `undefined` when the node is not one of those array forms.
 */
export function readArrayElementTypeNode(node: Node | undefined): TypeNode | undefined {
  const inner = node && Node.isTypeOperatorTypeNode(node) && node.getOperator() === SyntaxKind.ReadonlyKeyword ? node.getTypeNode() : node;
  let result: TypeNode | undefined;
  if (inner && Node.isArrayTypeNode(inner)) {
    result = inner.getElementTypeNode();
  } else if (inner && Node.isTypeReference(inner)) {
    const typeName = inner.getTypeName();
    const typeArguments = inner.getTypeArguments();
    if (Node.isIdentifier(typeName) && ARRAY_TYPE_NAMES.has(typeName.getText()) && typeArguments.length === 1) {
      result = typeArguments[0];
    }
  }
  return result;
}
