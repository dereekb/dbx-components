/**
 * Shared ts-morph leaf helpers and in-memory project builder used by
 * the two-side validate-app extractors
 * (`storagefile-m-validate-app/extract.ts`,
 * `notification-m-validate-app/extract.ts`) and the handler walk of
 * `model-api-validate-app/extract-handlers.ts`.
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

import { posix } from 'node:path';
import {
  Node,
  Project,
  SyntaxKind,
  VariableDeclarationKind,
  type ArrayLiteralExpression,
  type CallExpression,
  type FunctionDeclaration,
  type Identifier,
  type ImportClause,
  type ImportDeclaration,
  type ImportSpecifier,
  type ObjectLiteralElementLike,
  type ObjectLiteralExpression,
  type PropertyAccessExpression,
  type SourceFile,
  type TypeNode,
  type VariableDeclaration,
  type VariableStatement
} from 'ts-morph';
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
 * {@link unwrapOuterExpressions} also strips parentheses, `<T>` casts,
 * `satisfies` and `!`.
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
 * Strips every wrapper that leaves an expression's runtime value unchanged, any number of times and in any order:
 * parentheses, `as` and `<T>` casts, `satisfies` checks and `!` non-null assertions. {@link unwrapAsExpressions} strips
 * `as` casts only.
 *
 * @param node - The node to unwrap.
 * @returns The innermost expression, or `undefined` when the input was `undefined`.
 */
export function unwrapOuterExpressions(node: Node): Node;
export function unwrapOuterExpressions(node: Node | undefined): Node | undefined;
export function unwrapOuterExpressions(node: Node | undefined): Node | undefined {
  let current: Node | undefined = node;
  while (current && (Node.isAsExpression(current) || Node.isSatisfiesExpression(current) || Node.isTypeAssertion(current) || Node.isParenthesizedExpression(current) || Node.isNonNullExpression(current))) {
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
 * How {@link readStaticProperty} reads a property of an object literal:
 * - `found`: the property's value node (an initializer, or a shorthand's name node);
 * - `absent`: the literal has no property of the name, and no spread or computed key that could supply one;
 * - `unknown`: a spread or computed key after the property (or anywhere, when there is no explicit property) may supply
 *   or replace it, or the name is a method or accessor.
 */
export type StaticPropertyRead = { readonly kind: 'found'; readonly value: Node } | { readonly kind: 'absent' } | { readonly kind: 'unknown' };

/**
 * Reads a property of an object literal the way the runtime builds the object: the **last** property of the name wins,
 * and a spread or computed key after it may supply or replace it. The spread-aware counterpart of
 * {@link getPropertyInitializer}, which can't tell "absent" from "may come from a spread". Names written as
 * identifiers, string literals or numeric literals match.
 *
 * @param obj - The object literal to read.
 * @param name - The property name to look up.
 * @returns The read: `found` with the value node, `absent` or `unknown`.
 */
export function readStaticProperty(obj: ObjectLiteralExpression, name: string): StaticPropertyRead {
  let result: StaticPropertyRead = { kind: 'absent' };
  for (const property of obj.getProperties()) {
    const propertyName = readStaticPropertyName(property);
    if (propertyName === undefined) {
      result = { kind: 'unknown' };
    } else if (propertyName === name) {
      result = readStaticPropertyValue(property);
    }
  }
  return result;
}

/**
 * Reads the static name of an object literal member.
 *
 * @param property - The member.
 * @returns The name, or `undefined` for a spread or a computed key.
 */
function readStaticPropertyName(property: ObjectLiteralElementLike): string | undefined {
  const nameNode = Node.isSpreadAssignment(property) ? undefined : property.getNameNode();
  let result: string | undefined;
  if (nameNode && Node.isIdentifier(nameNode)) {
    result = nameNode.getText();
  } else if (nameNode && (Node.isStringLiteral(nameNode) || Node.isNoSubstitutionTemplateLiteral(nameNode) || Node.isNumericLiteral(nameNode))) {
    result = nameNode.getLiteralText();
  }
  return result;
}

/**
 * Reads the value of a statically named object literal member, for {@link readStaticProperty}.
 *
 * @param property - The member.
 * @returns `found` for a property assignment or shorthand, `unknown` for a method or accessor.
 */
function readStaticPropertyValue(property: ObjectLiteralElementLike): StaticPropertyRead {
  let result: StaticPropertyRead = { kind: 'unknown' };
  if (Node.isPropertyAssignment(property)) {
    const value = property.getInitializer();
    result = value ? { kind: 'found', value } : { kind: 'unknown' };
  } else if (Node.isShorthandPropertyAssignment(property)) {
    result = { kind: 'found', value: property.getNameNode() };
  }
  return result;
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
 * Returns the one value a function returns, when it returns from one place only: a concise arrow body, or the expression
 * of the body's only `return` statement (nested functions aside) when that statement is one of the body's own statements.
 * Unlike {@link findReturnExpression}, which reads the first `return` among the body's own statements, a function that
 * can return from more than one place, or only from inside a branch, reads as `undefined`: its value depends on which
 * `return` runs.
 *
 * @param fn - The function/arrow node.
 * @returns The returned expression, or `undefined`.
 */
export function findSoleReturnExpression(fn: Node): Node | undefined {
  let result: Node | undefined;
  if (Node.isArrowFunction(fn) || Node.isFunctionDeclaration(fn) || Node.isFunctionExpression(fn)) {
    const body = fn.getBody();
    if (Node.isBlock(body)) {
      const returns = body.getDescendantsOfKind(SyntaxKind.ReturnStatement).filter((x) => functionScopeOf(x) === fn);
      result = returns.length === 1 && returns[0].getParent() === body ? returns[0].getExpression() : undefined;
    } else {
      result = body;
    }
  }
  return result;
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
 * A value read back to the import that binds it (see {@link readImportedReference}).
 */
export interface ImportedReference {
  /**
   * The name the module exports: the named import's name (`ALL_NOTIFICATION_TASK_TYPES` for
   * `import { ALL_NOTIFICATION_TASK_TYPES as TASK_TYPES }`), or the namespace member's.
   */
  readonly name: string;
  /**
   * The import's module specifier.
   */
  readonly moduleSpecifier: string;
  /**
   * How the source file refers to the import, valid anywhere in the file: the import's local name (`TASK_TYPES`), or the
   * namespace member (`demoFirebase.ALL_NOTIFICATION_TASK_TYPES`).
   */
  readonly text: string;
}

/**
 * Reads a value node back to the value import that binds it. `as` casts are stripped, and a local `const` holding a
 * reference (`const validate = ALL_NOTIFICATION_TASK_TYPES;`) is followed, chains up to {@link MAX_LOCAL_CONST_HOPS} hops,
 * as long as that `const` is the only binding of its name in scope where the value sits
 * ({@link DereekbImportBindings.localBindings}, the rule {@link readCalleeName} follows). It then reads:
 * - an identifier its file binds with a named import, unaliased or aliased: `import { NAME } from 'module'`, or
 *   `import { NAME as LOCAL } from 'module'` read as `NAME`;
 * - `ns.NAME` with `ns` bound by a namespace import, `import * as ns from 'module'`, read as `NAME`.
 *
 * Anything else reads as `undefined`: another kind of value; a name the file doesn't import; a type-only or default import;
 * and an import whose local name (`LOCAL`, `ns`) the file also declares as a value anywhere (a variable, parameter, binding
 * element, function, class, enum or namespace), which could shadow it where the value sits.
 *
 * @param node - The value node, e.g. a property initializer.
 * @param imports - The per-file bindings, for the local `const` follow.
 * @returns The import's exported name, its module and the file's text for it, or `undefined`.
 */
export function readImportedReference(node: Node | undefined, imports: DereekbImportIndex): ImportedReference | undefined {
  const inner = unwrapAsExpressions(node);
  const target = inner ? followLocalConstReference(inner, imports.bindingsByFilePath.get(inner.getSourceFile().getFilePath()), 0) : undefined;
  let result: ImportedReference | undefined;
  if (target && Node.isIdentifier(target)) {
    const local = target.getText();
    const declaration = target
      .getSourceFile()
      .getImportDeclarations()
      .find((imp) => !imp.isTypeOnly() && findNamedValueImport(imp, local));
    const specifier = declaration ? findNamedValueImport(declaration, local) : undefined;
    if (declaration && specifier && !isDeclaredValueName(target.getSourceFile(), local)) {
      result = { name: specifier.getName(), moduleSpecifier: declaration.getModuleSpecifierValue(), text: local };
    }
  } else if (target && Node.isPropertyAccessExpression(target) && Node.isIdentifier(target.getExpression())) {
    const ns = target.getExpression().getText();
    const declaration = target
      .getSourceFile()
      .getImportDeclarations()
      .find((imp) => !imp.isTypeOnly() && imp.getNamespaceImport()?.getText() === ns);
    if (declaration && !isDeclaredValueName(target.getSourceFile(), ns)) {
      result = { name: target.getName(), moduleSpecifier: declaration.getModuleSpecifierValue(), text: `${ns}.${target.getName()}` };
    }
  }
  return result;
}

/**
 * Finds the named value import of {@link imp} whose local name is {@link local}, for {@link readImportedReference}.
 *
 * @param imp - An import declaration.
 * @param local - The local name: the alias, or the name for an unaliased import.
 * @returns The import specifier, or `undefined` when none binds that name or the one that does is type-only.
 */
function findNamedValueImport(imp: ImportDeclaration, local: string): ImportSpecifier | undefined {
  return imp.getNamedImports().find((x) => !x.isTypeOnly() && (x.getAliasNode()?.getText() ?? x.getName()) === local);
}

/**
 * Whether {@link sf} declares {@link name} as a value anywhere (see {@link isValueDeclarationName}), for the shadow guard of
 * {@link readImportedReference}.
 *
 * @param sf - The source file.
 * @param name - The name.
 * @returns `true` when a declaration of the name exists.
 */
function isDeclaredValueName(sf: SourceFile, name: string): boolean {
  return sf.getDescendantsOfKind(SyntaxKind.Identifier).some((x) => x.getText() === name && isValueDeclarationName(x));
}

/**
 * Hop limit for {@link readCalleeName} and {@link readImportedReference} following one local `const` to the next
 * (`const a = x; const b = a; b(...)`).
 */
const MAX_LOCAL_CONST_HOPS = 4;

/**
 * One binding of a name {@link readCalleeName} and {@link readTypeReferenceName} can read through, and
 * {@link readImportedReference} follows `const`s through (see {@link DereekbImportBindings.localBindings}): an
 * `@dereekb/*` import alias or namespace import, a `const <name> = <reference>;` statement, or any other binding of the
 * same name, which only blocks. A reference reads through a binding only when that binding is the only one of its name
 * whose scope contains the reference.
 */
export interface LocalBinding {
  /**
   * Where the binding is visible. Exact for an `@dereekb/*` import (the source file), the `const` statement (the block,
   * module block, case block or source file that holds it), a parameter (its function or signature) and a function- or
   * class-expression name (the expression). Every other binding of the name (a `let`, `var` or other `const`, binding
   * element, function, class, enum, namespace, other import, type parameter, type alias or interface) is widened to its
   * enclosing function, the `namespace` body that holds it unless the namespace exports it, or the source file, so it can
   * only block more.
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
 * A declaration {@link resolveLocalValue} can resolve a reference to: a variable statement's declaration of a plain
 * identifier, a top-level function declaration with a body, or a value import: named (its `ImportSpecifier`) or default
 * (its `ImportClause`).
 */
export type LocalValueDeclaration = VariableDeclaration | FunctionDeclaration | ImportSpecifier | ImportClause;

/**
 * One value binding of a name in a source file (see {@link DereekbImportBindings.localValueBindings}), for
 * {@link resolveLocalValue}.
 */
export interface LocalValueBinding {
  /**
   * Where the binding is visible. Exact for a {@link LocalValueDeclaration}: a `const`, `let` or `using` is visible in the
   * block, module block, case block or source file that holds it, a `var` in its function or the source file, and a
   * top-level function declaration or an import in the whole source file. Every other binding of the name (a parameter,
   * binding element, catch-clause or loop variable, a nested or bodiless function, a function-expression name, class, enum
   * or namespace, a namespace, type-only or `import =` import) is widened to its enclosing function, or the source file, so
   * it can only block more.
   */
  readonly scope: Node;
  /**
   * The declaration a reference can resolve to. `undefined` for every other binding, which only blocks.
   */
  readonly declaration: LocalValueDeclaration | undefined;
}

/**
 * How {@link resolveLocalValue} reads a reference: the one binding of its name in scope where it sits, when that is a
 * {@link LocalValueDeclaration} (`variable`, `function` or `import`); `ambiguous` when more than one binding of its name
 * is in scope there; `none` when none is, or the one that is only blocks.
 */
export type LocalValueResolution =
  | { readonly kind: 'variable'; readonly declaration: VariableDeclaration }
  | { readonly kind: 'function'; readonly declaration: FunctionDeclaration }
  | { readonly kind: 'import'; readonly declaration: ImportSpecifier | ImportClause }
  | { readonly kind: 'ambiguous' }
  | { readonly kind: 'none' };

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
 * the local value bindings {@link resolveLocalValue} resolves references against.
 */
export interface DereekbImportBindings {
  /**
   * The bindings {@link readCalleeName} and {@link readTypeReferenceName} read through, and {@link readImportedReference}
   * follows `const`s through, by name: each `@dereekb/*` import alias (`import { exported as local }`; a plain named
   * import is left out, since its local name already is the exported name), each `@dereekb/*` namespace import
   * (`import * as local`) and each `const <name> = <reference>;` statement, plus every other binding of the same name in
   * the file, which blocks them wherever its scope reaches. Names none of those declare are left out.
   */
  readonly localBindings: ReadonlyMap<string, readonly LocalBinding[]>;
  /**
   * The declarations {@link resolveLocalValue} resolves references to, by name: each variable statement's declaration of
   * a plain identifier, each top-level function declaration with a body and each value import (default or named), plus
   * every other value binding of the same name in the file, which blocks them wherever its scope reaches. Names none of
   * those declare are left out.
   */
  readonly localValueBindings: ReadonlyMap<string, readonly LocalValueBinding[]>;
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
 * Whether {@link statement} is a member a `namespace` exports: a statement of a namespace body (a module block) with the
 * `export` keyword, or any statement of an ambient namespace (`declare namespace …`, `declare module …`,
 * `declare global`), whose members can be exported without the keyword. Namespace declarations of one name merge, and an
 * exported member is visible in every body of the merged namespace, so its names reach past the body that holds it.
 *
 * @param statement - A statement, or a declaration that may be one.
 * @returns `true` when the statement sits directly in a namespace body and the namespace exports it.
 */
function isNamespaceExport(statement: Node): boolean {
  const block = statement.getParent();
  const namespace = block?.getParent();
  return Node.isModuleBlock(block) && Node.isModuleDeclaration(namespace) && ((Node.isExportable(statement) && statement.hasExportKeyword()) || namespace.isAmbient());
}

/**
 * Where a blocking binding of {@link identifier} is visible (see {@link LocalBinding.scope}). It always contains the
 * binding's real scope:
 * - a parameter: the function, method, accessor, constructor or signature that declares it, exactly;
 * - a function- or class-expression name: the expression, exactly;
 * - any other declaration: the nearest of its enclosing function, the `namespace` body that holds it (passed over when
 *   the namespace exports the statement that holds it, see {@link isNamespaceExport}) or the source file. A block-scoped
 *   declaration is widened to it, so it can only block more.
 *
 * @param identifier - A declaration's name.
 * @returns The binding's scope.
 */
function blockingScopeOf(identifier: Identifier): Node {
  const declaration = identifier.getParentOrThrow();
  let result: Node;
  if (Node.isParameterDeclaration(declaration)) {
    result = declaration.getParentOrThrow();
  } else if (Node.isFunctionExpression(declaration) || Node.isClassExpression(declaration)) {
    result = declaration;
  } else {
    const ancestors = declaration.getAncestors();
    // ts-morph 28's isFunctionLikeDeclaration does not cover FunctionExpression
    result = ancestors.find((x, i) => Node.isFunctionLikeDeclaration(x) || Node.isFunctionExpression(x) || (Node.isModuleBlock(x) && !isNamespaceExport(i === 0 ? declaration : ancestors[i - 1]))) ?? declaration.getSourceFile();
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
 * Reads the followable binding a `const <name> = <reference>;` declaration adds to
 * {@link DereekbImportBindings.localBindings}.
 *
 * @param decl - The declaration to read.
 * @returns The binding, scoped to the block, module block, case block or source file that holds the statement, or
 *   `undefined` for any other declaration (a `let` or `var`, a catch-clause, for-loop or destructured declaration, a
 *   `const` a `namespace` exports, which its other bodies see too, or an initializer that is not a followable reference).
 */
function readConstBinding(decl: VariableDeclaration): LocalBinding | undefined {
  const statement = decl.getVariableStatement(); // undefined for catch-clause and for-loop declarations
  const scope = statement?.getDeclarationKind() === VariableDeclarationKind.Const && !isNamespaceExport(statement) ? lexicalScopeOf(statement) : undefined;
  const reference = readHeldReference(decl);
  let result: LocalBinding | undefined;
  if (scope && Node.isIdentifier(decl.getNameNode()) && reference) {
    result = { scope, reference };
  }
  return result;
}

/**
 * Reads the blocking binding a declaration's name adds to {@link DereekbImportBindings.localBindings}, scoped by
 * {@link blockingScopeOf}.
 *
 * @param identifier - The identifier to read.
 * @returns A value binding, a type-only binding (a type parameter, type alias or interface), or `undefined` when the
 *   identifier is not a declaration's name.
 */
function readBlockingBinding(identifier: Identifier): LocalBinding | undefined {
  const isValueBinding = isValueDeclarationName(identifier) || isImportedName(identifier);
  let result: LocalBinding | undefined;
  if (isValueBinding || isTypeDeclarationName(identifier)) {
    result = { scope: blockingScopeOf(identifier), typeOnly: !isValueBinding };
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
 * Reads the value bindings of a source file for {@link DereekbImportBindings.localValueBindings}.
 *
 * @param sf - The source file to read.
 * @returns Each {@link LocalValueDeclaration} by name, with every other value binding the file declares for that name.
 */
function readLocalValueBindings(sf: SourceFile): Map<string, LocalValueBinding[]> {
  const bindings = new Map<string, LocalValueBinding[]>();
  const declarations = new Set<Node>(); // the declarations recorded below, and a recorded function's overload signatures; the blocking pass skips them
  const add = (name: string, declaration: LocalValueDeclaration, scope: Node) => {
    const named = bindings.get(name) ?? [];
    named.push({ scope, declaration });
    bindings.set(name, named);
    declarations.add(declaration);
  };
  for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const statement = decl.getVariableStatement(); // undefined for catch-clause and for-loop declarations
    let scope: Node | undefined;
    if (statement?.getDeclarationKind() === VariableDeclarationKind.Var) {
      scope = functionScopeOf(decl);
    } else if (statement) {
      scope = lexicalScopeOf(statement);
    }
    if (scope && Node.isIdentifier(decl.getNameNode())) {
      add(decl.getName(), decl, scope);
    }
  }

  for (const { name, declaration } of readModuleValueDeclarations(sf)) {
    add(name, declaration, sf);
    for (const overload of Node.isFunctionDeclaration(declaration) ? declaration.getOverloads() : []) {
      declarations.add(overload); // an overload signature is the same binding as its implementation
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
 * A declaration whose binding is visible in its whole source file, from {@link readModuleValueDeclarations}.
 */
interface ModuleValueDeclaration {
  readonly name: string;
  readonly declaration: FunctionDeclaration | ImportSpecifier | ImportClause;
}

/**
 * Reads the {@link LocalValueDeclaration}s of a source file that are visible in the whole file, for
 * {@link readLocalValueBindings}: each top-level function declaration with a body (overload signatures and bodiless
 * `declare function`s are left out), and each value import, default or named. Type-only imports are left out.
 *
 * @param sf - The source file to read.
 * @returns The declarations, with the name each binds.
 */
function readModuleValueDeclarations(sf: SourceFile): ModuleValueDeclaration[] {
  const out: ModuleValueDeclaration[] = [];
  for (const fn of sf.getFunctions()) {
    const name = fn.getName();
    if (name !== undefined && fn.isImplementation()) {
      out.push({ name, declaration: fn });
    }
  }
  for (const imp of sf.getImportDeclarations().filter((x) => !x.isTypeOnly())) {
    const clause = imp.getImportClause();
    const defaultImport = imp.getDefaultImport();
    if (clause && defaultImport) {
      out.push({ name: defaultImport.getText(), declaration: clause });
    }
    for (const specifier of imp.getNamedImports().filter((x) => !x.isTypeOnly())) {
      out.push({ name: (specifier.getAliasNode() ?? specifier.getNameNode()).getText(), declaration: specifier });
    }
  }
  return out;
}

/**
 * Reads the `@dereekb/*` import aliases and namespace imports of a source file and its local `const` references, each
 * with every other binding of its name (see {@link DereekbImportBindings.localBindings}), and the file's local value
 * bindings (see {@link DereekbImportBindings.localValueBindings}).
 *
 * @param sf - The source file to read.
 * @returns The file's `@dereekb/*` import bindings.
 */
export function readDereekbImportBindings(sf: SourceFile): DereekbImportBindings {
  const result: DereekbImportBindings = { localBindings: readLocalBindings(sf), localValueBindings: readLocalValueBindings(sf) };
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
  const bindings = imports.bindingsByFilePath.get(call.getSourceFile().getFilePath());
  const target = followLocalConstReference(call.getExpression(), bindings, 0);
  let result: string | undefined;
  if (Node.isIdentifier(target)) {
    result = findVisibleBinding(target, bindings, 'value')?.exportedName ?? target.getText();
  } else if (Node.isPropertyAccessExpression(target)) {
    const ns = target.getExpression();
    if (Node.isIdentifier(ns) && findVisibleBinding(ns, bindings, 'value')?.namespace) {
      result = target.getName();
    }
  }
  return result;
}

/**
 * Follows the local `const`s that hold {@link node}: while it is an identifier whose one binding in scope is a
 * `const <name> = <reference>;` ({@link LocalBinding.reference}), it moves on to that reference, up to
 * {@link MAX_LOCAL_CONST_HOPS} hops in all.
 *
 * @param node - A reference.
 * @param bindings - The bindings of the node's file.
 * @param hops - How many local `const`s were followed to get here.
 * @returns The last reference reached: {@link node} itself when no `const` holds it.
 */
function followLocalConstReference(node: Node, bindings: DereekbImportBindings | undefined, hops: number): Node {
  const reference = Node.isIdentifier(node) && hops < MAX_LOCAL_CONST_HOPS ? findVisibleBinding(node, bindings, 'value')?.reference : undefined;
  return reference ? followLocalConstReference(reference, bindings, hops + 1) : node;
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
 * (see {@link LocalValueBinding.scope}), when that is a variable statement's declaration; a function or import it is
 * bound to reads as `none` here ({@link resolveLocalValue} reads those too). Same file only. Unlike
 * {@link findLocalVariable}, which returns the first declaration of the name anywhere in the file, two functions that
 * each declare the name read their own; a name with more than one declaration in scope reads as `ambiguous`, never as a
 * guess.
 *
 * @param reference - An identifier in value position.
 * @param imports - The per-file bindings.
 * @returns The resolution.
 */
export function resolveLocalVariable(reference: Identifier, imports: DereekbImportIndex): LocalVariableResolution {
  const binding = resolveLocalValue(reference, imports);
  return binding.kind === 'variable' || binding.kind === 'ambiguous' ? binding : { kind: 'none' };
}

/**
 * Resolves {@link reference} to the declaration it means: the one binding of its name in scope where it sits (see
 * {@link LocalValueBinding.scope}). Same file only; an import is not followed to its module. A name with more than one
 * binding in scope reads as `ambiguous`, never as a guess.
 *
 * @param reference - An identifier in value position.
 * @param imports - The per-file bindings.
 * @returns The resolution.
 */
export function resolveLocalValue(reference: Identifier, imports: DereekbImportIndex): LocalValueResolution {
  const bindings = imports.bindingsByFilePath.get(reference.getSourceFile().getFilePath())?.localValueBindings.get(reference.getText()) ?? [];
  const visible = bindings.filter((x) => isWithinScope(reference, x.scope));
  const declaration = visible.length === 1 ? visible[0].declaration : undefined;
  let result: LocalValueResolution;
  if (visible.length > 1) {
    result = { kind: 'ambiguous' };
  } else if (Node.isVariableDeclaration(declaration)) {
    result = { kind: 'variable', declaration };
  } else if (Node.isFunctionDeclaration(declaration)) {
    result = { kind: 'function', declaration };
  } else if (Node.isImportSpecifier(declaration) || Node.isImportClause(declaration)) {
    result = { kind: 'import', declaration };
  } else {
    result = { kind: 'none' };
  }
  return result;
}

/**
 * Resolves a node to the object literal it holds: an inline literal, or an identifier bound where it sits
 * ({@link resolveLocalVariable}) to a `const` initialized with a literal. Wrappers that leave the value unchanged
 * (`as const`, parentheses, …) are unwrapped. The scope-aware, `const`-only counterpart of
 * {@link resolveObjectLiteralArgument}; a `let` / `var`, a parameter, an import or a call reads as `undefined`.
 *
 * @param node - The node to resolve.
 * @param imports - The per-file bindings (the node's file must be indexed).
 * @returns The object literal, or `undefined` when the node does not resolve to one.
 */
export function resolveLocalObjectLiteral(node: Node | undefined, imports: DereekbImportIndex): ObjectLiteralExpression | undefined {
  const inner = unwrapOuterExpressions(node);
  let result: ObjectLiteralExpression | undefined;
  if (inner && Node.isObjectLiteralExpression(inner)) {
    result = inner;
  } else if (inner && Node.isIdentifier(inner)) {
    const binding = resolveLocalVariable(inner, imports);
    if (binding.kind === 'variable' && binding.declaration.getVariableStatement()?.getDeclarationKind() === VariableDeclarationKind.Const) {
      const initializer = unwrapOuterExpressions(binding.declaration.getInitializer());
      result = initializer && Node.isObjectLiteralExpression(initializer) ? initializer : undefined;
    }
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

/**
 * The suffixes a relative module specifier is tried with, in order: as written, as a `.ts` file, and as a folder's
 * `index.ts`. A `.js` extension is dropped first.
 */
const RELATIVE_MODULE_SUFFIXES: readonly string[] = ['', '.ts', '/index.ts'];

/**
 * Input to {@link resolveRelativeModulePath}.
 */
export interface ResolveRelativeModulePathInput {
  /**
   * Path of the source file the specifier is written in.
   */
  readonly fromFilePath: string;
  readonly moduleSpecifier: string;
  /**
   * Whether a scanned source file exists at a path.
   */
  readonly hasPath: (path: string) => boolean;
}

/**
 * Resolves a relative module specifier (`./x`, `../x.js`, `./dir`) to the scanned source file it names: as written, as a
 * `.ts` file, then as a folder's `index.ts`, with a `.js` extension dropped first.
 *
 * @param input - The importing file's path, the specifier and the scanned-path check.
 * @returns The scanned file's path, or `undefined` for a non-relative specifier or one that names no scanned file.
 */
export function resolveRelativeModulePath(input: ResolveRelativeModulePathInput): string | undefined {
  const { fromFilePath, moduleSpecifier, hasPath } = input;
  let result: string | undefined;
  if (moduleSpecifier.startsWith('.')) {
    const base = posix.join(posix.dirname(fromFilePath), moduleSpecifier.replace(/\.js$/, ''));
    result = RELATIVE_MODULE_SUFFIXES.map((x) => `${base}${x}`).find(hasPath);
  }
  return result;
}

/**
 * Reads what a file exports from its own top-level declarations, by exported name: `export` on a function declaration
 * (`export default function` reads as `default`) or variable statement, an `export { … }` list without a module
 * specifier, and `export default <name>`. Only names bound to a top-level named function or a variable statement's
 * identifier-named declaration are kept; a name declared by both reads as the variable, and a variable declared twice as
 * the later one. Re-exports (`export … from`), classes, enums and type-only exports are left out.
 *
 * @param sf - The source file to read.
 * @returns Each exported name's declaration.
 */
export function readOwnExportedDeclarations(sf: SourceFile): ReadonlyMap<string, FunctionDeclaration | VariableDeclaration> {
  const locals = new Map<string, FunctionDeclaration | VariableDeclaration>(); // each top-level function and variable by name
  const exportedLocals = new Map<string, string>(); // each exported name: the local name it exports
  for (const fn of sf.getFunctions()) {
    const name = fn.getName();
    if (name !== undefined) {
      locals.set(name, fn);
      if (fn.hasExportKeyword()) {
        exportedLocals.set(fn.hasDefaultKeyword() ? 'default' : name, name);
      }
    }
  }
  for (const stmt of sf.getVariableStatements()) {
    for (const decl of stmt.getDeclarations().filter((x) => Node.isIdentifier(x.getNameNode()))) {
      locals.set(decl.getName(), decl);
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
  const result = new Map<string, FunctionDeclaration | VariableDeclaration>();
  for (const [exported, local] of exportedLocals) {
    const declaration = locals.get(local);
    if (declaration) {
      result.set(exported, declaration);
    }
  }
  return result;
}
