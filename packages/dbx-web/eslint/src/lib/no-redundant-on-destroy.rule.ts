import { type AstNode, CLEAN_HELPER, CLEAN_SUBSCRIPTION_HELPER, COMPLETE_ON_DESTROY_HELPER, createImportRegistry, findAngularComponentDecorator, findNgOnDestroyMethod, getClassMemberName, isCalledIdentifier, isDeclareProperty, isStaticProperty, isThisMemberAccess, trackImportDeclaration } from './util';
import { getStatementRangeWithLeadingWhitespace } from './require-clean-subscription.rule';

/**
 * Identifier names that, when used to wrap a class field initializer, mean the
 * field's cleanup is registered with Angular DestroyRef and a manual
 * `.destroy()` / `.complete()` call in ngOnDestroy is redundant.
 */
const HELPER_NAMES: ReadonlySet<string> = new Set([CLEAN_SUBSCRIPTION_HELPER, COMPLETE_ON_DESTROY_HELPER, CLEAN_HELPER]);

/**
 * Method names on a wrapped field whose call inside ngOnDestroy is redundant.
 */
const REDUNDANT_METHODS: ReadonlySet<string> = new Set(['destroy', 'complete']);

/**
 * Details of a redundant `this.<field>.<method>()` cleanup statement.
 */
interface RedundantStatementMatch {
  /**
   * The ExpressionStatement node to remove.
   */
  readonly statement: AstNode;
  /**
   * The class field name (`this.<fieldName>`).
   */
  readonly fieldName: string;
  /**
   * The redundant method name (`destroy` or `complete`).
   */
  readonly method: string;
  /**
   * The wrapper helper used in the field's initializer (`cleanSubscription` etc.).
   */
  readonly wrapper: string;
}

/**
 * ESLint rule definition shape used by `no-redundant-on-destroy`.
 */
export interface DbxWebNoRedundantOnDestroyRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly redundantCleanupCall: string;
      readonly redundantNgOnDestroy: string;
      readonly emptyNgOnDestroy: string;
    };
    readonly schema: readonly object[];
  };
  create(context: AstNode): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule that flags `ngOnDestroy()` bodies whose statements are entirely
 * redundant `this.<field>.destroy()` / `this.<field>.complete()` calls on
 * fields whose initializer is wrapped with `cleanSubscription`,
 * `completeOnDestroy`, or `clean`.
 *
 * Auto-fix:
 * - Removes each redundant statement, plus its leading whitespace and trailing newline.
 * - Removes the `ngOnDestroy` method declaration when its body becomes empty.
 *   Does not touch the `implements OnDestroy` clause or the `OnDestroy` import
 *   — `eslint-plugin-unused-imports` handles the import; the implements clause
 *   should be cleaned up manually or by a future rule.
 */
export const dbxWebNoRedundantOnDestroyRule: DbxWebNoRedundantOnDestroyRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Disallow redundant ngOnDestroy calls when fields are already wrapped with cleanSubscription/completeOnDestroy/clean',
      recommended: true
    },
    messages: {
      redundantCleanupCall: 'Redundant `this.{{name}}.{{method}}()` — `{{name}}` is initialized via `{{wrapper}}(...)` which already registers cleanup with Angular DestroyRef.',
      redundantNgOnDestroy: '`ngOnDestroy()` only contains redundant cleanup calls for fields wrapped with cleanSubscription/completeOnDestroy/clean. Remove the method.',
      emptyNgOnDestroy: '`ngOnDestroy()` has an empty body. Remove the method.'
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

      const ngOnDestroy = findNgOnDestroyMethod(classNode);
      const body = ngOnDestroy?.value?.body?.body;

      if (!ngOnDestroy || !body) {
        return;
      }

      if (body.length === 0) {
        context.report({
          node: ngOnDestroy,
          messageId: 'emptyNgOnDestroy',
          fix: (fixer: AstNode) => [fixer.removeRange(getStatementRangeWithLeadingWhitespace(ngOnDestroy, sourceCode))]
        });
        return;
      }

      const wrappedFields = collectWrappedFieldNames(classNode);
      const redundantStatements: RedundantStatementMatch[] = [];
      let hasNonRedundantStatement = false;

      for (const statement of body) {
        const match = matchRedundantCleanupStatement(statement, wrappedFields);

        if (match) {
          redundantStatements.push(match);
        } else {
          hasNonRedundantStatement = true;
        }
      }

      if (redundantStatements.length === 0) {
        return;
      }

      if (hasNonRedundantStatement) {
        for (const entry of redundantStatements) {
          context.report({
            node: entry.statement,
            messageId: 'redundantCleanupCall',
            data: { name: entry.fieldName, method: entry.method, wrapper: entry.wrapper },
            fix: (fixer: AstNode) => [fixer.removeRange(getStatementRangeWithLeadingWhitespace(entry.statement, sourceCode))]
          });
        }
      } else {
        context.report({
          node: ngOnDestroy,
          messageId: 'redundantNgOnDestroy',
          fix: (fixer: AstNode) => [fixer.removeRange(getStatementRangeWithLeadingWhitespace(ngOnDestroy, sourceCode))]
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
 * Walks the class members and returns a map of property name to the wrapper
 * helper used in its initializer (`cleanSubscription`, `completeOnDestroy`, or
 * `clean`). Properties whose initializer is not a recognized wrapper are
 * omitted.
 *
 * @param classNode - The ClassDeclaration / ClassExpression AST node.
 * @returns Map of field name to wrapper helper name.
 */
function collectWrappedFieldNames(classNode: AstNode): Map<string, string> {
  const result = new Map<string, string>();
  const members = classNode.body?.body ?? [];

  for (const member of members) {
    if (member.type !== 'PropertyDefinition' || isStaticProperty(member) || isDeclareProperty(member)) {
      continue;
    }

    const propName = getClassMemberName(member);
    const wrapper = propName ? wrapperNameFromInitializer(member.value) : null;

    if (propName && wrapper) {
      result.set(propName, wrapper);
    }
  }

  return result;
}

/**
 * Returns the name of the cleanup helper wrapping the given initializer
 * expression, or null when the expression is not wrapped.
 *
 * @param expression - The initializer expression, or null/undefined.
 * @returns The wrapper helper name (`cleanSubscription` etc.) or null.
 */
function wrapperNameFromInitializer(expression: AstNode | null | undefined): string | null {
  return expression ? isCalledIdentifier(expression, HELPER_NAMES) : null;
}

/**
 * Returns details for a redundant cleanup statement, or null when the
 * statement is anything other than a redundant `this.<field>.<destroy|complete>()` call.
 *
 * @param statement - The body statement AST node.
 * @param wrappedFields - Map of class field names to their wrapper helper names.
 * @returns Match details, or null.
 */
function matchRedundantCleanupStatement(statement: AstNode, wrappedFields: Map<string, string>): RedundantStatementMatch | null {
  let result: RedundantStatementMatch | null = null;

  if (statement.type === 'ExpressionStatement') {
    const call = statement.expression;
    const isZeroArgMemberCall = call?.type === 'CallExpression' && call.arguments?.length === 0 && call.callee?.type === 'MemberExpression';

    if (isZeroArgMemberCall) {
      const callee = call.callee;
      const methodName = !callee.computed && callee.property?.type === 'Identifier' ? callee.property.name : null;

      if (methodName && REDUNDANT_METHODS.has(methodName) && callee.object?.type === 'MemberExpression' && callee.object.property?.type === 'Identifier' && !callee.object.computed) {
        const fieldName = callee.object.property.name;
        const wrapper = isThisMemberAccess(callee.object, fieldName) ? wrappedFields.get(fieldName) : undefined;

        if (wrapper) {
          result = { statement, fieldName, method: methodName, wrapper };
        }
      }
    }
  }

  return result;
}
