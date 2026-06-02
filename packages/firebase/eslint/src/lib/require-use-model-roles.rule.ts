import type { Maybe } from '@dereekb/util';
import { type AstNode } from './util';

/**
 * Default method names this rule inspects for a `roles` selection option.
 *
 * Matches `nest.useModel(...)` and the multi-model `nest.useMultipleModels(...)`,
 * both of which accept an optional `roles` selection option.
 */
export const DEFAULT_USE_MODEL_METHOD_NAMES = ['useModel', 'useMultipleModels'] as const;

/**
 * Options for the require-use-model-roles rule.
 */
export interface FirebaseRequireUseModelRolesRuleOptions {
  readonly methodNames?: readonly string[];
  readonly additionalMethodNames?: readonly string[];
}

/**
 * ESLint rule definition for require-use-model-roles.
 */
export interface FirebaseRequireUseModelRolesRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireUseModelRolesRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void }): Record<string, (node: AstNode) => void>;
}

/**
 * Returns the called method name when the call is a non-computed member-expression call
 * (e.g. `nest.useModel(...)`, `this._nestContext.useMultipleModels(...)`) whose method is
 * in the tracked set, otherwise null.
 */
function trackedMethodName(node: AstNode, methodNames: ReadonlySet<string>): Maybe<string> {
  let result: Maybe<string> = null;
  const callee = node.callee;

  if (callee?.type === 'MemberExpression' && !callee.computed && callee.property?.type === 'Identifier') {
    const name: string = callee.property.name;
    if (methodNames.has(name)) {
      result = name;
    }
  }

  return result;
}

/**
 * Returns true when the object literal explicitly declares a `roles` property, or contains a
 * spread element (in which case `roles` may originate from the spread and cannot be ruled out).
 */
function hasRolesPropertyOrSpread(objectNode: AstNode): boolean {
  let result = false;
  const properties: AstNode[] = objectNode.properties ?? [];

  for (const property of properties) {
    if (property.type === 'SpreadElement' || property.type === 'ExperimentalSpreadProperty') {
      result = true;
      break;
    }

    if (property.type === 'Property' && !property.computed) {
      const key = property.key;
      const keyName = key?.type === 'Identifier' ? key.name : key?.type === 'Literal' ? String(key.value) : undefined;

      if (keyName === 'roles') {
        result = true;
        break;
      }
    }
  }

  return result;
}

/**
 * ESLint rule that warns when a `nest.useModel(...)` / `nest.useMultipleModels(...)` selection
 * does not specify a `roles` option. The `roles` option declares which granted roles the caller
 * requires for the selected model; omitting it silently runs the selection without an explicit
 * role assertion.
 *
 * Intentionally role-free selections are still allowed: pass `roles: []` to assert "no role
 * required", or add an inline eslint-disable for this rule. The rule only checks for the presence
 * of a `roles` property, so an empty array satisfies it.
 *
 * The rule matches by AST shape (member-expression method call) rather than receiver name, so it
 * covers `nest.useModel(...)`, `this._nestContext.useModel(...)`, etc. When the selection argument
 * is not an inline object literal (an identifier/variable, conditional, call result, or a literal
 * containing a spread), the rule skips it to avoid false positives.
 *
 * Not auto-fixable: the rule cannot infer the correct role(s) for a given selection.
 */
export const FIREBASE_REQUIRE_USE_MODEL_ROLES_RULE: FirebaseRequireUseModelRolesRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: 'Require an explicit `roles` selection option on `useModel` / `useMultipleModels` calls so model access asserts the roles it requires. Pass `roles: []` to intentionally require no role.',
      recommended: true
    },
    messages: {
      missingRoles: "`{{name}}(...)` does not specify `roles`. Pass a `roles` value (e.g. `roles: 'read'`), or `roles: []` to intentionally require no role, or add an inline eslint-disable for this rule."
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          methodNames: { type: 'array' as const, items: { type: 'string' as const } },
          additionalMethodNames: { type: 'array' as const, items: { type: 'string' as const } }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const baseNames = options.methodNames ?? DEFAULT_USE_MODEL_METHOD_NAMES;
    const methodNames: ReadonlySet<string> = new Set([...baseNames, ...(options.additionalMethodNames ?? [])]);

    return {
      CallExpression: (node: AstNode) => {
        const name = trackedMethodName(node, methodNames);

        if (name) {
          const selection = node.arguments?.[1];

          if (selection?.type === 'ObjectExpression' && !hasRolesPropertyOrSpread(selection)) {
            context.report({ node: node.callee, messageId: 'missingRoles', data: { name } });
          }
        }
      }
    };
  }
};
