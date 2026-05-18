interface AstNode {
  readonly type: string;
  // index signature keeps the loose-typed semantics of the original `= any`
  // so the rule body can freely navigate AST properties without churn.
  [key: string]: any;
}

/**
 * ESLint rule definition for no-inline-string-empty-object-intersection.
 */
export interface UtilNoInlineStringEmptyObjectIntersectionRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly inlineIntersectionForbidden: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void }): Record<string, (node: AstNode) => void>;
}

/**
 * Returns true when the node is a `TSTypeLiteral` whose `members` array is empty — i.e. the
 * literal `{}` form. The autocomplete-preserving trick in `T | (string & {})` relies on
 * intersecting `string` with this empty literal; `string & Record<never, never>` (used by the
 * `SuggestedString<T>` alias itself) parses to a `TSTypeReference` instead, so it is not
 * flagged.
 *
 * @param node - The TS type AST node.
 * @returns True when the node is `{}`.
 */
function isEmptyTypeLiteral(node: AstNode): boolean {
  return node?.type === 'TSTypeLiteral' && Array.isArray(node.members) && node.members.length === 0;
}

/**
 * Returns true when the node is `TSStringKeyword`.
 *
 * @param node - The TS type AST node.
 * @returns True when the node is the `string` keyword.
 */
function isStringKeyword(node: AstNode): boolean {
  return node?.type === 'TSStringKeyword';
}

/**
 * Returns true when the intersection has exactly the shape `string & {}` (in either order, and
 * tolerating a `TSParenthesizedType` wrapping the `{}` half — older parser output sometimes
 * surfaces parens as an explicit node).
 *
 * @param intersection - A `TSIntersectionType` AST node.
 * @returns True when the intersection is `string & {}`.
 */
function isStringAndEmptyObjectIntersection(intersection: AstNode): boolean {
  const members: AstNode[] = intersection?.types ?? [];

  let result = false;

  if (members.length === 2) {
    const unwrapped = members.map((m) => (m.type === 'TSParenthesizedType' ? m.typeAnnotation : m));
    const [a, b] = unwrapped;
    result = (isStringKeyword(a) && isEmptyTypeLiteral(b)) || (isStringKeyword(b) && isEmptyTypeLiteral(a));
  }

  return result;
}

/**
 * ESLint rule that errors on any inline `string & {}` intersection — either standalone or as a
 * member of a union (the `T | (string & {})` autocomplete-preserving idiom). The intersection is
 * opaque at the call site and reads like a typo; the workspace's `SuggestedString<T>` alias from
 * `@dereekb/util` is the only sanctioned way to express the same shape.
 *
 * The rule is intentionally non-fixable: switching to `SuggestedString<T>` also requires adding
 * an `import { type SuggestedString } from '@dereekb/util'` (or a relative path inside
 * `@dereekb/util` itself), and the right insertion point depends on existing import structure.
 * The error message names the type so the developer can make the change deliberately.
 *
 * The rule visits `TSIntersectionType` directly, so it fires regardless of whether the
 * intersection appears inside a union, a parenthesized type, a type alias body, a function
 * signature, or anywhere else.
 */
export const UTIL_NO_INLINE_STRING_EMPTY_OBJECT_INTERSECTION_RULE: UtilNoInlineStringEmptyObjectIntersectionRuleDefinition = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow the inline `string & {}` intersection (including inside unions); prefer `SuggestedString<T>` from `@dereekb/util`.',
      recommended: true
    },
    messages: {
      inlineIntersectionForbidden: 'The inline `string & {}` intersection is forbidden. Use `SuggestedString<T>` from `@dereekb/util` (or a relative path inside @dereekb/util) instead — the named alias makes the autocomplete-preserving intent explicit at the call site.'
    },
    schema: []
  },
  create(context) {
    function checkIntersection(node: AstNode): void {
      if (isStringAndEmptyObjectIntersection(node)) {
        context.report({
          node,
          messageId: 'inlineIntersectionForbidden'
        });
      }
    }

    return {
      TSIntersectionType: checkIntersection
    };
  }
};
