type AstNode = any;

/**
 * JSDoc tag that opts a documented function out of requiring an `@example`.
 *
 * Use on simple functions whose name + signature already make the behavior obvious — the
 * convention itself notes that `@example` can be skipped in that case.
 */
const DEFAULT_EXEMPT_JSDOC_TAG = '@dbxAllowSkipExample';

/**
 * Options accepted by the require-exported-jsdoc-example rule.
 */
export interface UtilRequireExportedJsdocExampleRuleOptions {
  /**
   * JSDoc tag that opts a function out of the rule. Defaults to `@dbxAllowSkipExample`.
   */
  readonly exemptJsdocTag?: string;
  /**
   * When true (the default), zero-parameter functions are skipped because their behavior is
   * usually clear from the description alone.
   */
  readonly exemptNoArguments?: boolean;
}

/**
 * ESLint rule definition for require-exported-jsdoc-example.
 */
export interface UtilRequireExportedJsdocExampleRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly missingExample: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireExportedJsdocExampleRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * Returns the JSDoc block immediately preceding `node`, if any.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param node - The AST node to inspect.
 * @returns The leading JSDoc block comment node, or `null` when none is present.
 */
function getLeadingJsdoc(sourceCode: AstNode, node: AstNode): AstNode | null {
  const comments = sourceCode.getCommentsBefore(node) || [];
  let result: AstNode | null = null;

  for (const comment of comments) {
    if (comment.type === 'Block' && typeof comment.value === 'string' && comment.value.startsWith('*')) {
      result = comment;
    }
  }

  return result;
}

/**
 * ESLint rule that requires exported `function` declarations whose JSDoc is already present to
 * also include at least one `@example` tag.
 *
 * Differences from `jsdoc/require-example`:
 * - Fires only on **exported** FunctionDeclarations (top-level `export function …` or
 *   `export default function …`). Internal helpers stay quiet.
 * - Fires only when the function actually has a leading JSDoc block — undocumented functions are
 *   handled by `jsdoc/require-jsdoc`.
 * - Honors the `@dbxAllowSkipExample` JSDoc tag for per-declaration opt-out.
 *
 * Not auto-fixable: there's no way to synthesize a useful `@example` block automatically.
 *
 * @see `dbx__note__typescript-jsdocs` → "Function JSDocs Must Include Examples".
 */
export const utilRequireExportedJsdocExampleRule: UtilRequireExportedJsdocExampleRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: 'Require an `@example` block on exported function declarations that already carry a JSDoc.',
      recommended: true
    },
    messages: {
      missingExample: "Exported function '{{name}}' has a JSDoc but no `@example`. Add an `@example` block, or tag the JSDoc with `{{exemptTag}}` when the signature already makes the behavior obvious."
    },
    schema: [
      {
        type: 'object' as const,
        properties: {
          exemptJsdocTag: {
            type: 'string' as const,
            description: 'JSDoc tag that opts an exported function out of the rule.'
          },
          exemptNoArguments: {
            type: 'boolean' as const,
            description: 'When true (default), exported functions with zero parameters are skipped.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const exemptTag: string = options.exemptJsdocTag ?? DEFAULT_EXEMPT_JSDOC_TAG;
    const exemptNoArguments: boolean = options.exemptNoArguments ?? true;
    const sourceCode = context.sourceCode;

    function check(funcNode: AstNode, anchor: AstNode): void {
      if (funcNode.id?.type !== 'Identifier') {
        return;
      }

      if (exemptNoArguments && (funcNode.params?.length ?? 0) === 0) {
        return;
      }

      const jsdoc = getLeadingJsdoc(sourceCode, anchor);

      if (!jsdoc) {
        return;
      }

      const jsdocText: string = jsdoc.value;

      if (jsdocText.includes(exemptTag)) {
        return;
      }

      if (/(^|\s)\*\s*@example(\s|$)/m.test(jsdocText)) {
        return;
      }

      context.report({
        node: funcNode.id,
        messageId: 'missingExample',
        data: { name: funcNode.id.name, exemptTag }
      });
    }

    return {
      ExportNamedDeclaration(node: AstNode) {
        if (node.declaration?.type === 'FunctionDeclaration') {
          check(node.declaration, node);
        }
      },
      ExportDefaultDeclaration(node: AstNode) {
        if (node.declaration?.type === 'FunctionDeclaration') {
          check(node.declaration, node);
        }
      }
    };
  }
};
