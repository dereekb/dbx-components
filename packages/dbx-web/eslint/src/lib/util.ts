/**
 * Module that holds Angular component decorators.
 */
export const ANGULAR_CORE_MODULE = '@angular/core';

/**
 * Decorators that mark a class with a component-scoped DestroyRef lifecycle.
 *
 * `@Injectable` is intentionally excluded — services often expose long-lived
 * Subjects as part of their public API and cleaning them on destroy is wrong.
 */
export const ANGULAR_COMPONENT_DECORATORS: ReadonlySet<string> = new Set(['Component', 'Directive', 'Pipe']);

/**
 * Module that holds the dbx-components RxJS extras (SubscriptionObject).
 */
export const DEREEKB_RXJS_MODULE = '@dereekb/rxjs';

/**
 * Module that holds Subject/BehaviorSubject/etc.
 */
export const RXJS_MODULE = 'rxjs';

/**
 * Module that holds the cleanup helpers (cleanSubscription, completeOnDestroy, clean).
 */
export const DEREEKB_DBX_CORE_MODULE = '@dereekb/dbx-core';

/**
 * Identifier name for the `SubscriptionObject` class.
 */
export const SUBSCRIPTION_OBJECT_NAME = 'SubscriptionObject';

/**
 * Identifier names for RxJS Subject classes that should be wrapped with `completeOnDestroy`.
 */
export const SUBJECT_NAMES: ReadonlySet<string> = new Set(['Subject', 'BehaviorSubject', 'ReplaySubject', 'AsyncSubject']);

/**
 * Helper imported from `@dereekb/dbx-core` that replaces a manual SubscriptionObject creation.
 */
export const CLEAN_SUBSCRIPTION_HELPER = 'cleanSubscription';

/**
 * Helper imported from `@dereekb/dbx-core` that wraps a Subject so it completes on destroy.
 */
export const COMPLETE_ON_DESTROY_HELPER = 'completeOnDestroy';

/**
 * Underlying Destroyable/DestroyFunction primitive helper from `@dereekb/dbx-core`.
 *
 * Accepted as a wrapper for `new SubscriptionObject(...)` since `SubscriptionObject`
 * is `Destroyable`. Not accepted for raw Subjects since those are neither
 * `Destroyable` nor `DestroyFunction` and would not actually call `.complete()`.
 */
export const CLEAN_HELPER = 'clean';

/**
 * Loose AST node alias used by the rule implementations.
 */
export type AstNode = any;

/**
 * Per-file registry of import information used by all rules in this plugin.
 *
 * Tracks: which local names came from which module, the ImportDeclaration node
 * for each module (for fix insertion), and the last import declaration in the
 * file (for inserting brand-new imports after).
 */
export interface ImportRegistry {
  /**
   * Maps source-module string to the set of locally-bound identifiers that came from it.
   */
  readonly bySource: Map<string, Set<string>>;

  /**
   * Maps a local identifier name to the source-module string it was imported from.
   */
  readonly localToSource: Map<string, string>;

  /**
   * Maps source-module string to its ImportDeclaration AST node (for appending specifiers).
   */
  readonly sourceToDeclaration: Map<string, AstNode>;

  /**
   * The last ImportDeclaration node in the file. Used to insert brand-new imports.
   */
  lastImportDeclaration: AstNode | null;
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
    sourceToDeclaration: new Map(),
    lastImportDeclaration: null
  };
}

/**
 * Records an `ImportDeclaration` node in the registry. Call from the rule's
 * `ImportDeclaration` visitor for every import in the file.
 *
 * @param registry - The registry to mutate.
 * @param node - The ImportDeclaration AST node.
 */
export function trackImportDeclaration(registry: ImportRegistry, node: AstNode): void {
  const source = node.source?.value as string | undefined;

  if (!source) {
    return;
  }

  registry.lastImportDeclaration = node;
  registry.sourceToDeclaration.set(source, node);

  const localNames = registry.bySource.get(source) ?? new Set<string>();

  for (const specifier of node.specifiers ?? []) {
    if (specifier.type === 'ImportSpecifier' || specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportNamespaceSpecifier') {
      const localName = specifier.local?.name as string | undefined;

      if (localName) {
        localNames.add(localName);
        registry.localToSource.set(localName, source);
      }
    }
  }

  registry.bySource.set(source, localNames);
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
 * Extracts the decorator name from a decorator AST node.
 *
 * Handles `@Foo()` (CallExpression) and `@Foo` (Identifier). Returns the empty
 * string for anything else.
 *
 * @param decorator - The decorator AST node.
 * @returns The decorator name, or empty string when unrecognized.
 */
export function getDecoratorName(decorator: AstNode): string {
  const expression = decorator?.expression;

  if (!expression) {
    return '';
  }

  if (expression.type === 'CallExpression') {
    if (expression.callee?.type === 'Identifier') {
      return expression.callee.name;
    }

    if (expression.callee?.type === 'MemberExpression' && expression.callee.property?.type === 'Identifier') {
      return expression.callee.property.name;
    }
  }

  if (expression.type === 'Identifier') {
    return expression.name;
  }

  return '';
}

/**
 * Returns the first decorator on the class that names a component-tier
 * Angular decorator (`@Component`, `@Directive`, `@Pipe`) imported from
 * `@angular/core`, or null when none match.
 *
 * @param classNode - The ClassDeclaration / ClassExpression AST node.
 * @param registry - The file's import registry, used to verify the decorator
 *   identifier really came from `@angular/core` (and not a local alias).
 * @returns The matching decorator and its name, or null.
 */
export function findAngularComponentDecorator(classNode: AstNode, registry: ImportRegistry): { readonly decorator: AstNode; readonly name: string } | null {
  const decorators = classNode?.decorators;
  let result: { readonly decorator: AstNode; readonly name: string } | null = null;

  if (decorators && decorators.length > 0) {
    for (const decorator of decorators) {
      const name = getDecoratorName(decorator);

      if (ANGULAR_COMPONENT_DECORATORS.has(name) && isImportedFrom(registry, name, ANGULAR_CORE_MODULE)) {
        result = { decorator, name };
        break;
      }
    }
  }

  return result;
}

/**
 * Returns the property name of a class member when its key is a simple Identifier or string Literal.
 *
 * Returns null for computed/symbol/private keys.
 *
 * @param member - A ClassBody member AST node.
 * @returns The property name, or null when not a simple key.
 */
export function getClassMemberName(member: AstNode): string | null {
  const key = member?.key;

  if (!key || member.computed) {
    return null;
  }

  if (key.type === 'Identifier') {
    return key.name;
  }

  if (key.type === 'Literal' && typeof key.value === 'string') {
    return key.value;
  }

  return null;
}

/**
 * Finds the `ngOnDestroy` method declaration on the given class, if any.
 *
 * @param classNode - The ClassDeclaration / ClassExpression AST node.
 * @returns The MethodDefinition AST node for `ngOnDestroy`, or null.
 */
export function findNgOnDestroyMethod(classNode: AstNode): AstNode | null {
  const members = classNode?.body?.body;
  let result: AstNode | null = null;

  if (members) {
    for (const member of members) {
      if (member.type === 'MethodDefinition' && member.kind === 'method' && getClassMemberName(member) === 'ngOnDestroy') {
        result = member;
        break;
      }
    }
  }

  return result;
}

/**
 * If the given expression is a `CallExpression` whose callee is one of the
 * accepted identifier names, returns the matching name. Otherwise null.
 *
 * @example
 * ```
 * isCalledIdentifier(node, ['cleanSubscription', 'clean']) // returns 'cleanSubscription'
 * ```
 *
 * @param node - The expression AST node.
 * @param names - The accepted identifier names.
 * @returns The matched name, or null.
 */
export function isCalledIdentifier(node: AstNode, names: ReadonlySet<string>): string | null {
  if (node?.type !== 'CallExpression') {
    return null;
  }

  const callee = node.callee;

  if (callee?.type === 'Identifier' && names.has(callee.name)) {
    return callee.name;
  }

  return null;
}

/**
 * Returns true when the given AST node is a `this.<propName>` MemberExpression.
 *
 * @param node - The AST node to check.
 * @param propName - The expected property name.
 * @returns True when the node is `this.<propName>`.
 */
export function isThisMemberAccess(node: AstNode, propName: string): boolean {
  return node?.type === 'MemberExpression' && node.object?.type === 'ThisExpression' && !node.computed && node.property?.type === 'Identifier' && node.property.name === propName;
}

/**
 * Input for {@link ensureNamedImportFix}.
 */
export interface EnsureNamedImportFixInput {
  /**
   * The ESLint RuleFixer.
   */
  readonly fixer: AstNode;
  /**
   * The file's import registry. Mutated to record the new import.
   */
  readonly registry: ImportRegistry;
  /**
   * The named-import identifier to ensure is present.
   */
  readonly importName: string;
  /**
   * The source-module string to import from.
   */
  readonly fromSource: string;
}

/**
 * Builds a fix operation that ensures `importName` is imported from
 * `fromSource` in the file. Returns null when the import is already present.
 *
 * Side effect: mutates the registry to mark the import as present, so two
 * separate report fixes in the same lint pass don't both insert the same import.
 *
 * @param input - The fixer, registry, and import names.
 * @returns A fix operation, or null when the import is already present.
 */
export function ensureNamedImportFix(input: EnsureNamedImportFixInput): AstNode | null {
  const { fixer, registry, importName, fromSource } = input;
  const existing = registry.bySource.get(fromSource);

  if (existing?.has(importName)) {
    return null;
  }

  const declaration = registry.sourceToDeclaration.get(fromSource);
  let result: AstNode | null = null;

  if (declaration) {
    const lastSpecifier = declaration.specifiers?.[declaration.specifiers.length - 1];

    if (lastSpecifier) {
      const updatedSet = existing ?? new Set<string>();
      updatedSet.add(importName);
      registry.bySource.set(fromSource, updatedSet);
      registry.localToSource.set(importName, fromSource);
      result = fixer.insertTextAfter(lastSpecifier, `, ${importName}`);
    }
  } else if (registry.lastImportDeclaration) {
    const updatedSet = existing ?? new Set<string>();
    updatedSet.add(importName);
    registry.bySource.set(fromSource, updatedSet);
    registry.localToSource.set(importName, fromSource);
    result = fixer.insertTextAfter(registry.lastImportDeclaration, `\nimport { ${importName} } from '${fromSource}';`);
  }

  return result;
}

/**
 * Returns true when the given PropertyDefinition declares a `static` member.
 *
 * @param node - The PropertyDefinition AST node.
 * @returns True when the node has `static` modifier.
 */
export function isStaticProperty(node: AstNode): boolean {
  return node?.static === true;
}

/**
 * Returns true when the given PropertyDefinition uses `declare`
 * (`declare readonly foo: T`) — i.e. has no runtime initializer.
 *
 * @param node - The PropertyDefinition AST node.
 * @returns True when the property is declared abstractly.
 */
export function isDeclareProperty(node: AstNode): boolean {
  return node?.declare === true;
}

/**
 * The Angular `OnDestroy` lifecycle interface name.
 */
export const ON_DESTROY_INTERFACE_NAME = 'OnDestroy';

/**
 * Match details for an `implements OnDestroy` clause located on a class.
 */
export interface OnDestroyImplementsMatch {
  /**
   * The full list of `implements` specifiers on the class (TSClassImplements nodes).
   */
  readonly allImplements: readonly AstNode[];
  /**
   * The TSClassImplements node for `OnDestroy`.
   */
  readonly clauseSpecifier: AstNode;
  /**
   * Index of {@link clauseSpecifier} within {@link allImplements}.
   */
  readonly index: number;
}

/**
 * Locates an `implements OnDestroy` clause on the class whose `OnDestroy`
 * identifier resolves to the import from `@angular/core`. Returns null when
 * no matching clause exists.
 *
 * @param classNode - The ClassDeclaration / ClassExpression AST node.
 * @param registry - The file's import registry.
 * @returns The match details, or null.
 */
export function findOnDestroyImplementsClause(classNode: AstNode, registry: ImportRegistry): OnDestroyImplementsMatch | null {
  const allImplements: readonly AstNode[] = classNode?.implements ?? [];
  let result: OnDestroyImplementsMatch | null = null;

  for (let index = 0; index < allImplements.length; index += 1) {
    const clauseSpecifier = allImplements[index];
    const expression = clauseSpecifier?.expression;

    if (expression?.type === 'Identifier' && expression.name === ON_DESTROY_INTERFACE_NAME && isImportedFrom(registry, ON_DESTROY_INTERFACE_NAME, ANGULAR_CORE_MODULE)) {
      result = { allImplements, clauseSpecifier, index };
      break;
    }
  }

  return result;
}

/**
 * Computes the source range to remove for the given `implements` specifier so
 * that the surrounding `implements` clause stays well-formed.
 *
 * Behavior:
 * - When the specifier is the only entry, the entire `implements <X>` clause
 *   is removed, including the leading whitespace before the `implements`
 *   keyword (so `class Foo implements OnDestroy {` becomes `class Foo {`).
 * - When the specifier is the first of several, the specifier and the
 *   following comma+whitespace are removed.
 * - Otherwise, the preceding comma+whitespace and the specifier are removed.
 *
 * @param match - The `implements OnDestroy` match details.
 * @param sourceCode - The ESLint sourceCode service.
 * @returns A `[start, end]` range tuple suitable for `fixer.removeRange`.
 */
export function getImplementsSpecifierRemovalRange(match: OnDestroyImplementsMatch, sourceCode: AstNode): readonly [number, number] {
  const { allImplements, clauseSpecifier, index } = match;
  let result: readonly [number, number];

  if (allImplements.length === 1) {
    const implementsKeyword = sourceCode.getTokenBefore(clauseSpecifier, { filter: (token: AstNode) => token.type === 'Keyword' && token.value === 'implements' });
    const tokenBeforeImplements = implementsKeyword ? sourceCode.getTokenBefore(implementsKeyword) : null;
    const startPos = tokenBeforeImplements ? tokenBeforeImplements.range[1] : implementsKeyword ? implementsKeyword.range[0] : clauseSpecifier.range[0];
    result = [startPos, clauseSpecifier.range[1]];
  } else if (index === 0) {
    result = [clauseSpecifier.range[0], allImplements[1].range[0]];
  } else {
    result = [allImplements[index - 1].range[1], clauseSpecifier.range[1]];
  }

  return result;
}
