import { findFunctionLeadingContext, getLineIndent, NO_SIDE_EFFECTS_TAG } from './comments';

type AstNode = any;

/**
 * ESLint rule definition for prefer-no-side-effects-in-jsdoc.
 */
export interface UtilPreferNoSideEffectsInJsdocRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly preferJsdocPlacement: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { options: unknown[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => AstNode | AstNode[] }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule that flags functions with both a JSDoc block and a separate
 * `// @__NO_SIDE_EFFECTS__` (or block-comment equivalent) line comment between
 * the JSDoc and the declaration. Auto-fix migrates the annotation into the JSDoc
 * (last tag before the closing) and removes the standalone comment, since the
 * JSDoc form is the workspace's preferred placement.
 *
 * Unlike `require-no-side-effects`, this rule does not require the function to
 * be tagged as a factory — it triggers purely on the presence of an existing
 * line-comment annotation alongside a JSDoc, so it can sweep all 688 historical
 * annotations through `eslint --fix`.
 */
export const utilPreferNoSideEffectsInJsdocRule: UtilPreferNoSideEffectsInJsdocRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: "Prefer the @__NO_SIDE_EFFECTS__ annotation inside a function's JSDoc instead of a separate line comment between the JSDoc and the declaration.",
      recommended: true
    },
    messages: {
      preferJsdocPlacement: 'Move the `@__NO_SIDE_EFFECTS__` annotation into the JSDoc block of "{{name}}" (as the last tag before the closing) instead of a separate line comment.'
    },
    schema: []
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const sourceText = sourceCode.getText();

    function checkFunction(node: AstNode): void {
      if (node.type !== 'FunctionDeclaration' || !node.body) {
        return;
      }

      if (node.id?.type !== 'Identifier') {
        return;
      }

      const name: string = node.id.name;

      // Walks the overload chain (if any) so we find the JSDoc on the first overload
      // and any orphan annotations between overloads or above the implementation.
      const { jsdoc, orphanLineComments } = findFunctionLeadingContext(sourceCode, node);

      // Only flag when both signals are present: a JSDoc to absorb the tag, AND an orphan annotation.
      if (!jsdoc || orphanLineComments.length === 0) {
        return;
      }

      context.report({
        node: node.id,
        messageId: 'preferJsdocPlacement',
        data: { name },
        fix(fixer: AstNode) {
          const fixes: AstNode[] = [];
          const jsdocText = jsdoc.text;
          const jsdocStart = jsdoc.node.range[0];
          const jsdocEnd = jsdoc.node.range[1];
          const jsdocIndent = getLineIndent(sourceText, jsdocStart);

          // Insert into JSDoc only if the tag isn't already there (preserve idempotency).
          if (!jsdoc.hasNoSideEffects) {
            if (!jsdocText.includes('\n')) {
              // Single-line JSDoc — expand to multi-line so the new tag has its own line.
              const bodyTrimmed = jsdocText.replace(/^\*\s*/, '').replace(/\s*$/, '');
              const newBody = `/**\n${jsdocIndent} * ${bodyTrimmed}\n${jsdocIndent} * ${NO_SIDE_EFFECTS_TAG}\n${jsdocIndent} */`;
              fixes.push(fixer.replaceTextRange([jsdocStart, jsdocEnd], newBody));
            } else {
              // Multi-line JSDoc — insert a new tag line immediately before the closing `*/` line.
              const closingMarkerStart = jsdocEnd - 2;
              let closingLineStart = closingMarkerStart;
              while (closingLineStart > 0 && sourceText.charAt(closingLineStart - 1) !== '\n') {
                closingLineStart -= 1;
              }
              const insertion = `${jsdocIndent} * ${NO_SIDE_EFFECTS_TAG}\n`;
              fixes.push(fixer.insertTextBeforeRange([closingLineStart, closingLineStart], insertion));
            }
          }

          // Remove the orphan line/block comment annotations.
          for (const orphan of orphanLineComments) {
            const [start, end] = orphan.range;
            let removeEnd = end;
            while (removeEnd < sourceText.length && (sourceText.charAt(removeEnd) === ' ' || sourceText.charAt(removeEnd) === '\t')) {
              removeEnd += 1;
            }
            if (sourceText.charAt(removeEnd) === '\n') {
              removeEnd += 1;
            }
            let removeStart = start;
            while (removeStart > 0 && (sourceText.charAt(removeStart - 1) === ' ' || sourceText.charAt(removeStart - 1) === '\t')) {
              removeStart -= 1;
            }
            fixes.push(fixer.removeRange([removeStart, removeEnd]));
          }

          return fixes;
        }
      });
    }

    return {
      FunctionDeclaration: checkFunction
    };
  }
};
