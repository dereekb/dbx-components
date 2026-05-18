import type { Maybe } from '@dereekb/util';
import { findFunctionLeadingContext, getLineIndent, getStatementAnchor, NO_SIDE_EFFECTS_TAG } from './comments';

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
 *
 * @param node - The FunctionDeclaration AST node.
 * @returns The function's identifier name, or `null` for anonymous functions.
 */
function getFunctionName(node: AstNode): Maybe<string> {
  return node.id?.type === 'Identifier' ? node.id.name : null;
}

function pickMessageId(hasOverloads: boolean, jsdoc: ReturnType<typeof findFunctionLeadingContext>['jsdoc']): 'missingImplAnnotationOverloaded' | 'missingNoSideEffectsJsdoc' | 'missingJsdocForFactory' {
  let messageId: 'missingImplAnnotationOverloaded' | 'missingNoSideEffectsJsdoc' | 'missingJsdocForFactory';
  if (hasOverloads && jsdoc?.hasNoSideEffects) messageId = 'missingImplAnnotationOverloaded';
  else if (jsdoc) messageId = 'missingNoSideEffectsJsdoc';
  else messageId = 'missingJsdocForFactory';
  return messageId;
}

/**
 * Builds the merged set of name patterns based on rule options.
 *
 * @param options - The resolved rule options.
 * @returns The combined default + additional regex patterns, or an empty list when name-pattern matching is disabled.
 */
function buildNamePatterns(options: UtilRequireNoSideEffectsRuleOptions): readonly RegExp[] {
  let result: readonly RegExp[];

  if (options.checkNamePatterns) {
    const additional = (options.additionalNamePatterns ?? []).map((source) => new RegExp(source));
    result = [...DEFAULT_NAME_PATTERNS, ...additional];
  } else {
    result = [];
  }

  return result;
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
      readonly missingImplAnnotationOverloaded: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireNoSideEffectsRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => AstNode | AstNode[] }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule requiring the side-effect-free annotation on every factory function — that is,
 * declarations carrying the `@dbxUtilKind factory` JSDoc tag (and optionally functions matching
 * factory name patterns). The rule guarantees the marker reaches the bundled JavaScript so
 * esbuild/rollup can drop unused calls during tree-shaking.
 *
 * Behavior:
 *
 * - **Single-signature functions:** the JSDoc above the declaration is preserved during emit, so
 *   the rule simply requires `@__NO_SIDE_EFFECTS__` inside that JSDoc.
 *
 * - **Overloaded functions:** TypeScript erases overload signatures during emit, so a JSDoc tag
 *   placed only on the first overload is dropped from the bundled JS. The rule additionally requires
 *   either (a) a `// @__NO_SIDE_EFFECTS__` line comment immediately above the implementation, or
 *   (b) a JSDoc with the tag attached directly to the implementation. Auto-fix inserts the line
 *   comment alongside the JSDoc tag so consumer-facing docs and the bundler annotation stay in sync.
 *
 * Auto-fix also removes any redundant standalone-comment annotations between the JSDoc and the
 * declaration (other than the required impl-leading line comment on overloaded functions), and
 * when no JSDoc is present, creates a minimal one carrying both tags.
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
      missingJsdocForFactory: 'Factory-named function "{{name}}" has no JSDoc block. Add a JSDoc block containing `@__NO_SIDE_EFFECTS__` so esbuild can drop unused calls during tree-shaking.',
      missingImplAnnotationOverloaded: 'Overloaded factory function "{{name}}" needs `@__NO_SIDE_EFFECTS__` directly on its implementation — TypeScript erases overload signatures during emit, so the JSDoc tag on the first overload is dropped from the bundled JavaScript. Add a `// @__NO_SIDE_EFFECTS__` line comment immediately above the implementation declaration.'
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

    function buildJsdocTagFixes(fixer: AstNode, jsdoc: NonNullable<ReturnType<typeof findFunctionLeadingContext>['jsdoc']>): AstNode[] {
      const fixes: AstNode[] = [];
      const jsdocText = jsdoc.text;
      const jsdocStart = jsdoc.node.range[0];
      const jsdocEnd = jsdoc.node.range[1];
      const jsdocIndent = getLineIndent(sourceText, jsdocStart);

      if (jsdocText.includes('\n')) {
        const closingMarkerStart = jsdocEnd - 2;
        let closingLineStart = closingMarkerStart;
        while (closingLineStart > 0 && sourceText.charAt(closingLineStart - 1) !== '\n') closingLineStart -= 1;
        fixes.push(fixer.insertTextBeforeRange([closingLineStart, closingLineStart], `${jsdocIndent} * ${NO_SIDE_EFFECTS_TAG}\n`));
      } else {
        const bodyTrimmed = jsdocText.replace(/^\*\s*/, '').replace(/\s*$/, '');
        const newBody = `/**\n${jsdocIndent} * ${bodyTrimmed}\n${jsdocIndent} * ${NO_SIDE_EFFECTS_TAG}\n${jsdocIndent} */`;
        fixes.push(fixer.replaceTextRange([jsdocStart, jsdocEnd], newBody));
      }
      return fixes;
    }

    function buildCreateJsdocFix(fixer: AstNode, chainStartStatement: AstNode): AstNode {
      const nodeStart = chainStartStatement.range[0];
      const indent = getLineIndent(sourceText, nodeStart);
      const newJsdoc = `/**\n${indent} * @dbxUtilKind factory\n${indent} * ${NO_SIDE_EFFECTS_TAG}\n${indent} */\n${indent}`;
      return fixer.insertTextBeforeRange([nodeStart, nodeStart], newJsdoc);
    }

    function buildImplLineCommentFix(fixer: AstNode, node: AstNode): AstNode {
      const implAnchor = getStatementAnchor(node);
      const implStart = implAnchor.range[0];
      const indent = getLineIndent(sourceText, implStart);
      return fixer.insertTextBeforeRange([implStart, implStart], `// ${NO_SIDE_EFFECTS_TAG}\n${indent}`);
    }

    function buildRedundantRemovalFix(fixer: AstNode, redundant: AstNode): AstNode {
      const [start, end] = redundant.range;
      let removeEnd = end;
      while (removeEnd < sourceText.length && (sourceText.charAt(removeEnd) === ' ' || sourceText.charAt(removeEnd) === '\t')) removeEnd += 1;
      if (sourceText.charAt(removeEnd) === '\n') removeEnd += 1;
      let removeStart = start;
      while (removeStart > 0 && (sourceText.charAt(removeStart - 1) === ' ' || sourceText.charAt(removeStart - 1) === '\t')) removeStart -= 1;
      return fixer.removeRange([removeStart, removeEnd]);
    }

    function buildAllFixes(fixer: AstNode, node: AstNode, ctx: ReturnType<typeof findFunctionLeadingContext>): AstNode[] {
      const { jsdoc, orphanLineComments: redundantLineComments, hasOverloads, implLineComment, chainStartStatement } = ctx;
      const fixes: AstNode[] = [];

      if (jsdoc && !jsdoc.hasNoSideEffects) fixes.push(...buildJsdocTagFixes(fixer, jsdoc));
      else if (!jsdoc) fixes.push(buildCreateJsdocFix(fixer, chainStartStatement));

      if (hasOverloads && !implLineComment) fixes.push(buildImplLineCommentFix(fixer, node));

      for (const redundant of redundantLineComments) fixes.push(buildRedundantRemovalFix(fixer, redundant));

      return fixes;
    }

    function checkFunction(node: AstNode): void {
      if (node.type !== 'FunctionDeclaration' || !node.body) return;
      const name = getFunctionName(node);
      if (!name) return;

      const ctx = findFunctionLeadingContext(sourceCode, node);
      const { jsdoc, hasOverloads, implHasSurvivingAnnotation } = ctx;

      const taggedAsFactory = jsdoc?.text?.includes(FACTORY_JSDOC_TAG) === true;
      const matchedByName = !taggedAsFactory && namePatterns.length > 0 && nameMatchesFactoryPattern(name);

      if (!(taggedAsFactory || matchedByName) || implHasSurvivingAnnotation) return;

      const messageId = pickMessageId(hasOverloads, jsdoc);

      context.report({
        node: node.id,
        messageId,
        data: { name },
        fix(fixer: AstNode) {
          return buildAllFixes(fixer, node, ctx);
        }
      });
    }

    return {
      FunctionDeclaration: checkFunction
    };
  }
};
