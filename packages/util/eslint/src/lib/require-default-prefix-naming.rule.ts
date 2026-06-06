interface AstNode {
  readonly type: string;
  // index signature keeps the loose-typed semantics of the original `= any`
  // so the rule body can freely navigate AST properties without churn.
  [key: string]: any;
}

/**
 * JSDoc tag that opts a const declaration out of the default-prefix-naming rule.
 *
 * Used for cases where `_DEFAULT_` legitimately appears mid-name (e.g. proper-noun acronyms or
 * registry keys generated from external schemas).
 */
const DEFAULT_EXEMPT_JSDOC_TAG = '@dbxAllowDefaultPrefix';

/**
 * UPPER_SNAKE_CASE pattern. We only enforce the `DEFAULT_` prefix on SCREAMING_CASE bindings; other
 * casings have their own naming conventions handled elsewhere.
 */
const UPPER_SNAKE_CASE = /^[A-Z][A-Z0-9_]*$/;

/**
 * Matches `_DEFAULT` followed by an underscore or end-of-string, so `DEFAULTING` and similar
 * substrings are not caught.
 *
 * @dbxAllowDefaultPrefix — name describes the regex's purpose (a misplaced-DEFAULT pattern),
 *   not a default value; the rule's own canonical false-positive.
 */
const MISPLACED_DEFAULT = /_DEFAULT(?=_|$)/;

/**
 * Options accepted by the require-default-prefix-naming rule.
 */
export interface UtilRequireDefaultPrefixNamingRuleOptions {
  /**
   * JSDoc tag that exempts a matching const from the rule.
   * Defaults to `@dbxAllowDefaultPrefix`.
   */
  readonly exemptJsdocTag?: string;
}

/**
 * ESLint rule definition for require-default-prefix-naming.
 */
export interface UtilRequireDefaultPrefixNamingRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly defaultShouldBePrefix: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireDefaultPrefixNamingRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * Returns true when a JSDoc block immediately preceding `node` carries the exempt tag.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param node - The AST node to inspect.
 * @param exemptTag - The JSDoc tag string that opts the declaration out of the rule.
 * @returns True when a JSDoc block above the node contains the exempt tag.
 */
function hasExemptJsdoc(sourceCode: AstNode, node: AstNode, exemptTag: string): boolean {
  const comments = sourceCode.getCommentsBefore(node) || [];
  let exempt = false;

  for (const comment of comments) {
    if (comment.type === 'Block' && comment.value.startsWith('*') && comment.value.includes(exemptTag)) {
      exempt = true;
    }
  }

  return exempt;
}

/**
 * Builds the suggested rename for a misplaced-`DEFAULT_` SCREAMING_CASE binding by moving every
 * misplaced `DEFAULT` segment to the front of the name.
 *
 * Examples:
 * - `FOO_DEFAULT_BAR` → `DEFAULT_FOO_BAR`
 * - `FOO_BAR_DEFAULT` → `DEFAULT_FOO_BAR`
 *
 * @param name - The original SCREAMING_CASE identifier.
 * @returns The suggested identifier with `DEFAULT_` prefixed.
 */
function suggestedName(name: string): string {
  const stripped = name.replaceAll(/_DEFAULT(?=_|$)/g, '');
  return `DEFAULT_${stripped}`;
}

/**
 * ESLint rule that enforces the dbx-components naming convention: when a SCREAMING_CASE binding
 * contains the segment `DEFAULT` (e.g. `FOO_DEFAULT_BAR` or `FOO_BAR_DEFAULT`), the `DEFAULT_`
 * segment must appear as the leading prefix instead (`DEFAULT_FOO_BAR`).
 *
 * Rationale: keeping `DEFAULT_` as a leading prefix makes default-providing constants trivially
 * groupable in IDE symbol lists and import bars, and matches the rest of the codebase's
 * `DEFAULT_X_Y_Z` pattern.
 *
 * Applies to every `VariableDeclarator` whose binding is UPPER_SNAKE_CASE. PascalCase, camelCase,
 * underscore-prefixed (internal), and mixed names are ignored.
 *
 * Not auto-fixable: renaming a binding has cross-file impact that an autofix can't safely
 * propagate. Use the exempt JSDoc tag (default `@dbxAllowDefaultPrefix`) to silence the rule on a
 * specific declaration when the heuristics get it wrong.
 *
 * @see `dbx__note__typescript-programming` → Constant Naming.
 */
export const UTIL_REQUIRE_DEFAULT_PREFIX_NAMING_RULE: UtilRequireDefaultPrefixNamingRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: "Require SCREAMING_CASE constants containing 'DEFAULT' as a segment to use 'DEFAULT_' as the leading prefix.",
      recommended: true
    },
    messages: {
      defaultShouldBePrefix: "SCREAMING_CASE constant '{{name}}' contains '_DEFAULT' as a non-leading segment; rename to '{{suggested}}' so 'DEFAULT_' appears as the leading prefix. Tag with `{{exemptTag}}` if the rule's heuristics are wrong here."
    },
    schema: [
      {
        type: 'object' as const,
        properties: {
          exemptJsdocTag: {
            type: 'string' as const,
            description: 'JSDoc tag that opts a const declaration out of the rule.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const exemptTag: string = options.exemptJsdocTag ?? DEFAULT_EXEMPT_JSDOC_TAG;
    const sourceCode = context.sourceCode;

    function checkVariableDeclaration(node: AstNode): void {
      if (node.kind !== 'const') {
        return;
      }

      // `node.parent` is the surrounding statement (ExportNamedDeclaration, Program, BlockStatement, etc.).
      // Comment lookup needs to start at the outermost node attached to the leading comments.
      const commentTarget = node.parent?.type === 'ExportNamedDeclaration' ? node.parent : node;

      if (hasExemptJsdoc(sourceCode, commentTarget, exemptTag)) {
        return;
      }

      for (const declarator of node.declarations ?? []) {
        if (declarator.id?.type !== 'Identifier') {
          continue;
        }

        const name: string = declarator.id.name;

        if (name.startsWith('_')) {
          continue;
        }

        if (!UPPER_SNAKE_CASE.test(name)) {
          continue;
        }

        if (name.startsWith('DEFAULT_')) {
          continue;
        }

        if (!MISPLACED_DEFAULT.test(name)) {
          continue;
        }

        context.report({
          node: declarator.id,
          messageId: 'defaultShouldBePrefix',
          data: { name, suggested: suggestedName(name), exemptTag }
        });
      }
    }

    return {
      VariableDeclaration: checkVariableDeclaration
    };
  }
};
