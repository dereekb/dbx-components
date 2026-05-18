import type { Maybe } from '@dereekb/util';
import { ANGULAR_CORE_MODULE, type AstNode, type ImportRegistry, createImportRegistry, isImportedFrom, trackImportDeclaration } from './util';

/**
 * Module that exposes the `toSignal` factory.
 */
const ANGULAR_CORE_RXJS_INTEROP_MODULE = '@angular/core/rxjs-interop';

/**
 * Name of the Angular `computed` factory whose callbacks this rule inspects.
 */
const COMPUTED_INITIALIZER_NAME = 'computed';

/**
 * Bare-identifier signal factories exported from `@angular/core`.
 *
 * Each name corresponds to a function that returns a Signal/InputSignal/
 * WritableSignal/ModelSignal — the kind of getter the rule needs to track
 * across class properties and module-level `const`s.
 */
const ANGULAR_CORE_SIGNAL_FACTORIES: ReadonlySet<string> = new Set(['signal', 'computed', 'input', 'model', 'linkedSignal']);

/**
 * `Identifier.required(...)` member-form factories. Each entry's value is the
 * root identifier whose `required` property returns another signal factory.
 *
 * Example: `input.required<string>()` — `input` is the root identifier and
 * the result is still an InputSignal.
 */
const ANGULAR_CORE_REQUIRED_FACTORIES: ReadonlySet<string> = new Set(['input', 'model']);

/**
 * Bare-identifier signal factories exported from `@angular/core/rxjs-interop`.
 */
const ANGULAR_CORE_RXJS_INTEROP_SIGNAL_FACTORIES: ReadonlySet<string> = new Set(['toSignal']);

/**
 * Signal type names exported from `@angular/core`. A property or variable
 * whose declared type is one of these (and whose root identifier was imported
 * from `@angular/core`) is treated as a signal getter, even when its
 * initializer is not a recognized signal factory call (e.g. produced by a
 * helper or returned from a base class).
 */
const ANGULAR_CORE_SIGNAL_TYPE_NAMES: ReadonlySet<string> = new Set(['Signal', 'WritableSignal', 'InputSignal', 'InputSignalWithTransform', 'ModelSignal']);

/**
 * Maximum number of characters from the offending call expression that should
 * appear in the report message. Long expressions are truncated so the message
 * stays readable in editor tooltips.
 */
const CALL_PREVIEW_MAX_LENGTH = 40;

/**
 * ESLint rule definition shape used by `require-top-level-computed-signals`.
 */
export interface DbxWebRequireTopLevelComputedSignalsRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly conditionalSignalRead: string;
    };
    readonly schema: readonly object[];
  };
  create(context: AstNode): Record<string, (node: AstNode) => void>;
}

/**
 * Per-file collection of signal names known to the rule. The rule only flags
 * calls whose name appears in one of these sets, so the report set stays
 * free of false positives on plain methods or utility functions.
 */
interface SignalRegistry {
  /**
   * Property names of class members initialized with a signal factory (e.g.
   * `readonly count = signal(0)`), keyed by the owning class AST node.
   */
  readonly classSignalProps: WeakMap<AstNode, Set<string>>;
  /**
   * Module-level (`program` body) `const` identifiers initialized with a
   * signal factory (e.g. `const count = signal(0)` at the top of the file).
   */
  readonly moduleSignalNames: Set<string>;
}

/**
 * ESLint rule that requires every signal read inside a `computed(() => { ... })`
 * callback to appear in an unconditional, top-level position rather than
 * inside a branching path (if/else, ternary, short-circuit, switch case,
 * loop body, catch handler).
 *
 * Angular `computed` re-tracks its dependencies on every run, so a signal
 * read that only happens inside one branch is not registered as a dependency
 * when the other branch executes. When that signal subsequently changes the
 * computed does not recompute and the value goes stale. Reading every signal
 * up front — before any branching — keeps the dependency set stable.
 *
 * To avoid false positives on plain methods and utility functions, the rule
 * only flags calls whose name can be statically traced back to a signal
 * factory:
 *
 * - `this.<name>()` is flagged when `<name>` is a class property initialized
 *   with one of `signal`, `computed`, `input`, `input.required`, `model`,
 *   `model.required`, `linkedSignal` (from `@angular/core`), or `toSignal`
 *   (from `@angular/core/rxjs-interop`).
 * - `<name>()` (bare identifier) is flagged when `<name>` is a module-level
 *   `const` initialized with one of those factories.
 *
 * Everything else — calls with arguments, chained property accesses on
 * services, calls on local loop variables, calls on globals — is left
 * alone. Cross-class signal tracking (e.g. `this.someService.someSignal()`)
 * is intentionally out of scope: it would require type analysis to
 * distinguish signal getters from plain getter methods, and the rule
 * prefers a clean report set over partial coverage.
 *
 * Only `computed` identifiers imported from `@angular/core` are considered.
 * Nested function expressions (callbacks passed to `.map` / `.filter` etc.)
 * are not inspected because Angular does not synchronously track signals
 * read inside them.
 *
 * Auto-fix: for each flagged callback, the fix inserts one
 * `const <localName> = this.<signalName>();` (or `const <localName> = <signalName>();`
 * for module-scope captures) at the top of the callback body and replaces
 * every flagged call with `<localName>`. The local name is the signal name
 * with the trailing `Signal` suffix removed when present (`xSignal` → `x`).
 * If that name would shadow an existing local binding in the callback, the
 * fix is skipped for that signal to avoid generating a syntax error.
 * Expression-body callbacks (`computed(() => …)`) are converted to block
 * bodies as part of the fix; the previous expression becomes the `return`
 * value.
 */
export const DBX_WEB_REQUIRE_TOP_LEVEL_COMPUTED_SIGNALS_RULE: DbxWebRequireTopLevelComputedSignalsRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Require signal reads inside a computed() callback to occur in unconditional top-level statements, not inside if/else, ternary, short-circuit, switch, loop, or catch branches.',
      recommended: true
    },
    messages: {
      conditionalSignalRead: "Signal read '{{call}}' is inside a conditional execution path of computed(); hoist it to an unconditional top-level read before the branch so the computed tracks it on every run."
    },
    schema: []
  },
  create(context: AstNode) {
    const imports = createImportRegistry();
    const signals: SignalRegistry = {
      classSignalProps: new WeakMap(),
      moduleSignalNames: new Set()
    };

    const visitClass = (classNode: AstNode): void => {
      collectClassSignalProperties(classNode, imports, signals);
    };

    const inspectComputedCall = (callNode: AstNode): void => {
      if (!isComputedCall(callNode, imports)) {
        return;
      }

      const callback = callNode.arguments?.[0];

      if (!callback || !isFunctionNode(callback) || !callback.body) {
        return;
      }

      const enclosingClass = findEnclosingClass(callNode);
      const classSignalNames: Maybe<ReadonlySet<string>> = enclosingClass ? signals.classSignalProps.get(enclosingClass) : null;
      const violations: Violation[] = [];

      // The function body itself is the entry point. Conditional state starts
      // as `false` — top-level statements in the body run unconditionally.
      walk(callback.body, false, { classSignalNames, moduleSignalNames: signals.moduleSignalNames, violations });

      if (violations.length === 0) {
        return;
      }

      reportViolations(callback, violations, context);
    };

    return {
      ImportDeclaration(node: AstNode) {
        trackImportDeclaration(imports, node);
      },
      VariableDeclaration(node: AstNode) {
        collectModuleSignalConsts(node, imports, signals);
      },
      ClassDeclaration(classNode: AstNode) {
        visitClass(classNode);
      },
      ClassExpression(classNode: AstNode) {
        visitClass(classNode);
      },
      CallExpression(node: AstNode) {
        inspectComputedCall(node);
      }
    };
  }
};

/**
 * Source-form of a known signal getter, used to plan a hoist.
 *
 * Either `'this'` (a `this.<name>()` class signal property) or `'module'`
 * (a bare `<name>()` module-level signal const).
 */
type SignalSource = 'this' | 'module';

/**
 * One conditional signal read found inside a computed callback.
 */
interface Violation {
  /**
   * The flagged `CallExpression` AST node.
   */
  readonly node: AstNode;
  /**
   * The signal property name (`this.<signalName>` or bare `<signalName>`).
   */
  readonly signalName: string;
  /**
   * Where the signal is sourced from — `'this'` or `'module'`.
   */
  readonly source: SignalSource;
}

/**
 * Shared state threaded through the recursive walk of a computed callback body.
 */
interface WalkState {
  /**
   * The set of `this.<name>` signal property names belonging to the class
   * that encloses the current `computed(...)` call. `null` when the call is
   * not inside a class body (e.g. module-level computed declarations).
   */
  readonly classSignalNames: Maybe<ReadonlySet<string>>;
  /**
   * The set of module-level `const` identifiers initialized with a signal
   * factory. Used to flag bare-identifier calls like `count()` when `count`
   * is captured from the surrounding module scope.
   */
  readonly moduleSignalNames: ReadonlySet<string>;
  /**
   * Accumulator that receives every conditional signal read found during the
   * walk. Drained after the walk completes to build a single fix per callback.
   */
  readonly violations: Violation[];
}

/**
 * Returns true when `node` is a `computed(...)` call whose `computed`
 * identifier was imported from `@angular/core`.
 *
 * @param node - The CallExpression AST node to test.
 * @param imports - The file's import registry.
 * @returns True when the call refers to Angular's `computed`.
 */
function isComputedCall(node: AstNode, imports: ImportRegistry): boolean {
  return node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === COMPUTED_INITIALIZER_NAME && isImportedFrom(imports, COMPUTED_INITIALIZER_NAME, ANGULAR_CORE_MODULE);
}

/**
 * Returns true when `callExpression` is a call to one of the Angular signal
 * factories whose return value is a Signal/InputSignal/WritableSignal/
 * ModelSignal. Handles bare-identifier calls (`signal(...)`), required
 * member-form calls (`input.required(...)`, `model.required(...)`), and
 * `toSignal(...)` from `@angular/core/rxjs-interop`.
 *
 * @param callExpression - The CallExpression AST node serving as an initializer.
 * @param imports - The file's import registry.
 * @returns True when the call returns a signal.
 */
function isSignalFactoryCall(callExpression: AstNode, imports: ImportRegistry): boolean {
  const callee = callExpression?.callee;
  let result = false;

  if (callee?.type === 'Identifier') {
    const name: string = callee.name;

    if (ANGULAR_CORE_SIGNAL_FACTORIES.has(name) && isImportedFrom(imports, name, ANGULAR_CORE_MODULE)) {
      result = true;
    } else if (ANGULAR_CORE_RXJS_INTEROP_SIGNAL_FACTORIES.has(name) && isImportedFrom(imports, name, ANGULAR_CORE_RXJS_INTEROP_MODULE)) {
      result = true;
    }
  } else if (callee?.type === 'MemberExpression' && callee.computed === false && callee.object?.type === 'Identifier' && callee.property?.type === 'Identifier' && callee.property.name === 'required') {
    const rootName: string = callee.object.name;

    if (ANGULAR_CORE_REQUIRED_FACTORIES.has(rootName) && isImportedFrom(imports, rootName, ANGULAR_CORE_MODULE)) {
      result = true;
    }
  }

  return result;
}

/**
 * Returns true when `typeAnnotation` is a TypeScript type annotation node whose
 * root type name is one of the Angular signal types and resolves to an
 * `@angular/core` import (e.g. `Signal<number>`, `InputSignal<string>`).
 *
 * Accepts both the `TSTypeAnnotation` wrapper and the inner `TSTypeReference`
 * form. Returns false for any other shape (unions, intersections, generic
 * wrappers, etc.) — the rule prefers under-coverage to false positives.
 *
 * @param typeAnnotation - The TSTypeAnnotation / TSTypeReference AST node.
 * @param imports - The file's import registry.
 * @returns True when the type annotation names an Angular signal type.
 */
function isSignalTypeAnnotation(typeAnnotation: AstNode, imports: ImportRegistry): boolean {
  let typeNode: Maybe<AstNode> = typeAnnotation;

  if (typeNode?.type === 'TSTypeAnnotation') {
    typeNode = typeNode.typeAnnotation;
  }

  let result = false;

  if (typeNode?.type === 'TSTypeReference' && typeNode.typeName?.type === 'Identifier') {
    const name: string = typeNode.typeName.name;

    if (ANGULAR_CORE_SIGNAL_TYPE_NAMES.has(name) && isImportedFrom(imports, name, ANGULAR_CORE_MODULE)) {
      result = true;
    }
  }

  return result;
}

/**
 * Scans the class body for `PropertyDefinition` members whose initializer is
 * a signal factory call, and stores their names in `signals.classSignalProps`.
 *
 * Static and `declare` properties are ignored. Property names that are not
 * simple identifiers (e.g. computed keys, symbols) are also ignored.
 *
 * @param classNode - The ClassDeclaration / ClassExpression AST node.
 * @param imports - The file's import registry.
 * @param signals - The signal registry that is mutated with the results.
 */
function collectClassSignalProperties(classNode: AstNode, imports: ImportRegistry, signals: SignalRegistry): void {
  const members: AstNode[] = classNode.body?.body ?? [];
  const names = new Set<string>();

  for (const member of members) {
    if (member?.type !== 'PropertyDefinition' || member.static === true || member.declare === true || member.computed === true) {
      continue;
    }

    const key = member.key;
    const initializer = member.value;
    let propName: Maybe<string> = null;

    if (key?.type === 'Identifier') {
      propName = key.name;
    } else if (key?.type === 'Literal' && typeof key.value === 'string') {
      propName = key.value;
    }

    if (propName) {
      const initializerIsSignal = initializer?.type === 'CallExpression' && isSignalFactoryCall(initializer, imports);
      const typeIsSignal = member.typeAnnotation && isSignalTypeAnnotation(member.typeAnnotation, imports);

      if (initializerIsSignal || typeIsSignal) {
        names.add(propName);
      }
    }
  }

  signals.classSignalProps.set(classNode, names);
}

/**
 * Scans a `VariableDeclaration` node that lives directly inside the program
 * body for `const` declarators whose initializer is a signal factory call,
 * adding their names to `signals.moduleSignalNames`.
 *
 * Non-`const` declarations, declarations nested inside functions or blocks,
 * and declarations whose initializer is not a signal factory are skipped.
 *
 * @param node - The VariableDeclaration AST node.
 * @param imports - The file's import registry.
 * @param signals - The signal registry that is mutated with the results.
 */
function collectModuleSignalConsts(node: AstNode, imports: ImportRegistry, signals: SignalRegistry): void {
  if (node?.kind !== 'const' || node.parent?.type !== 'Program') {
    return;
  }

  for (const declarator of node.declarations ?? []) {
    const id = declarator?.id;
    const init = declarator?.init;

    if (id?.type === 'Identifier') {
      const initIsSignal = init?.type === 'CallExpression' && isSignalFactoryCall(init, imports);
      const typeIsSignal = id.typeAnnotation && isSignalTypeAnnotation(id.typeAnnotation, imports);

      if (initIsSignal || typeIsSignal) {
        signals.moduleSignalNames.add(id.name);
      }
    }
  }
}

/**
 * Walks up from `node` via `parent` references to find the nearest enclosing
 * `ClassDeclaration` or `ClassExpression`, or null if there isn't one.
 *
 * @param node - The starting AST node.
 * @returns The enclosing class node, or null.
 */
function findEnclosingClass(node: AstNode): Maybe<AstNode> {
  let current: AstNode = node.parent;
  let result: Maybe<AstNode> = null;

  while (current && !result) {
    if (current.type === 'ClassDeclaration' || current.type === 'ClassExpression') {
      result = current;
    } else {
      current = current.parent;
    }
  }

  return result;
}

/**
 * Returns true when `node` is any function-like AST node (arrow, expression,
 * declaration). Used both to find the computed callback and to stop the walk
 * when it would otherwise descend into a nested function body.
 *
 * @param node - The AST node to test.
 * @returns True when `node` is a function-like node.
 */
function isFunctionNode(node: AstNode): boolean {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression' || node?.type === 'FunctionDeclaration';
}

/**
 * Recursively walks the body of a `computed(...)` callback. For each
 * zero-argument `CallExpression` that can be statically traced to a known
 * signal getter, records a violation when `conditional` is true. Stops at
 * any nested function boundary.
 *
 * @param node - The current AST node being inspected.
 * @param conditional - True when `node` is inside a conditional execution path.
 * @param state - Shared walk state (signal registries + violation accumulator).
 */
function walk(node: AstNode, conditional: boolean, state: WalkState): void {
  if (!node || typeof node.type !== 'string') {
    return;
  }

  // Stop at nested functions. The caller passes the computed callback's body
  // (not the function node itself) as the entry point, so any function node
  // we encounter while walking children is a nested function whose interior
  // is not synchronously tracked by Angular.
  if (isFunctionNode(node)) {
    return;
  }

  if (conditional && node.type === 'CallExpression' && Array.isArray(node.arguments) && node.arguments.length === 0) {
    const match = classifySignalRead(node.callee, state);

    if (match) {
      state.violations.push({ node, signalName: match.name, source: match.source });
    }
  }

  walkChildren(node, conditional, state);
}

/**
 * Returns the signal-name match for `callee` when it reads a known signal:
 * either a `this.<name>` access where `<name>` is a class signal property,
 * or a bare `<name>` identifier where `<name>` is a module-level signal
 * `const`. Returns null otherwise.
 *
 * Cross-class accesses (`this.someService.someSignal()`), method calls on
 * locals (`icons.reverse()`), and untracked identifiers (`Math.random()`)
 * return null: the rule prefers silent under-coverage to false positives.
 *
 * @param callee - The CallExpression's callee AST node.
 * @param state - The shared walk state (used to read the signal registries).
 * @returns Match details (signal name + source), or null when not a known signal read.
 */
function classifySignalRead(callee: AstNode, state: WalkState): Maybe<{ readonly name: string; readonly source: SignalSource }> {
  let result: Maybe<{ readonly name: string; readonly source: SignalSource }> = null;

  if (callee?.type === 'Identifier') {
    if (state.moduleSignalNames.has(callee.name)) {
      result = { name: callee.name, source: 'module' };
    }
  } else if (callee?.type === 'MemberExpression' && callee.computed === false && callee.object?.type === 'ThisExpression' && callee.property?.type === 'Identifier') {
    const propName: string = callee.property.name;

    if (state.classSignalNames?.has(propName) === true) {
      result = { name: propName, source: 'this' };
    }
  }

  return result;
}

/**
 * Recurses into the appropriate children of `node`, switching `conditional`
 * to true when descending into a branch that may not execute on every run.
 *
 * @param node - The current AST node whose children are walked.
 * @param conditional - True when `node` itself is in a conditional path.
 * @param state - Shared walk state.
 */
function walkChildren(node: AstNode, conditional: boolean, state: WalkState): void {
  switch (node.type) {
    case 'IfStatement':
      walk(node.test, conditional, state);
      walk(node.consequent, true, state);
      walk(node.alternate, true, state);
      break;
    case 'ConditionalExpression':
      walk(node.test, conditional, state);
      walk(node.consequent, true, state);
      walk(node.alternate, true, state);
      break;
    case 'LogicalExpression':
      // `&&`, `||`, and `??` all short-circuit: the right operand only runs
      // when the left operand triggers the corresponding short-circuit miss.
      walk(node.left, conditional, state);
      walk(node.right, true, state);
      break;
    case 'SwitchStatement':
      walk(node.discriminant, conditional, state);
      for (const switchCase of node.cases ?? []) {
        walk(switchCase.test, conditional, state);
        for (const statement of switchCase.consequent ?? []) {
          walk(statement, true, state);
        }
      }
      break;
    case 'ForStatement':
      walk(node.init, conditional, state);
      walk(node.test, conditional, state);
      walk(node.update, true, state);
      walk(node.body, true, state);
      break;
    case 'ForInStatement':
    case 'ForOfStatement':
      walk(node.left, conditional, state);
      walk(node.right, conditional, state);
      walk(node.body, true, state);
      break;
    case 'WhileStatement':
    case 'DoWhileStatement':
      walk(node.test, conditional, state);
      walk(node.body, true, state);
      break;
    case 'TryStatement':
      walk(node.block, conditional, state);
      walk(node.handler, true, state);
      walk(node.finalizer, conditional, state);
      break;
    default:
      walkGenericChildren(node, conditional, state);
  }
}

/**
 * Generic AST-walking fallback used for node types that do not introduce
 * conditional execution. Recurses into every object-valued or array-valued
 * property whose value looks like an AST node.
 *
 * @param node - The current AST node.
 * @param conditional - True when `node` itself is in a conditional path.
 * @param state - Shared walk state.
 */
function walkGenericChildren(node: AstNode, conditional: boolean, state: WalkState): void {
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range' || key === 'start' || key === 'end') {
      continue;
    }

    const child = node[key];

    if (Array.isArray(child)) {
      for (const entry of child) {
        walk(entry, conditional, state);
      }
    } else if (child && typeof child === 'object' && typeof child.type === 'string') {
      walk(child, conditional, state);
    }
  }
}

/**
 * Emits one diagnostic per accumulated violation. The first emitted report
 * carries a combined autofix that hoists each flagged signal read to the top
 * of the callback body and replaces every flagged call with the hoisted
 * local. Subsequent reports do not carry a fix because `--fix` will already
 * have rewritten them via the first report's fix.
 *
 * @param callback - The Function/ArrowFunction AST node passed to `computed(...)`.
 * @param violations - Conditional signal reads collected during the walk.
 * @param context - The ESLint rule context.
 */
function reportViolations(callback: AstNode, violations: readonly Violation[], context: AstNode): void {
  const sourceCode: AstNode = context.sourceCode ?? context.getSourceCode?.();
  const plan = buildFixPlan(callback, violations, sourceCode);

  violations.forEach((violation, index) => {
    context.report({
      node: violation.node,
      messageId: 'conditionalSignalRead',
      data: { call: getCallPreview(violation.node, context) },
      fix: index === 0 && plan ? (fixer: AstNode) => applyFixPlan(fixer, plan, sourceCode) : undefined
    });
  });
}

/**
 * Per-callback fix plan: the callback whose body needs hoists prepended (or
 * converted from expression to block form), together with the resolved local
 * variable name for each unique signal and the call expressions to be
 * replaced.
 */
interface FixPlan {
  /**
   * The Function/ArrowFunction AST node whose body the hoists are inserted into.
   */
  readonly callback: AstNode;
  /**
   * The original callback body — either a BlockStatement that is mutated in
   * place, or the expression that is wrapped into a fresh BlockStatement.
   */
  readonly body: AstNode;
  /**
   * Map from signal name to the resolved local variable name (e.g.
   * `xSignal` → `x`). Signals whose preferred local name collided with an
   * existing binding are omitted; their call sites are not replaced.
   */
  readonly localNames: ReadonlyMap<string, FixPlanLocal>;
  /**
   * The call expressions that should be replaced with their hoisted local.
   * Order is irrelevant; ESLint resolves replacements by AST node range.
   */
  readonly replacements: readonly Violation[];
}

/**
 * Local-variable plan for a single unique signal in a callback.
 */
interface FixPlanLocal {
  /**
   * The chosen identifier name for the hoisted local.
   */
  readonly name: string;
  /**
   * Source of the signal (used to build the right-hand side of the hoist).
   */
  readonly source: SignalSource;
}

/**
 * Plans the hoisting transformation for a callback whose violations have
 * been collected. Returns null when no hoist can be planned (e.g. every
 * candidate name would shadow an existing binding).
 *
 * @param callback - The Function/ArrowFunction AST node passed to `computed(...)`.
 * @param violations - Conditional signal reads collected during the walk.
 * @param sourceCode - The ESLint sourceCode service.
 * @returns A fix plan, or null when no hoist is possible.
 */
function buildFixPlan(callback: AstNode, violations: readonly Violation[], sourceCode: AstNode): Maybe<FixPlan> {
  const body = callback?.body;
  let result: Maybe<FixPlan> = null;

  if (body) {
    const existingLocals = collectExistingLocalNames(body);
    const localNames = new Map<string, FixPlanLocal>();
    const usedNames = new Set<string>(existingLocals);

    for (const violation of violations) {
      if (localNames.has(violation.signalName)) {
        continue;
      }

      const preferred = computeLocalName(violation.signalName);

      if (usedNames.has(preferred)) {
        continue;
      }

      usedNames.add(preferred);
      localNames.set(violation.signalName, { name: preferred, source: violation.source });
    }

    if (localNames.size > 0) {
      const replacements = violations.filter((violation) => localNames.has(violation.signalName));

      if (replacements.length > 0) {
        result = { callback, body, localNames, replacements };
      }
    }
  }

  // Silence the unused-parameter warning until sourceCode is needed elsewhere
  // in the planning stage (e.g. to inspect indent). Kept on the signature so
  // future enhancements can read tokens / whitespace without changing callers.
  void sourceCode;
  return result;
}

/**
 * Computes the local variable name for a signal property name. Strips the
 * trailing `Signal` suffix when present (`xSignal` → `x`, `_configSignal` →
 * `_config`); otherwise returns the original name unchanged.
 *
 * A name that is purely `'Signal'` is returned as-is rather than stripped
 * to an empty string.
 *
 * @param signalName - The signal property name to derive the local from.
 * @returns The local variable name.
 */
function computeLocalName(signalName: string): string {
  const suffix = 'Signal';
  let result = signalName;

  if (signalName.length > suffix.length && signalName.endsWith(suffix)) {
    result = signalName.slice(0, signalName.length - suffix.length);
  }

  return result;
}

/**
 * Collects all identifier names introduced by `VariableDeclarator`s within
 * the function body's top-level statements (the only locations a hoist
 * could possibly shadow). Nested function bodies and inner block scopes are
 * not inspected — shadowing those is harmless.
 *
 * Also accepts expression-body callbacks: an expression body cannot declare
 * locals, so it contributes no names.
 *
 * @param body - The callback's BlockStatement or expression AST node.
 * @returns Identifier names already declared in the body's scope.
 */
function collectExistingLocalNames(body: AstNode): Set<string> {
  const names = new Set<string>();

  if (body?.type === 'BlockStatement') {
    for (const statement of body.body ?? []) {
      if (statement?.type === 'VariableDeclaration') {
        for (const declarator of statement.declarations ?? []) {
          collectPatternNames(declarator?.id, names);
        }
      }
    }
  }

  return names;
}

/**
 * Recursively collects identifier names introduced by a destructuring
 * pattern (or a plain Identifier). Handles ObjectPattern, ArrayPattern,
 * RestElement, and AssignmentPattern; ignores other shapes.
 *
 * @param pattern - The Identifier or destructuring pattern AST node.
 * @param names - The set that is mutated with discovered names.
 */
function collectPatternNames(pattern: AstNode, names: Set<string>): void {
  if (!pattern || typeof pattern.type !== 'string') {
    return;
  }

  switch (pattern.type) {
    case 'Identifier':
      names.add(pattern.name);
      break;
    case 'ObjectPattern':
      for (const property of pattern.properties ?? []) {
        if (property?.type === 'Property') {
          collectPatternNames(property.value, names);
        } else if (property?.type === 'RestElement') {
          collectPatternNames(property.argument, names);
        }
      }
      break;
    case 'ArrayPattern':
      for (const element of pattern.elements ?? []) {
        collectPatternNames(element, names);
      }
      break;
    case 'RestElement':
      collectPatternNames(pattern.argument, names);
      break;
    case 'AssignmentPattern':
      collectPatternNames(pattern.left, names);
      break;
    default:
    // ignore unknown shapes
  }
}

/**
 * Applies a fix plan, returning the list of fixer operations that hoist each
 * planned signal read and replace its flagged call sites.
 *
 * For BlockStatement bodies the hoists are inserted before the first
 * statement (or after the opening brace when the body is empty). For
 * expression-body callbacks the entire body expression is replaced with a
 * BlockStatement that contains the hoists followed by a `return <expr>;`.
 *
 * @param fixer - The ESLint RuleFixer.
 * @param plan - The fix plan to apply.
 * @param sourceCode - The ESLint sourceCode service.
 * @returns The list of fixer operations.
 */
function applyFixPlan(fixer: AstNode, plan: FixPlan, sourceCode: AstNode): AstNode[] {
  const fixes: AstNode[] = [];
  const hoistLines: string[] = [];

  for (const [signalName, local] of plan.localNames) {
    const rhs = local.source === 'this' ? `this.${signalName}()` : `${signalName}()`;
    hoistLines.push(`const ${local.name} = ${rhs};`);
  }

  if (plan.body.type === 'BlockStatement') {
    const indent = getBlockIndent(plan.body, sourceCode);
    const firstStatement = plan.body.body?.[0];

    if (firstStatement) {
      // `insertTextBefore(firstStatement, …)` inserts at the position of the
      // first non-whitespace character of the statement; the existing line
      // already carries the leading indent up to that position. So the first
      // hoist line is emitted WITHOUT a leading indent (it reuses the
      // existing one), every subsequent line carries the full indent, and
      // the trailing `\n${indent}` re-establishes the indent for the
      // original statement that follows.
      const hoistText = hoistLines.map((line, index) => (index === 0 ? line : `${indent}${line}`)).join('\n');
      fixes.push(fixer.insertTextBefore(firstStatement, `${hoistText}\n${indent}`));
    } else {
      const openBrace = sourceCode.getFirstToken(plan.body);

      if (openBrace) {
        const hoistText = hoistLines.map((line) => `${indent}${line}`).join('\n');
        fixes.push(fixer.insertTextAfter(openBrace, `\n${hoistText}\n`));
      }
    }

    for (const replacement of plan.replacements) {
      const local = plan.localNames.get(replacement.signalName);

      if (local) {
        fixes.push(fixer.replaceText(replacement.node, local.name));
      }
    }
  } else {
    // Expression body: rewrite `(arg) => <expr>` to
    // `(arg) => { …hoists; return <expr-with-substitutions>; }`. The body
    // replacement covers every flagged call site, so per-call replacements
    // are baked into the substituted expression text rather than emitted as
    // separate fixer operations (which would overlap the body replacement).
    const baseIndent = getStatementIndent(plan.callback, sourceCode);
    const innerIndent = `${baseIndent}  `;
    const hoistText = hoistLines.map((line) => `${innerIndent}${line}`).join('\n');
    const substitutedExpr = substituteInExpression(plan, sourceCode);
    fixes.push(fixer.replaceText(plan.body, `{\n${hoistText}\n${innerIndent}return ${substitutedExpr};\n${baseIndent}}`));
  }

  return fixes;
}

/**
 * Returns the leading-whitespace indent of the line that contains the start
 * of `node`. Used to align the inserted block body with the surrounding
 * statement (e.g. the `readonly fooSignal = computed(() => …)` line).
 *
 * Falls back to an empty string when the node has no detectable line indent.
 *
 * @param node - The AST node whose enclosing line indent is wanted.
 * @param sourceCode - The ESLint sourceCode service.
 * @returns The indent string (spaces / tabs), or `''` when none can be derived.
 */
function getStatementIndent(node: AstNode, sourceCode: AstNode): string {
  const source: string = sourceCode.text ?? sourceCode.getText?.() ?? '';
  const start: number = node.range[0];
  let lineStart = start;
  let result = '';

  while (lineStart > 0 && source[lineStart - 1] !== '\n') {
    lineStart -= 1;
  }

  const slice = source.slice(lineStart, start);
  const match = /^[ \t]*/.exec(slice);

  if (match) {
    result = match[0];
  }

  return result;
}

/**
 * Builds the substituted text for an expression-body callback by walking the
 * raw source text and swapping each flagged call's source range for its
 * hoisted local name. Replacements are applied right-to-left so earlier
 * ranges stay valid as the string is mutated.
 *
 * @param plan - The fix plan whose body is an expression.
 * @param sourceCode - The ESLint sourceCode service.
 * @returns The expression text with every flagged call site replaced.
 */
function substituteInExpression(plan: FixPlan, sourceCode: AstNode): string {
  const bodyStart: number = plan.body.range[0];
  const ordered = [...plan.replacements].sort((a, b) => b.node.range[0] - a.node.range[0]);
  let result: string = sourceCode.getText(plan.body);

  for (const replacement of ordered) {
    const local = plan.localNames.get(replacement.signalName);

    if (local) {
      const start: number = replacement.node.range[0] - bodyStart;
      const end: number = replacement.node.range[1] - bodyStart;
      result = result.slice(0, start) + local.name + result.slice(end);
    }
  }

  return result;
}

/**
 * Returns the indent string (whitespace before the first statement) for a
 * BlockStatement, falling back to a sensible default (`'  '`) when the
 * block contains no statements or no leading whitespace can be located.
 *
 * @param block - The BlockStatement AST node.
 * @param sourceCode - The ESLint sourceCode service.
 * @returns The indent string to use for inserted hoist lines.
 */
function getBlockIndent(block: AstNode, sourceCode: AstNode): string {
  const firstStatement = block.body?.[0];
  let result = '  ';

  if (firstStatement) {
    const source: string = sourceCode.text ?? sourceCode.getText?.() ?? '';
    const textBefore: string = source.slice(block.range[0], firstStatement.range[0]);
    const match = /(?:^|\n)([ \t]*)$/.exec(textBefore);

    if (match) {
      result = match[1];
    }
  }

  return result;
}

/**
 * Returns a short, human-readable textual preview of the call expression,
 * suitable for inclusion in the diagnostic message. Falls back to `'signal'`
 * when the source code is unavailable.
 *
 * @param node - The CallExpression AST node.
 * @param context - The ESLint rule context (used to access `sourceCode`).
 * @returns A truncated textual preview of the call.
 */
function getCallPreview(node: AstNode, context: AstNode): string {
  const sourceCode: Maybe<AstNode> = context.sourceCode ?? context.getSourceCode?.();
  let preview = 'signal';

  if (sourceCode && node.callee) {
    const calleeText: string = sourceCode.getText(node.callee);
    preview = `${calleeText}()`;

    if (preview.length > CALL_PREVIEW_MAX_LENGTH) {
      preview = `${preview.slice(0, CALL_PREVIEW_MAX_LENGTH - 3)}...`;
    }
  }

  return preview;
}
