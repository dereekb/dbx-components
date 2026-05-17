import { getStatementAnchor } from './comments';
import { parseJsdocComment, type ParsedJsdoc, type ParsedJsdocTag } from './jsdoc-parser';

type AstNode = any;

/**
 * Options for the prefer-canonical-jsdoc rule. Each `checkX` flag toggles a related group of
 * messageIds; default is `true` for all checks.
 */
export interface UtilPreferCanonicalJsdocRuleOptions {
  readonly checkDescription?: boolean;
  readonly checkParam?: boolean;
  readonly checkReturns?: boolean;
  readonly checkThrows?: boolean;
  readonly checkTagOrder?: boolean;
  readonly checkExampleFence?: boolean;
  readonly checkTypeRestating?: boolean;
  readonly checkSingleLine?: boolean;
  readonly workspaceTagPrefixes?: readonly string[];
}

/**
 * ESLint rule definition for prefer-canonical-jsdoc.
 */
export interface UtilPreferCanonicalJsdocRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: UtilPreferCanonicalJsdocRuleOptions[]; report: (descriptor: { node?: AstNode; loc?: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => AstNode | AstNode[] | null }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

const DEFAULT_WORKSPACE_TAG_PREFIXES: readonly string[] = ['dbxUtil', 'dbxPipe', 'dbxModel', 'dbxForm', 'dbxAction', 'dbxWeb', 'dbxFilter', 'dbxAuth', 'dbxDocsUiExample', 'dbxRule', 'see'];

/**
 * Tag-order rank. Lower ranks must appear first in the JSDoc tag list. Unknown tags fall back to
 * the `unknown` rank, which is placed between standard tags and workspace-specific tags so a
 * mis-named tag is reported but doesn't cause a cascade of out-of-order errors.
 */
const TAG_RANK = {
  param: 10,
  returns: 20,
  return: 20,
  throws: 30,
  workspace: 40,
  example: 50,
  unknown: 45,
  noSideEffects: 60
} as const;

type CharCheck = 'capital' | 'period';

const TERMINAL_PUNCTUATION = new Set(['.', '!', '?', '}', ')', ']']);
const FENCED_OPENERS = new Set(['`', '*', '{', '[', '(', '<', '"', "'"]);

/**
 * Returns the position of the first non-blank character of a multi-line string, or -1 if none.
 */
function firstNonBlankCharIndex(text: string): number {
  let result = -1;

  for (let i = 0; i < text.length; i += 1) {
    if (!/\s/.test(text.charAt(i))) {
      result = i;
      break;
    }
  }

  return result;
}

/**
 * Returns the position (within `text`) of the last non-blank character, or -1 if none.
 */
function lastNonBlankCharIndex(text: string): number {
  let result = -1;

  for (let i = text.length - 1; i >= 0; i -= 1) {
    if (!/\s/.test(text.charAt(i))) {
      result = i;
      break;
    }
  }

  return result;
}

/**
 * Returns true when the first non-whitespace char of `text` is acceptable for the given check.
 * Acceptable openers (markdown links, fences, code) are treated as already canonical.
 */
function startsCanonically(text: string, check: CharCheck): boolean {
  const idx = firstNonBlankCharIndex(text);
  let canonical = false;

  if (idx === -1) {
    canonical = true; // empty text — no opener to violate
  } else {
    const ch = text.charAt(idx);
    if (check === 'capital') {
      canonical = (ch >= 'A' && ch <= 'Z') || FENCED_OPENERS.has(ch);
    }
  }

  return canonical;
}

/**
 * Returns true when the last non-whitespace char of `text` is acceptable terminal punctuation.
 */
function endsCanonically(text: string): boolean {
  const idx = lastNonBlankCharIndex(text);
  let canonical = false;

  if (idx === -1) {
    canonical = true;
  } else {
    const ch = text.charAt(idx);
    canonical = TERMINAL_PUNCTUATION.has(ch) || ch === '`';
  }

  return canonical;
}

/**
 * Returns the source-text offset of an offset-within-comment-value, given a Block comment node.
 */
function commentValueToSourceOffset(commentNode: AstNode, valueOffset: number): number {
  return commentNode.range[0] + 2 + valueOffset; // `/*` is 2 chars; `*` of `/**` is part of the value
}

/**
 * Detects whether the function-like node has parameters in its signature. Variable-bound arrow
 * functions arrive through their VariableDeclaration parent; class methods through MethodDefinition.
 */
function functionLikeFromAnchor(anchor: AstNode): AstNode | null {
  let result: AstNode | null = null;

  if (anchor.type === 'FunctionDeclaration') {
    result = anchor;
  } else if (anchor.type === 'ExportNamedDeclaration' || anchor.type === 'ExportDefaultDeclaration') {
    if (anchor.declaration?.type === 'FunctionDeclaration') {
      result = anchor.declaration;
    } else if (anchor.declaration?.type === 'VariableDeclaration') {
      const init = anchor.declaration.declarations?.[0]?.init;
      if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
        result = init;
      }
    }
  } else if (anchor.type === 'VariableDeclaration') {
    const init = anchor.declarations?.[0]?.init;
    if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
      result = init;
    }
  } else if (anchor.type === 'MethodDefinition') {
    result = anchor.value;
  }

  return result;
}

const TYPE_RESTATING_PATTERNS: readonly RegExp[] = [/^a string\b/i, /^a number\b/i, /^a boolean\b/i, /^an array of\b/i, /^an instance of\b/i, /^a (?:map|set|promise|function|array|object|date)\b/i, /^the (?:string|number|boolean|array|map|set|promise|object|date) /i];

/**
 * Returns the tag-order rank for a parsed tag, using the configured workspace prefixes.
 */
function rankFor(tag: ParsedJsdocTag, workspacePrefixes: readonly string[]): number {
  let rank: number = TAG_RANK.unknown;

  if (tag.tag === 'param') rank = TAG_RANK.param;
  else if (tag.tag === 'returns' || tag.tag === 'return') rank = TAG_RANK.returns;
  else if (tag.tag === 'throws') rank = TAG_RANK.throws;
  else if (tag.tag === 'example') rank = TAG_RANK.example;
  else if (tag.tag === '__NO_SIDE_EFFECTS__') rank = TAG_RANK.noSideEffects;
  else if (workspacePrefixes.some((p) => tag.tag === p || tag.tag.startsWith(p))) rank = TAG_RANK.workspace;

  return rank;
}

/**
 * ESLint rule enforcing the workspace's canonical JSDoc shape. Applies only when a JSDoc block
 * already exists on a function-like declaration; presence is `jsdoc/require-jsdoc`'s concern.
 *
 * The rule defends the shape established across `@dereekb/util`, `@dereekb/date`, `@dereekb/firebase`,
 * and `@dereekb/dbx-core`:
 *
 * - Description: capitalized first paragraph ending with terminal punctuation, optional elaboration paragraphs
 *   separated by exactly one blank `* ` line.
 * - `@param name - Capitalized description.` with hyphen and surrounding spaces.
 * - `@returns Capitalized description.` without a hyphen.
 * - `@throws {ErrorType} Capitalized condition.` with brace-wrapped error type.
 * - Tag order: `@param*`, `@returns`, `@throws*`, workspace tags (`@dbx*`, `@see`), `@example`, `@__NO_SIDE_EFFECTS__`.
 * - `@example` body fenced as triple-backtick `ts` block.
 * - No type-restating descriptions ("a string …", "an array of …").
 * - Single-line JSDocs forbidden on functions with parameters.
 *
 * Heuristics are tuned to pass on the canonical examples in the existing codebase; warnings on
 * older non-canonical JSDocs are expected and acceptable per workspace policy.
 */
export const utilPreferCanonicalJsdocRule: UtilPreferCanonicalJsdocRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: "Enforce the workspace's canonical JSDoc shape on existing JSDoc blocks.",
      recommended: true
    },
    messages: {
      descriptionMissingCapital: 'JSDoc description should start with a capital letter.',
      descriptionMissingPeriod: 'JSDoc description should end with terminal punctuation (`.`, `!`, `?`, or closing `}` / `)` / `]`).',
      descriptionParagraphSeparator: 'JSDoc description paragraphs should be separated by exactly one blank ` * ` line.',
      paramHyphen: '`@param {{name}}` should be followed by ` - ` (single space, hyphen, single space) before the description.',
      paramDescriptionCapital: '`@param {{name}}` description should start with a capital letter.',
      paramDescriptionPeriod: '`@param {{name}}` description should end with terminal punctuation.',
      paramOrder: '`@param` tags should appear in the order parameters are declared. `{{name}}` is out of order (expected `{{expected}}`).',
      returnsNoHyphen: '`@returns` should not use ` - ` after the tag — the canonical form is `@returns Description.` without a hyphen.',
      returnsDescriptionCapital: '`@returns` description should start with a capital letter.',
      returnsDescriptionPeriod: '`@returns` description should end with terminal punctuation.',
      throwsErrorType: '`@throws` should declare the thrown error type with `{ErrorType}` braces, e.g. `@throws {ValidationError} When …`.',
      throwsDescriptionCapital: '`@throws` description should start with a capital letter after the `{ErrorType}`.',
      throwsDescriptionPeriod: '`@throws` description should end with terminal punctuation.',
      tagOrder: '`@{{tag}}` is out of canonical order; expected order is `@param`, `@returns`, `@throws`, workspace tags (`@dbx*`, `@see`), `@example`, `@__NO_SIDE_EFFECTS__`.',
      exampleFence: '`@example` body should be a fenced ` ```ts ` code block.',
      descriptionTypeRestating: 'JSDoc description should describe purpose, not restate the TypeScript type. Avoid phrasings like "a string …", "an array of …", or "the {type} to …".',
      functionShouldBeMultiline: 'Single-line JSDoc is reserved for type aliases, interfaces, and zero-parameter values. Functions with parameters should use a multi-line JSDoc block.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          checkDescription: { type: 'boolean' as const },
          checkParam: { type: 'boolean' as const },
          checkReturns: { type: 'boolean' as const },
          checkThrows: { type: 'boolean' as const },
          checkTagOrder: { type: 'boolean' as const },
          checkExampleFence: { type: 'boolean' as const },
          checkTypeRestating: { type: 'boolean' as const },
          checkSingleLine: { type: 'boolean' as const },
          workspaceTagPrefixes: { type: 'array' as const, items: { type: 'string' as const } }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;

    const checkDescription = options.checkDescription !== false;
    const checkParam = options.checkParam !== false;
    const checkReturns = options.checkReturns !== false;
    const checkThrows = options.checkThrows !== false;
    const checkTagOrder = options.checkTagOrder !== false;
    const checkExampleFence = options.checkExampleFence !== false;
    const checkTypeRestating = options.checkTypeRestating !== false;
    const checkSingleLine = options.checkSingleLine !== false;
    const workspacePrefixes = options.workspaceTagPrefixes ?? DEFAULT_WORKSPACE_TAG_PREFIXES;

    function reportRangeMessage(commentNode: AstNode, parsed: ParsedJsdoc, messageId: string, lineIndex: number, data?: Record<string, string>): void {
      const line = parsed.lines[lineIndex];
      const startInValue = line?.textOffsetStart ?? 0;
      const endInValue = startInValue + (line?.text?.length ?? 0);
      const start = commentValueToSourceOffset(commentNode, startInValue);
      const end = commentValueToSourceOffset(commentNode, endInValue);
      context.report({
        loc: {
          start: sourceCode.getLocFromIndex(start),
          end: sourceCode.getLocFromIndex(end)
        },
        messageId,
        data
      });
    }

    function checkParamFormat(commentNode: AstNode, parsed: ParsedJsdoc, tag: ParsedJsdocTag, sourceText: string): void {
      const paramLineText = parsed.lines[tag.startLineIndex].text;
      const name = tag.name ?? '<unknown>';

      if (tag.name) {
        const hasCanonicalHyphen = / - /.test(paramLineText) || /^@param\s+\S+\s*$/.test(paramLineText);

        if (!hasCanonicalHyphen && tag.description.trim().length > 0) {
          reportRangeMessage(commentNode, parsed, 'paramHyphen', tag.startLineIndex, { name });
        }
      }

      // The parser preserves the `- ` separator inside `tag.description`. Strip it for content checks.
      const trimmed = tag.description.replace(/^\s*-\s*/, '');

      if (trimmed.length > 0) {
        if (!startsCanonically(trimmed, 'capital')) {
          reportRangeMessage(commentNode, parsed, 'paramDescriptionCapital', tag.startLineIndex, { name });
        }
        if (!endsCanonically(trimmed)) {
          const fix = buildAppendPeriodFix(commentNode, parsed, tag, sourceText);
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(commentValueToSourceOffset(commentNode, parsed.lines[tag.startLineIndex].textOffsetStart)),
              end: sourceCode.getLocFromIndex(commentValueToSourceOffset(commentNode, parsed.lines[tag.endLineIndex].textOffsetStart + parsed.lines[tag.endLineIndex].text.length))
            },
            messageId: 'paramDescriptionPeriod',
            data: { name },
            fix
          });
        }

        if (checkTypeRestating && TYPE_RESTATING_PATTERNS.some((re) => re.test(trimmed))) {
          reportRangeMessage(commentNode, parsed, 'descriptionTypeRestating', tag.startLineIndex);
        }
      }
    }

    function buildAppendPeriodFix(commentNode: AstNode, parsed: ParsedJsdoc, tag: ParsedJsdocTag, sourceText: string): (fixer: AstNode) => AstNode | null {
      return (fixer: AstNode) => {
        let fixResult: AstNode | null = null;
        const lastLine = parsed.lines[tag.endLineIndex];

        if (lastLine && lastLine.text.trim().length !== 0) {
          const charPos = lastNonBlankCharIndex(lastLine.text);

          if (charPos !== -1) {
            const ch = lastLine.text.charAt(charPos);

            if (!TERMINAL_PUNCTUATION.has(ch) && ch !== '`') {
              const insertAt = commentValueToSourceOffset(commentNode, lastLine.textOffsetStart + charPos + 1);
              void sourceText; // referenced for symmetry with other fixers
              fixResult = fixer.insertTextAfterRange([insertAt, insertAt], '.');
            }
          }
        }

        return fixResult;
      };
    }

    function checkReturnsFormat(commentNode: AstNode, parsed: ParsedJsdoc, tag: ParsedJsdocTag, sourceText: string): void {
      const description = tag.description;
      const trimmed = description.trimStart();

      if (trimmed.startsWith('- ')) {
        reportRangeMessage(commentNode, parsed, 'returnsNoHyphen', tag.startLineIndex);
      }

      if (trimmed.length === 0) return;

      const checkedDescription = trimmed.startsWith('- ') ? trimmed.slice(2) : trimmed;

      if (!startsCanonically(checkedDescription, 'capital')) {
        reportRangeMessage(commentNode, parsed, 'returnsDescriptionCapital', tag.startLineIndex);
      }
      if (!endsCanonically(checkedDescription)) {
        const fix = buildAppendPeriodFix(commentNode, parsed, tag, sourceText);
        context.report({
          loc: {
            start: sourceCode.getLocFromIndex(commentValueToSourceOffset(commentNode, parsed.lines[tag.startLineIndex].textOffsetStart)),
            end: sourceCode.getLocFromIndex(commentValueToSourceOffset(commentNode, parsed.lines[tag.endLineIndex].textOffsetStart + parsed.lines[tag.endLineIndex].text.length))
          },
          messageId: 'returnsDescriptionPeriod',
          fix
        });
      }
      if (checkTypeRestating && TYPE_RESTATING_PATTERNS.some((re) => re.test(checkedDescription))) {
        reportRangeMessage(commentNode, parsed, 'descriptionTypeRestating', tag.startLineIndex);
      }
    }

    function checkThrowsFormat(commentNode: AstNode, parsed: ParsedJsdoc, tag: ParsedJsdocTag): void {
      if (!tag.type) {
        reportRangeMessage(commentNode, parsed, 'throwsErrorType', tag.startLineIndex);
      } else {
        const description = tag.description;

        if (description.trim().length !== 0) {
          if (!startsCanonically(description, 'capital')) {
            reportRangeMessage(commentNode, parsed, 'throwsDescriptionCapital', tag.startLineIndex);
          }
          if (!endsCanonically(description)) {
            reportRangeMessage(commentNode, parsed, 'throwsDescriptionPeriod', tag.startLineIndex);
          }
        }
      }
    }

    function checkExampleFormat(commentNode: AstNode, parsed: ParsedJsdoc, tag: ParsedJsdocTag): void {
      const body = tag.description;
      const trimmed = body.replace(/^\s+/, '');
      if (trimmed.length === 0) return;
      if (!trimmed.startsWith('```')) {
        reportRangeMessage(commentNode, parsed, 'exampleFence', tag.startLineIndex);
      }
    }

    function checkTags(commentNode: AstNode, parsed: ParsedJsdoc, sourceText: string, functionNode: AstNode | null): void {
      // Tag ordering
      if (checkTagOrder) {
        let lastRank = -Infinity;
        for (const tag of parsed.tags) {
          const rank = rankFor(tag, workspacePrefixes);
          if (rank < lastRank) {
            reportRangeMessage(commentNode, parsed, 'tagOrder', tag.startLineIndex, { tag: tag.tag });
          } else {
            lastRank = rank;
          }
        }
      }

      // Per-tag formatting
      const paramTags = parsed.tags.filter((t) => t.tag === 'param');

      if (checkParam) {
        for (const tag of paramTags) {
          checkParamFormat(commentNode, parsed, tag, sourceText);
        }

        if (functionNode && Array.isArray(functionNode.params) && paramTags.length > 0) {
          const declared = functionNode.params.map((p: AstNode) => extractParamName(p)).filter((n: string | null): n is string => typeof n === 'string');
          const documented = paramTags.map((t) => t.name ?? '');
          for (let i = 0; i < Math.min(declared.length, documented.length); i += 1) {
            if (declared[i] !== documented[i]) {
              reportRangeMessage(commentNode, parsed, 'paramOrder', paramTags[i].startLineIndex, { name: documented[i] || '<unknown>', expected: declared[i] });
              break;
            }
          }
        }
      }

      if (checkReturns) {
        for (const tag of parsed.tags) {
          if (tag.tag === 'returns' || tag.tag === 'return') {
            checkReturnsFormat(commentNode, parsed, tag, sourceText);
          }
        }
      }

      if (checkThrows) {
        for (const tag of parsed.tags) {
          if (tag.tag === 'throws') {
            checkThrowsFormat(commentNode, parsed, tag);
          }
        }
      }

      if (checkExampleFence) {
        for (const tag of parsed.tags) {
          if (tag.tag === 'example') {
            checkExampleFormat(commentNode, parsed, tag);
          }
        }
      }
    }

    function checkDescriptionBlock(commentNode: AstNode, parsed: ParsedJsdoc): void {
      if (checkDescription) {
        const paragraphs = parsed.descriptionParagraphs;

        if (paragraphs.length !== 0) {
          // First paragraph: capitalized, period.
          const first = paragraphs[0];
          // Locate the line index for the first non-blank description line for reporting.
          let firstLineIdx = 0;
          for (let i = 0; i < parsed.descriptionLines.length; i += 1) {
            if (!parsed.descriptionLines[i].blank) {
              firstLineIdx = parsed.descriptionLines[i].index;
              break;
            }
          }

          if (!startsCanonically(first, 'capital')) {
            reportRangeMessage(commentNode, parsed, 'descriptionMissingCapital', firstLineIdx);
          }
          if (!endsCanonically(first)) {
            reportRangeMessage(commentNode, parsed, 'descriptionMissingPeriod', firstLineIdx);
          }

          if (checkTypeRestating && TYPE_RESTATING_PATTERNS.some((re) => re.test(first.trim()))) {
            reportRangeMessage(commentNode, parsed, 'descriptionTypeRestating', firstLineIdx);
          }

          // Paragraph separator: exactly one blank line between paragraphs.
          if (paragraphs.length > 1) {
            // Walk descriptionLines and count blank-line runs.
            const descLines = parsed.descriptionLines;
            let runStart = -1;
            let firstWasContent = false;
            for (let i = 0; i < descLines.length; i += 1) {
              if (!descLines[i].blank) firstWasContent = true;
              if (descLines[i].blank && firstWasContent) {
                if (runStart === -1) runStart = i;
              } else if (!descLines[i].blank && runStart !== -1) {
                const runLength = i - runStart;
                if (runLength !== 1) {
                  reportRangeMessage(commentNode, parsed, 'descriptionParagraphSeparator', descLines[runStart].index);
                }
                runStart = -1;
              }
            }
          }
        }
      }
    }

    function checkOneJsdoc(commentNode: AstNode, anchor: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const sourceText = sourceCode.getText();
      const functionNode = functionLikeFromAnchor(anchor);

      if (checkSingleLine && parsed.singleLine && functionNode && Array.isArray(functionNode.params) && functionNode.params.length > 0) {
        reportRangeMessage(commentNode, parsed, 'functionShouldBeMultiline', 0);
      }

      checkDescriptionBlock(commentNode, parsed);
      checkTags(commentNode, parsed, sourceText, functionNode);
    }

    function leadingJsdocFor(node: AstNode): AstNode | null {
      const anchor = getStatementAnchor(node);
      const comments: AstNode[] = sourceCode.getCommentsBefore(anchor) || [];
      let result: AstNode | null = null;

      for (const comment of comments) {
        if (comment.type === 'Block' && typeof comment.value === 'string' && comment.value.startsWith('*')) {
          result = comment;
        }
      }

      return result;
    }

    function visitFunctionDeclaration(node: AstNode): void {
      if (!node.body) return;
      const jsdoc = leadingJsdocFor(node);
      if (jsdoc) checkOneJsdoc(jsdoc, getStatementAnchor(node));
    }

    function visitMethodDefinition(node: AstNode): void {
      const jsdoc = leadingJsdocForMethod(node);
      if (jsdoc) checkOneJsdoc(jsdoc, node);
    }

    function leadingJsdocForMethod(node: AstNode): AstNode | null {
      const comments: AstNode[] = sourceCode.getCommentsBefore(node) || [];
      let result: AstNode | null = null;

      for (const comment of comments) {
        if (comment.type === 'Block' && typeof comment.value === 'string' && comment.value.startsWith('*')) {
          result = comment;
        }
      }

      return result;
    }

    function visitVariableDeclaration(node: AstNode): void {
      const declarator = node.declarations?.[0];

      if (declarator) {
        const init = declarator.init;

        if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
          // Anchor for getStatementAnchor expects FunctionDeclaration; emulate for variable declarations.
          const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
          const comments: AstNode[] = sourceCode.getCommentsBefore(anchor) || [];
          let jsdoc: AstNode | null = null;
          for (const comment of comments) {
            if (comment.type === 'Block' && typeof comment.value === 'string' && comment.value.startsWith('*')) {
              jsdoc = comment;
            }
          }
          if (jsdoc) checkOneJsdoc(jsdoc, anchor);
        }
      }
    }

    return {
      FunctionDeclaration: visitFunctionDeclaration,
      MethodDefinition: visitMethodDefinition,
      VariableDeclaration: visitVariableDeclaration
    };
  }
};

/**
 * Returns the identifier name of a function parameter node, or null when the parameter is a pattern
 * (object/array destructuring) that doesn't have a single identifier.
 *
 * @param param - The parameter AST node.
 * @returns The identifier name, or null.
 *
 * @example
 * ```ts
 * extractParamName({ type: 'Identifier', name: 'x' }); // 'x'
 * extractParamName({ type: 'AssignmentPattern', left: { type: 'Identifier', name: 'y' } }); // 'y'
 * ```
 */
function extractParamName(param: AstNode): string | null {
  let name: string | null = null;

  if (param.type === 'Identifier') {
    name = param.name;
  } else if (param.type === 'AssignmentPattern' && param.left?.type === 'Identifier') {
    name = param.left.name;
  } else if (param.type === 'RestElement' && param.argument?.type === 'Identifier') {
    name = param.argument.name;
  } else if (param.type === 'TSParameterProperty' && param.parameter?.type === 'Identifier') {
    name = param.parameter.name;
  }

  return name;
}
