import { findFunctionLeadingContext, getLineIndent, getStatementAnchor, NO_SIDE_EFFECTS_TAG } from './comments';

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
      readonly missingImplAnnotationOverloaded: string;
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
 *
 * Overloaded functions are a special case: TypeScript erases overload signatures
 * during emit, so a JSDoc tag on the first overload doesn't reach the bundled JS.
 * The `// @__NO_SIDE_EFFECTS__` line comment immediately above the implementation
 * is the only annotation that survives compilation, so this rule preserves it
 * (and treats line comments between overloads — but not directly above the impl —
 * as ordinary orphans to migrate).
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
      preferJsdocPlacement: 'Move the `@__NO_SIDE_EFFECTS__` annotation into the JSDoc block of "{{name}}" (as the last tag before the closing) instead of a separate line comment.',
      missingImplAnnotationOverloaded: '"{{name}}" carries `@__NO_SIDE_EFFECTS__` in its first-overload JSDoc but is overloaded — TypeScript erases overload signatures during emit, so the JSDoc tag is dropped from the bundled JavaScript. Add a `// @__NO_SIDE_EFFECTS__` line comment immediately above the implementation declaration.'
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

      // Walks the overload chain (if any) so we find the JSDoc on the first overload,
      // any orphan annotations between overloads, and the (preserved) impl-leading annotation.
      const { jsdoc, orphanLineComments, implLineComment, hasOverloads, implHasSurvivingAnnotation } = findFunctionLeadingContext(sourceCode, node);

      if (!jsdoc) {
        return;
      }

      // Three reasons to fire:
      //   1. There's an annotation form (orphan OR overload-impl line comment) and the JSDoc
      //      doesn't yet carry the tag — the JSDoc needs the tag added (for docs/tooling).
      //   2. There are orphan annotations to consolidate, regardless of JSDoc tag state.
      //   3. Function is overloaded, JSDoc carries the tag, but the implementation lacks any
      //      surviving annotation — TS erases overload signatures during emit, so the JSDoc tag
      //      on the first overload is dropped. We must add a `// @__NO_SIDE_EFFECTS__` directly
      //      above the impl so the bundler still sees the hint.
      // The impl line comment on overloaded functions is REQUIRED for tree-shaking and is never
      // removed — it is only counted as a signal that the JSDoc should also carry the tag.
      const hasAnyAnnotationSource = orphanLineComments.length > 0 || implLineComment !== null;
      const needsJsdocTag = !jsdoc.hasNoSideEffects && hasAnyAnnotationSource;
      const needsOrphanRemoval = orphanLineComments.length > 0;
      const needsImplLineCommentForOverload = jsdoc.hasNoSideEffects && hasOverloads && !implHasSurvivingAnnotation;

      if (!needsJsdocTag && !needsOrphanRemoval && !needsImplLineCommentForOverload) {
        return;
      }

      context.report({
        node: node.id,
        messageId: needsImplLineCommentForOverload && !needsJsdocTag && !needsOrphanRemoval ? 'missingImplAnnotationOverloaded' : 'preferJsdocPlacement',
        data: { name },
        fix(fixer: AstNode) {
          const fixes: AstNode[] = [];
          const jsdocText = jsdoc.text;
          const jsdocStart = jsdoc.node.range[0];
          const jsdocEnd = jsdoc.node.range[1];
          const jsdocIndent = getLineIndent(sourceText, jsdocStart);

          // Insert into JSDoc only if needed (preserve idempotency and skip when only orphans need removal).
          if (needsJsdocTag) {
            if (jsdocText.includes('\n')) {
              // Multi-line JSDoc — insert a new tag line immediately before the closing `*/` line.
              const closingMarkerStart = jsdocEnd - 2;
              let closingLineStart = closingMarkerStart;
              while (closingLineStart > 0 && sourceText.charAt(closingLineStart - 1) !== '\n') {
                closingLineStart -= 1;
              }
              const insertion = `${jsdocIndent} * ${NO_SIDE_EFFECTS_TAG}\n`;
              fixes.push(fixer.insertTextBeforeRange([closingLineStart, closingLineStart], insertion));
            } else {
              // Single-line JSDoc — expand to multi-line so the new tag has its own line.
              const bodyTrimmed = jsdocText.replace(/^\*\s*/, '').replace(/\s*$/, '');
              const newBody = `/**\n${jsdocIndent} * ${bodyTrimmed}\n${jsdocIndent} * ${NO_SIDE_EFFECTS_TAG}\n${jsdocIndent} */`;
              fixes.push(fixer.replaceTextRange([jsdocStart, jsdocEnd], newBody));
            }
          }

          // Overloaded function with no surviving impl annotation — insert the bundler-required
          // line comment directly above the implementation declaration.
          if (needsImplLineCommentForOverload) {
            const implAnchor = getStatementAnchor(node);
            const implStart = implAnchor.range[0];
            const indent = getLineIndent(sourceText, implStart);
            fixes.push(fixer.insertTextBeforeRange([implStart, implStart], `// ${NO_SIDE_EFFECTS_TAG}\n${indent}`));
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
