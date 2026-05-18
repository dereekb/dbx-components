import { type AstNode, CLEAN_HELPER, CLEAN_SUBSCRIPTION_HELPER, COMPLETE_ON_DESTROY_HELPER, createImportRegistry, findAngularComponentDecorator, findNgOnDestroyMethod, findOnDestroyImplementsClause, getClassMemberName, getImplementsSpecifierRemovalRange, type ImportRegistry, isCalledIdentifier, isDeclareProperty, isStaticProperty, isThisMemberAccess, trackImportDeclaration } from './util';
import type { Maybe } from '@dereekb/util';
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
      readonly orphanedImplementsOnDestroy: string;
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
 * - When the `ngOnDestroy` method is removed entirely, also removes the
 *   `implements OnDestroy` clause from the class (verified against the
 *   `@angular/core` import). The now-unused `OnDestroy` import is left for
 *   `eslint-plugin-unused-imports` to clean up.
 * - When a class declares `implements OnDestroy` from `@angular/core` but has
 *   no `ngOnDestroy()` method (e.g. left over from a previous run), the
 *   orphaned implements clause is removed.
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
      emptyNgOnDestroy: '`ngOnDestroy()` has an empty body. Remove the method.',
      orphanedImplementsOnDestroy: 'Class declares `implements OnDestroy` but has no `ngOnDestroy()` method. Remove the implements clause.'
    },
    schema: []
  },
  create(context: AstNode) {
    const registry = createImportRegistry();
    const sourceCode = context.sourceCode;

    const reportOrphanedImplements = (classNode: AstNode): void => {
      const implementsMatch = findOnDestroyImplementsClause(classNode, registry);

      if (implementsMatch) {
        context.report({
          node: implementsMatch.clauseSpecifier,
          messageId: 'orphanedImplementsOnDestroy',
          fix: (fixer: AstNode) => [fixer.removeRange(getImplementsSpecifierRemovalRange(implementsMatch, sourceCode))]
        });
      }
    };

    const reportRemoveNgOnDestroy = (ngOnDestroy: AstNode, classNode: AstNode, messageId: 'emptyNgOnDestroy' | 'redundantNgOnDestroy'): void => {
      context.report({
        node: ngOnDestroy,
        messageId,
        fix: (fixer: AstNode) => buildRemoveNgOnDestroyFixes({ fixer, ngOnDestroy, classNode, registry, sourceCode })
      });
    };

    const reportRedundantStatements = (entries: readonly RedundantStatementMatch[]): void => {
      for (const entry of entries) {
        context.report({
          node: entry.statement,
          messageId: 'redundantCleanupCall',
          data: { name: entry.fieldName, method: entry.method, wrapper: entry.wrapper },
          fix: (fixer: AstNode) => [fixer.removeRange(getStatementRangeWithLeadingWhitespace(entry.statement, sourceCode))]
        });
      }
    };

    const visitNgOnDestroyBody = (ngOnDestroy: AstNode, body: readonly AstNode[], classNode: AstNode): void => {
      const { redundantStatements, hasNonRedundantStatement } = partitionNgOnDestroyStatements(body, classNode);

      if (redundantStatements.length > 0) {
        if (hasNonRedundantStatement) {
          reportRedundantStatements(redundantStatements);
        } else {
          reportRemoveNgOnDestroy(ngOnDestroy, classNode, 'redundantNgOnDestroy');
        }
      }
    };

    const visitClass = (classNode: AstNode): void => {
      if (findAngularComponentDecorator(classNode, registry)) {
        const ngOnDestroy = findNgOnDestroyMethod(classNode);
        const body = ngOnDestroy?.value?.body?.body;

        if (!ngOnDestroy || !body) {
          reportOrphanedImplements(classNode);
        } else if (body.length === 0) {
          reportRemoveNgOnDestroy(ngOnDestroy, classNode, 'emptyNgOnDestroy');
        } else {
          visitNgOnDestroyBody(ngOnDestroy, body, classNode);
        }
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
function wrapperNameFromInitializer(expression: Maybe<AstNode>): Maybe<string> {
  return expression ? isCalledIdentifier(expression, HELPER_NAMES) : null;
}

/**
 * Splits an `ngOnDestroy` body into redundant cleanup matches and a flag
 * indicating whether any other (non-redundant) statement is present.
 *
 * @param body - The statements of the `ngOnDestroy` method body.
 * @param classNode - The owning class node, used to gather wrapped fields.
 * @returns The redundant matches and the non-redundant flag.
 */
function partitionNgOnDestroyStatements(body: readonly AstNode[], classNode: AstNode): { readonly redundantStatements: RedundantStatementMatch[]; readonly hasNonRedundantStatement: boolean } {
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

  return { redundantStatements, hasNonRedundantStatement };
}

/**
 * Returns the redundant method name (`destroy` / `complete`) when the call
 * expression is a zero-argument member call to one of those methods.
 *
 * @param expression - The expression to inspect.
 * @returns The method name and its callee MemberExpression, or null.
 */
function getRedundantMethodCall(expression: Maybe<AstNode>): Maybe<{ readonly methodName: string; readonly callee: AstNode }> {
  let result: Maybe<{ readonly methodName: string; readonly callee: AstNode }> = null;
  const isZeroArgMemberCall = expression?.type === 'CallExpression' && expression.arguments?.length === 0 && expression.callee?.type === 'MemberExpression';

  if (isZeroArgMemberCall) {
    const callee = expression.callee;
    const methodName = !callee.computed && callee.property?.type === 'Identifier' ? callee.property.name : null;

    if (methodName && REDUNDANT_METHODS.has(methodName)) {
      result = { methodName, callee };
    }
  }

  return result;
}

/**
 * Returns the `this.<fieldName>` field name from a callee object, or null
 * when the receiver is not a non-computed `this.<identifier>` access.
 *
 * @param calleeObject - The callee's object (the receiver of the method call).
 * @returns The field name or null.
 */
function getThisFieldName(calleeObject: Maybe<AstNode>): Maybe<string> {
  let result: Maybe<string> = null;

  if (calleeObject?.type === 'MemberExpression' && !calleeObject.computed && calleeObject.property?.type === 'Identifier') {
    const fieldName = calleeObject.property.name;

    if (isThisMemberAccess(calleeObject, fieldName)) {
      result = fieldName;
    }
  }

  return result;
}

/**
 * Returns details for a redundant cleanup statement, or null when the
 * statement is anything other than a redundant `this.<field>.<destroy|complete>()` call.
 *
 * @param statement - The body statement AST node.
 * @param wrappedFields - Map of class field names to their wrapper helper names.
 * @returns Match details, or null.
 */
function matchRedundantCleanupStatement(statement: AstNode, wrappedFields: Map<string, string>): Maybe<RedundantStatementMatch> {
  let result: Maybe<RedundantStatementMatch> = null;

  if (statement.type === 'ExpressionStatement') {
    const methodCall = getRedundantMethodCall(statement.expression);
    const fieldName = methodCall ? getThisFieldName(methodCall.callee.object) : null;
    const wrapper = fieldName ? wrappedFields.get(fieldName) : undefined;

    if (methodCall && fieldName && wrapper) {
      result = { statement, fieldName, method: methodCall.methodName, wrapper };
    }
  }

  return result;
}

/**
 * Input for {@link buildRemoveNgOnDestroyFixes}.
 */
interface BuildRemoveNgOnDestroyFixesInput {
  /**
   * The ESLint RuleFixer.
   */
  readonly fixer: AstNode;
  /**
   * The MethodDefinition node for `ngOnDestroy` to remove.
   */
  readonly ngOnDestroy: AstNode;
  /**
   * The class node owning the method.
   */
  readonly classNode: AstNode;
  /**
   * The file's import registry, used to verify the `OnDestroy` identifier
   * resolves to `@angular/core`.
   */
  readonly registry: ImportRegistry;
  /**
   * The ESLint sourceCode service.
   */
  readonly sourceCode: AstNode;
}

/**
 * Builds the fix list for removing the entire `ngOnDestroy` method along with
 * any matching `implements OnDestroy` clause from the class declaration.
 *
 * @param input - The fixer, method node, class node, registry, and source-code service.
 * @returns The fix operations to apply.
 */
function buildRemoveNgOnDestroyFixes(input: BuildRemoveNgOnDestroyFixesInput): AstNode[] {
  const { fixer, ngOnDestroy, classNode, registry, sourceCode } = input;
  const fixes: AstNode[] = [fixer.removeRange(getStatementRangeWithLeadingWhitespace(ngOnDestroy, sourceCode))];
  const implementsMatch = findOnDestroyImplementsClause(classNode, registry);

  if (implementsMatch) {
    fixes.push(fixer.removeRange(getImplementsSpecifierRemovalRange(implementsMatch, sourceCode)));
  }

  return fixes;
}
