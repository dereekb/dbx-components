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

import { Node, Project, SyntaxKind, type ArrayLiteralExpression, type ObjectLiteralExpression, type SourceFile, type TypeNode, type VariableDeclaration } from 'ts-morph';
import type { InspectedFile } from './inspection.types.js';

const COMPONENT_VIRTUAL_PREFIX = '__component__/';
const API_VIRTUAL_PREFIX = '__api__/';

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
 * @param input - the prepared two-side inspection
 * @returns the populated project plus per-side source-file arrays
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
 * @param sourceFile - source file produced by {@link buildInMemoryProject}
 * @returns the original relPath supplied to {@link buildInMemoryProject}
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
 * @param sourceFile - source file produced by {@link buildInMemoryProject}
 * @returns the original relPath supplied to {@link buildInMemoryProject}
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
 * @param node - the node to unwrap
 * @returns the innermost non-as expression, or `undefined` when the
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
 * @param node - the node to narrow
 * @returns the unwrapped object literal, or `undefined` when the node
 *   does not resolve to one
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
 * @param node - the node to narrow
 * @returns the unwrapped array literal, or `undefined` when the node
 *   does not resolve to one
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
 * @param decl - the variable declaration to inspect
 * @returns the literal text, or `undefined` when the declaration's
 *   initializer is missing or not a string literal
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
 * @param node - the variable declaration to inspect
 * @returns the annotation text, or `undefined` when the declaration
 *   has no explicit type node
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
 * @param obj - the object literal to inspect
 * @param name - the property name to look up
 * @returns the initializer/name node, or `undefined` when the property
 *   is absent or carries no recognisable value position
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
 * @param obj - the object literal to inspect
 * @param name - the property name to look up
 * @returns the literal text, or `undefined` when the property is
 *   missing or not a string literal
 */
export function readStringProperty(obj: ObjectLiteralExpression, name: string): string | undefined {
  const init = unwrapAsExpressions(getPropertyInitializer(obj, name));
  if (init && Node.isStringLiteral(init)) {
    return init.getLiteralText();
  }
  return undefined;
}

/**
 * Reads the identifier-name value of a property on an object literal,
 * tolerating an `as` cast around the identifier.
 *
 * @param obj - the object literal to inspect
 * @param name - the property name to look up
 * @returns the identifier text, or `undefined` when the property is
 *   missing or does not resolve to an identifier
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
 * @param fn - the function/arrow/method node
 * @returns the return expression, or `undefined`
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
 * @param sf - the source file to scan
 * @param name - the variable name to match
 * @returns the matching declaration, or `undefined` when none is found
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
 * Pushes the names of every `typeof X` query inside a type node onto
 * {@link out}.
 *
 * @param node - the type node to walk
 * @param out - the mutable buffer that receives the referenced names
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
 * Builds the trust-list of identifiers imported from `@dereekb/*`
 * packages across the supplied sources. Validators consult this set
 * to suppress "unresolved" / "orphan" diagnostics for symbols that
 * cross into upstream packages and cannot be traced locally.
 *
 * @param sources - the source files to scan
 * @returns the set of trusted identifier names
 */
export function collectTrustedExternalIdentifiers(sources: readonly SourceFile[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const sf of sources) {
    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      if (!spec.startsWith('@dereekb/')) continue;
      for (const named of imp.getNamedImports()) {
        const alias = named.getAliasNode();
        out.add(alias ? alias.getText() : named.getNameNode().getText());
      }
      const namespace = imp.getNamespaceImport();
      if (namespace) {
        out.add(namespace.getText());
      }
    }
  }
  return out;
}
