import { ANGULAR_COMPONENT_DECORATORS, type AstNode, CLEAN_HELPER, CLEAN_SUBSCRIPTION_HELPER, DEREEKB_DBX_CORE_MODULE, DEREEKB_RXJS_MODULE, type ImportRegistry, SUBSCRIPTION_OBJECT_NAME, createImportRegistry, ensureNamedImportFix, findAngularComponentDecorator, findNgOnDestroyMethod, getClassMemberName, isCalledIdentifier, isDeclareProperty, isImportedFrom, isStaticProperty, isThisMemberAccess, trackImportDeclaration } from './util';

/**
 * Identifier names accepted as the wrapper around a manual `new SubscriptionObject(...)`.
 */
const ACCEPTED_WRAPPERS: ReadonlySet<string> = new Set([CLEAN_SUBSCRIPTION_HELPER, CLEAN_HELPER]);

/**
 * ESLint rule definition shape used by `require-clean-subscription`.
 */
export interface DbxWebRequireCleanSubscriptionRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly missingCleanSubscription: string;
    };
    readonly schema: readonly object[];
  };
  create(context: AstNode): Record<string, (node: AstNode) => void>;
}

/**
 * Input for {@link buildSubscriptionObjectFix}.
 */
interface BuildSubscriptionObjectFixInput {
  /**
   * The ESLint RuleFixer.
   */
  readonly fixer: AstNode;
  /**
   * The flagged NewExpression (the original `new SubscriptionObject(...)` initializer).
   */
  readonly newExpr: AstNode;
  /**
   * The class property's name. Used to find matching `this.<name>.destroy()` statements.
   */
  readonly propName: string;
  /**
   * The class's `ngOnDestroy()` MethodDefinition node, or null.
   */
  readonly ngOnDestroy: AstNode | null;
  /**
   * The file's import registry, mutated as fixes are queued.
   */
  readonly registry: ImportRegistry;
  /**
   * The ESLint sourceCode service for the current file.
   */
  readonly sourceCode: AstNode;
}

/**
 * Input for {@link collectNgOnDestroyRemovalFixes}.
 */
export interface CollectNgOnDestroyRemovalFixesInput {
  /**
   * The ESLint RuleFixer.
   */
  readonly fixer: AstNode;
  /**
   * The MethodDefinition node for `ngOnDestroy`.
   */
  readonly ngOnDestroy: AstNode;
  /**
   * The class field name to match against `this.<name>`.
   */
  readonly propName: string;
  /**
   * The method name on the field to match (`destroy` or `complete`).
   */
  readonly methodName: string;
  /**
   * The ESLint sourceCode service for the current file.
   */
  readonly sourceCode: AstNode;
  /**
   * The fix collector array. Mutated.
   */
  readonly fixes: AstNode[];
}

/**
 * ESLint rule that requires class-field initializers of `new SubscriptionObject(...)`
 * to be replaced with `cleanSubscription(...)` (which auto-registers cleanup with
 * Angular's DestroyRef) on `@Component` / `@Directive` / `@Pipe` classes.
 *
 * Fires only when `SubscriptionObject` is imported from `@dereekb/rxjs`.
 *
 * Auto-fix:
 * - Rewrites the initializer to `cleanSubscription(...)` (preserving any constructor argument).
 * - Inserts the `cleanSubscription` named import from `@dereekb/dbx-core` if missing.
 * - Removes any matching `this.<field>.destroy();` line from the same class's `ngOnDestroy`.
 */
export const dbxWebRequireCleanSubscriptionRule: DbxWebRequireCleanSubscriptionRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Require cleanSubscription() instead of new SubscriptionObject() in Angular component, directive, or pipe classes',
      recommended: true
    },
    messages: {
      missingCleanSubscription: 'Replace `new SubscriptionObject(...)` with `cleanSubscription(...)` from @dereekb/dbx-core. cleanSubscription registers cleanup with Angular DestroyRef automatically, removing the need for manual destroy() in ngOnDestroy.'
    },
    schema: []
  },
  create(context: AstNode) {
    const registry = createImportRegistry();
    const sourceCode = context.sourceCode;

    const visitClass = (classNode: AstNode): void => {
      const matchedDecorator = findAngularComponentDecorator(classNode, registry);

      if (!matchedDecorator) {
        return;
      }

      const members = classNode.body?.body ?? [];
      const ngOnDestroy = findNgOnDestroyMethod(classNode);

      for (const member of members) {
        if (member.type !== 'PropertyDefinition' || isStaticProperty(member) || isDeclareProperty(member)) {
          continue;
        }

        const propName = getClassMemberName(member);
        const initializer = member.value;

        if (!propName || !initializer) {
          continue;
        }

        if (!isUnwrappedSubscriptionObjectNew(initializer, registry)) {
          continue;
        }

        context.report({
          node: initializer,
          messageId: 'missingCleanSubscription',
          fix: (fixer: AstNode) =>
            buildSubscriptionObjectFix({
              fixer,
              newExpr: initializer,
              propName,
              ngOnDestroy,
              registry,
              sourceCode
            })
        });
      }
    };

    return {
      ImportDeclaration(node: AstNode) {
        trackImportDeclaration(registry, node);
      },
      ClassDeclaration(classNode: AstNode) {
        visitClass(classNode);
      },
      ClassExpression(classNode: AstNode) {
        visitClass(classNode);
      }
    };
  }
};

/**
 * Returns true when the given initializer is a bare `new SubscriptionObject(...)`
 * expression where `SubscriptionObject` resolves to the import from `@dereekb/rxjs`.
 *
 * Returns false when the expression is wrapped (e.g. `cleanSubscription(...)` or
 * `clean(new SubscriptionObject(...))`).
 *
 * @param expression - The initializer expression AST node.
 * @param registry - The file's import registry.
 * @returns True when the expression is a flagged unwrapped `new SubscriptionObject(...)`.
 */
function isUnwrappedSubscriptionObjectNew(expression: AstNode, registry: ImportRegistry): boolean {
  let result = false;

  if (!isCalledIdentifier(expression, ACCEPTED_WRAPPERS) && expression.type === 'NewExpression') {
    const callee = expression.callee;

    if (callee?.type === 'Identifier' && callee.name === SUBSCRIPTION_OBJECT_NAME && isImportedFrom(registry, SUBSCRIPTION_OBJECT_NAME, DEREEKB_RXJS_MODULE)) {
      result = true;
    }
  }

  return result;
}

/**
 * Builds the composite fix for one violating property.
 *
 * @param input - The flagged expression, its property name, the class's ngOnDestroy node, the import registry, and source-code services.
 * @returns A list of fix operations, or null when no fix is producible.
 */
function buildSubscriptionObjectFix(input: BuildSubscriptionObjectFixInput): AstNode[] | null {
  const { fixer, newExpr, propName, ngOnDestroy, registry, sourceCode } = input;
  const calleeRange = newExpr.callee?.range;
  let fixes: AstNode[] | null = null;

  if (calleeRange) {
    const collected: AstNode[] = [];

    collected.push(fixer.replaceTextRange([newExpr.range[0], calleeRange[1]], CLEAN_SUBSCRIPTION_HELPER));

    const importFix = ensureNamedImportFix({ fixer, registry, importName: CLEAN_SUBSCRIPTION_HELPER, fromSource: DEREEKB_DBX_CORE_MODULE });

    if (importFix) {
      collected.push(importFix);
    }

    if (ANGULAR_COMPONENT_DECORATORS.size > 0 && ngOnDestroy) {
      collectNgOnDestroyRemovalFixes({
        fixer,
        ngOnDestroy,
        propName,
        methodName: 'destroy',
        sourceCode,
        fixes: collected
      });
    }

    fixes = collected;
  }

  return fixes;
}

/**
 * Pushes fixes that remove `this.<propName>.<methodName>()` ExpressionStatements
 * from `ngOnDestroy`'s body. Removes the statement node and any preceding
 * indentation on the same line so a blank line isn't left behind.
 *
 * @param input - The fixer, ngOnDestroy method, target property/method names, source-code service, and fix collector.
 */
export function collectNgOnDestroyRemovalFixes(input: CollectNgOnDestroyRemovalFixesInput): void {
  const { fixer, ngOnDestroy, propName, methodName, sourceCode, fixes } = input;
  const body = ngOnDestroy.value?.body?.body;

  if (!body) {
    return;
  }

  for (const statement of body) {
    if (statement.type !== 'ExpressionStatement') {
      continue;
    }

    const call = statement.expression;

    if (call?.type !== 'CallExpression' || call.callee?.type !== 'MemberExpression') {
      continue;
    }

    const member = call.callee;

    if (member.computed || member.property?.type !== 'Identifier' || member.property.name !== methodName) {
      continue;
    }

    if (!isThisMemberAccess(member.object, propName)) {
      continue;
    }

    fixes.push(fixer.removeRange(getStatementRangeWithLeadingWhitespace(statement, sourceCode)));
  }
}

/**
 * Returns the range to remove for a statement, expanded to include any
 * leading whitespace on the same line and the trailing newline. This avoids
 * leaving a blank line after fix application.
 *
 * @param statement - The ExpressionStatement AST node.
 * @param sourceCode - The ESLint sourceCode service.
 * @returns A range tuple `[start, end]` to pass to `fixer.removeRange`.
 */
export function getStatementRangeWithLeadingWhitespace(statement: AstNode, sourceCode: AstNode): readonly [number, number] {
  const sourceText: string = sourceCode.text;
  const start: number = statement.range[0];
  const end: number = statement.range[1];

  let lineStart = start;

  while (lineStart > 0 && sourceText[lineStart - 1] !== '\n') {
    lineStart -= 1;
  }

  let lineEnd = end;

  if (lineEnd < sourceText.length && sourceText[lineEnd] === '\n') {
    lineEnd += 1;
  }

  return [lineStart, lineEnd];
}
