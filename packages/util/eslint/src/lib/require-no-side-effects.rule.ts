import { findFunctionLeadingContext, getLineIndent, NO_SIDE_EFFECTS_TAG } from './comments';

/**
 * The JSDoc tag identifying a function as a factory in the @dereekb conventions.
 */
const FACTORY_JSDOC_TAG = '@dbxUtilKind factory';

/**
 * Default suffix patterns considered factory-like by name when `checkNamePatterns` is enabled.
 */
const DEFAULT_NAME_PATTERNS: readonly RegExp[] = [/(?:Factory|Factories|Service|Services|Function|Functions)$/, /^(?:make|build|create)[A-Z]/, /^(?:firestore|optionalFirestore)[A-Z]/];

/**
 * Options for the require-no-side-effects rule.
 */
export interface UtilRequireNoSideEffectsRuleOptions {
  /**
   * When true, also flag functions whose names match the factory naming patterns
   * in addition to JSDoc-tag detection.
   */
  readonly checkNamePatterns?: boolean;
  /**
   * Additional name pattern source strings (compiled to RegExp) when `checkNamePatterns` is true.
   */
  readonly additionalNamePatterns?: readonly string[];
}

type AstNode = any;

/**
 * Returns the function's identifier name, or null if anonymous.
 */
function getFunctionName(node: AstNode): string | null {
  if (node.id?.type === 'Identifier') {
    return node.id.name;
  }

  return null;
}

/**
 * Builds the merged set of name patterns based on rule options.
 */
function buildNamePatterns(options: UtilRequireNoSideEffectsRuleOptions): readonly RegExp[] {
  if (!options.checkNamePatterns) {
    return [];
  }

  const additional = (options.additionalNamePatterns ?? []).map((source) => new RegExp(source));
  return [...DEFAULT_NAME_PATTERNS, ...additional];
}

/**
 * ESLint rule definition for require-no-side-effects.
 */
export interface UtilRequireNoSideEffectsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly missingNoSideEffectsJsdoc: string;
      readonly missingJsdocForFactory: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireNoSideEffectsRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => AstNode | AstNode[] }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule requiring the side-effect-free annotation inside the JSDoc of every
 * factory function — that is, declarations carrying the dbxUtilKind factory JSDoc tag,
 * and optionally functions matching factory name patterns.
 *
 * Auto-fix inserts the annotation as the last line of the JSDoc, removes any
 * redundant standalone-comment annotation between the JSDoc and the declaration,
 * and (when matched by name with no JSDoc) creates a minimal JSDoc carrying both tags.
 */
export const utilRequireNoSideEffectsRule: UtilRequireNoSideEffectsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require @__NO_SIDE_EFFECTS__ inside the JSDoc block of factory functions so esbuild can drop unused calls during tree-shaking.',
      recommended: true
    },
    messages: {
      missingNoSideEffectsJsdoc: 'Factory function "{{name}}" is missing the `@__NO_SIDE_EFFECTS__` annotation in its JSDoc. Add it as the last tag inside the JSDoc block so esbuild can drop unused calls during tree-shaking.',
      missingJsdocForFactory: 'Factory-named function "{{name}}" has no JSDoc block. Add a JSDoc block containing `@__NO_SIDE_EFFECTS__` so esbuild can drop unused calls during tree-shaking.'
    },
    schema: [
      {
        type: 'object' as const,
        properties: {
          checkNamePatterns: {
            type: 'boolean' as const,
            description: 'Also flag functions whose names match factory naming patterns, in addition to JSDoc-tag detection.'
          },
          additionalNamePatterns: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'Additional name pattern source strings to treat as factory signals when checkNamePatterns is true.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const namePatterns = buildNamePatterns(options);
    const sourceCode = context.sourceCode;
    const sourceText = sourceCode.getText();

    function nameMatchesFactoryPattern(name: string): boolean {
      return namePatterns.some((pattern) => pattern.test(name));
    }

    function checkFunction(node: AstNode): void {
      // Skip overload signatures (TSDeclareFunction) and bodyless declarations.
      if (node.type !== 'FunctionDeclaration' || !node.body) {
        return;
      }

      const name = getFunctionName(node);

      if (!name) {
        return;
      }

      // Walks the overload chain (if any) so we read the JSDoc on the first overload
      // and any orphan annotations placed between overloads or above the implementation.
      const { jsdoc, orphanLineComments: redundantLineComments } = findFunctionLeadingContext(sourceCode, node);

      const taggedAsFactory = jsdoc?.text?.includes(FACTORY_JSDOC_TAG) === true;
      const matchedByName = !taggedAsFactory && namePatterns.length > 0 && nameMatchesFactoryPattern(name);

      if (!taggedAsFactory && !matchedByName) {
        return;
      }

      // Already annotated inside the JSDoc — passing.
      if (jsdoc?.hasNoSideEffects) {
        return;
      }

      const messageId = jsdoc ? 'missingNoSideEffectsJsdoc' : 'missingJsdocForFactory';

      context.report({
        node: node.id,
        messageId,
        data: { name },
        fix(fixer: AstNode) {
          const fixes: AstNode[] = [];

          if (jsdoc) {
            const jsdocText = jsdoc.text; // text excludes /* and */
            const jsdocStart = jsdoc.node.range[0];
            const jsdocEnd = jsdoc.node.range[1];

            // Determine the column the JSDoc starts at to align the new line.
            const jsdocIndent = getLineIndent(sourceText, jsdocStart);

            // If the JSDoc is single-line (e.g. `/** @dbxUtilKind factory */`),
            // expand it to multi-line. Detect by absence of newline in the body.
            if (!jsdocText.includes('\n')) {
              const bodyTrimmed = jsdocText.replace(/^\*\s*/, '').replace(/\s*$/, '');
              const newBody = `/**\n${jsdocIndent} * ${bodyTrimmed}\n${jsdocIndent} * ${NO_SIDE_EFFECTS_TAG}\n${jsdocIndent} */`;
              fixes.push(fixer.replaceTextRange([jsdocStart, jsdocEnd], newBody));
            } else {
              // Multi-line JSDoc: insert a new line `${indent} * @__NO_SIDE_EFFECTS__\n`
              // immediately before the line containing the closing `*/`, so the closing line
              // and existing body lines remain untouched.
              const closingMarkerStart = jsdocEnd - 2; // start of `*/`
              let closingLineStart = closingMarkerStart;
              while (closingLineStart > 0 && sourceText.charAt(closingLineStart - 1) !== '\n') {
                closingLineStart -= 1;
              }
              const insertion = `${jsdocIndent} * ${NO_SIDE_EFFECTS_TAG}\n`;
              fixes.push(fixer.insertTextBeforeRange([closingLineStart, closingLineStart], insertion));
            }
          } else {
            // No JSDoc — create one above the function declaration with matching indent.
            // Use the function's leading position. Account for `export` keyword: getCommentsBefore
            // attaches to the declaration including its modifiers, so node.range[0] is correct.
            const nodeStart = node.range[0];
            const indent = getLineIndent(sourceText, nodeStart);

            const newJsdoc = `/**\n${indent} * @dbxUtilKind factory\n${indent} * ${NO_SIDE_EFFECTS_TAG}\n${indent} */\n${indent}`;
            fixes.push(fixer.insertTextBeforeRange([nodeStart, nodeStart], newJsdoc));
          }

          // Remove any redundant adjacent annotation comments now that JSDoc carries the tag.
          for (const redundant of redundantLineComments) {
            const [start, end] = redundant.range;
            // Extend the removal to include the trailing newline + indent so we don't leave a blank line.
            let removeEnd = end;
            while (removeEnd < sourceText.length && (sourceText.charAt(removeEnd) === ' ' || sourceText.charAt(removeEnd) === '\t')) {
              removeEnd += 1;
            }
            if (sourceText.charAt(removeEnd) === '\n') {
              removeEnd += 1;
            }
            // Also drop leading indent on the comment's line.
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
