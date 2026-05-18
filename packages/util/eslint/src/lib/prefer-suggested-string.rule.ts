interface AstNode {
  readonly type: string;
  // index signature keeps the loose-typed semantics of the original `= any`
  // so the rule body can freely navigate AST properties without churn.
  [key: string]: any;
}

/**
 * ESLint rule definition for prefer-suggested-string.
 */
export interface UtilPreferSuggestedStringRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly preferSuggestedString: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: { getText: (node: AstNode) => string } }): Record<string, (node: AstNode) => void>;
}

/**
 * Returns true when the type node is `TSStringKeyword`.
 *
 * @param node - The TS type AST node.
 * @returns True when the node is the `string` keyword.
 */
function isStringKeyword(node: AstNode): boolean {
  return node?.type === 'TSStringKeyword';
}

/**
 * Returns true when the type node is a `TSLiteralType` wrapping a string-valued `Literal`.
 *
 * @param node - The TS type AST node.
 * @returns True when the node is a string-literal type like `'foo'`.
 */
function isStringLiteralType(node: AstNode): boolean {
  return node?.type === 'TSLiteralType' && node.literal?.type === 'Literal' && typeof node.literal.value === 'string';
}

/**
 * Returns true when the type node is a union whose members are all string-literal types.
 *
 * Used to detect `('a' | 'b')` style template-parameter unions that some callers wrap in parens
 * before unioning with `string`.
 *
 * @param node - The TS type AST node.
 * @returns True when the node is a union of string literals.
 */
function isUnionOfStringLiterals(node: AstNode): boolean {
  return node?.type === 'TSUnionType' && Array.isArray(node.types) && node.types.length > 0 && node.types.every((t: AstNode) => isStringLiteralType(t));
}

/**
 * Returns true when the union member's "shape" is a literal string union member — either a direct
 * `'foo'` literal, or a parenthesized union of string literals.
 *
 * @param node - The TS type AST node.
 * @returns True when the node contributes a literal-string value to the surrounding union.
 */
function isLiteralStringContributor(node: AstNode): boolean {
  const unwrapped = node?.type === 'TSParenthesizedType' ? node.typeAnnotation : node;
  return isStringLiteralType(unwrapped) || isUnionOfStringLiterals(unwrapped);
}

/**
 * ESLint rule that warns on union types of the shape `'a' | 'b' | string` — a literal-string
 * union members alongside a bare `string` member.
 *
 * The TypeScript compiler collapses such a union to `string`, erasing IDE autocomplete for the
 * literal members. Two outcomes are sane:
 *
 * 1. If autocomplete-preserving behavior is actually wanted, switch to `SuggestedString<T>` from
 *    `@dereekb/util` (the named alias for the `'a' | 'b' | (string & {})` workaround).
 * 2. If any string is fine and literals were just documentation, drop the literal members and
 *    keep plain `string`.
 *
 * The rule is non-fixable: the right action depends on intent (#1 vs #2), and #1 also requires
 * adding an `import { type SuggestedString }` statement whose insertion point varies by file. The
 * warning message names both options so the developer can make the call.
 *
 * Only fires when the union contains BOTH a `TSStringKeyword` AND at least one literal-string
 * contributor. Unions like `string | number`, `'a' | 'b'`, or `string` alone are silent.
 */
export const UTIL_PREFER_SUGGESTED_STRING_RULE: UtilPreferSuggestedStringRuleDefinition = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Warn on `'a' | 'b' | string` unions — TypeScript collapses them to `string` and erases autocomplete. Prefer `SuggestedString<T>` from `@dereekb/util`, or drop the literals.",
      recommended: true
    },
    messages: {
      preferSuggestedString: 'Union `{{union}}` collapses to `string` and erases IDE autocomplete for the literal members. If autocomplete-preserving behavior is intended, use `SuggestedString<T>` from `@dereekb/util` instead. If any string is acceptable, drop the literal members and keep plain `string`.'
    },
    schema: []
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function checkUnion(node: AstNode): void {
      const members: AstNode[] = node.types ?? [];

      if (members.length >= 2) {
        const hasStringKeyword = members.some((m) => isStringKeyword(m));
        const hasLiteralString = members.some((m) => isLiteralStringContributor(m));

        if (hasStringKeyword && hasLiteralString) {
          context.report({
            node,
            messageId: 'preferSuggestedString',
            data: { union: sourceCode.getText(node) }
          });
        }
      }
    }

    return {
      TSUnionType: checkUnion
    };
  }
};
