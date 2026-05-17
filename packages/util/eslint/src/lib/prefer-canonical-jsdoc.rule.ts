import { getStatementAnchor } from './comments';
import { parseJsdocComment, type ParsedJsdoc, type ParsedJsdocTag } from './jsdoc-parser';

type AstNode = any;

const TAG_LINE_REGEX = /^@([A-Za-z_][A-Za-z0-9_]*)\s*(.*)$/;

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
 * MessageIds whose findings are repaired by the comment-level autofix pipeline. `throwsErrorType`
 * (needs a user-provided error type) and `descriptionTypeRestating` (needs rewording) are
 * deliberately excluded — they remain report-only.
 */
const AUTOFIXABLE_MESSAGE_IDS: ReadonlySet<string> = new Set(['descriptionMissingCapital', 'descriptionMissingPeriod', 'descriptionParagraphSeparator', 'paramHyphen', 'paramDescriptionCapital', 'paramDescriptionPeriod', 'paramOrder', 'returnsNoHyphen', 'returnsDescriptionCapital', 'returnsDescriptionPeriod', 'throwsDescriptionCapital', 'throwsDescriptionPeriod', 'tagOrder', 'exampleFence', 'functionShouldBeMultiline']);

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
function rankFor(tag: Pick<ParsedJsdocTag, 'tag'>, workspacePrefixes: readonly string[]): number {
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
 * Mutable per-tag view used by the autofix pipeline. Built from a {@link ParsedJsdocTag}, mutated
 * in place by the normalizers, then re-serialized.
 */
interface CanonicalTag {
  tag: string;
  type: string | undefined;
  name: string | undefined;
  /**
   * Text that appears on the same line as the `@tag` header, after `@tag {Type} name` has been
   * stripped. The serializer re-emits the canonical separator (` - ` for `@param`, ` ` otherwise).
   */
  headerText: string;
  /**
   * Lines that follow the header line, with their leading ` * ` prefix already stripped. Interior
   * blank lines are preserved (matters for fenced `@example` blocks); trailing blanks are stripped.
   */
  continuationLines: string[];
}

/**
 * Mutable view of an entire JSDoc comment.
 */
interface CanonicalJsdocModel {
  singleLine: boolean;
  descriptionParagraphs: string[][];
  tags: CanonicalTag[];
}

/**
 * Returns the leading whitespace before `commentNode.range[0]` on its source line, or null when
 * the comment is not the first non-whitespace token on its line (inline JSDoc, which we can't
 * safely rewrite as multi-line).
 */
function getCommentLineIndent(sourceText: string, commentNode: AstNode): string | null {
  let lineStart = commentNode.range[0];
  while (lineStart > 0 && sourceText.charAt(lineStart - 1) !== '\n') {
    lineStart -= 1;
  }
  const prefix = sourceText.slice(lineStart, commentNode.range[0]);
  return /^\s*$/.test(prefix) ? prefix : null;
}

/**
 * Builds the mutable canonical view from a {@link ParsedJsdoc}. The {@link CanonicalTag} headerText
 * is recovered from the original tag-line text rather than from `tag.description`, so a tag whose
 * body starts on a continuation line (e.g. `@example` followed by a fenced block) keeps its
 * headerText empty.
 */
function buildCanonicalModel(parsed: ParsedJsdoc): CanonicalJsdocModel {
  const descriptionParagraphs: string[][] = parsed.descriptionParagraphs.map((p) => p.split('\n'));

  const tags: CanonicalTag[] = parsed.tags.map((t) => {
    const firstLineText = t.lines[0]?.text ?? '';
    let headerText = '';
    const m = firstLineText.match(TAG_LINE_REGEX);

    if (m) {
      let remainder = m[2];

      if (t.type !== undefined) {
        const tm = remainder.match(/^\{[^}]*\}\s*(.*)$/);
        if (tm) remainder = tm[1];
      }

      if (t.name !== undefined) {
        const nm = remainder.match(/^[A-Za-z_$][A-Za-z0-9_$.[\]]*\s*(.*)$/);
        if (nm) remainder = nm[1];
      }

      headerText = remainder;
    }

    const continuationLines = t.lines.slice(1).map((l) => l.text);
    while (continuationLines.length > 0 && continuationLines[continuationLines.length - 1].trim().length === 0) {
      continuationLines.pop();
    }

    return {
      tag: t.tag,
      type: t.type,
      name: t.name,
      headerText,
      continuationLines
    };
  });

  return {
    singleLine: parsed.singleLine,
    descriptionParagraphs,
    tags
  };
}

/**
 * Rank-bucket for separating tag groups with a blank `* ` line during serialization. Adjacent tags
 * in the same bucket are emitted with no separator. Buckets: standard (`@param`/`@returns`/`@throws`),
 * workspace, example, `@__NO_SIDE_EFFECTS__`. Unknown tags share the workspace bucket so a single
 * mis-named tag doesn't trigger an extra blank line.
 */
function bucketFor(tag: CanonicalTag, workspacePrefixes: readonly string[]): number {
  let bucket: number;

  if (tag.tag === 'param' || tag.tag === 'returns' || tag.tag === 'return' || tag.tag === 'throws') {
    bucket = 0;
  } else if (tag.tag === '__NO_SIDE_EFFECTS__') {
    bucket = 3;
  } else if (tag.tag === 'example') {
    bucket = 2;
  } else if (workspacePrefixes.some((p) => tag.tag === p || tag.tag.startsWith(p))) {
    bucket = 1;
  } else {
    bucket = 1;
  }

  return bucket;
}

/**
 * Serializes a single tag into its rendered lines (text only, no ` * ` prefix). The header line
 * uses ` - ` after the parameter name for `@param`, a single space for other tags. An empty
 * `headerText` produces a header line with no trailing content (used by `@example` whose body is
 * a fenced block on subsequent lines).
 */
function serializeTag(tag: CanonicalTag): string[] {
  let header = '@' + tag.tag;

  if (tag.type !== undefined) {
    header += ' {' + tag.type + '}';
  }

  if (tag.name !== undefined) {
    header += ' ' + tag.name;
  }

  if (tag.headerText.length > 0) {
    if (tag.tag === 'param') {
      header += ' - ' + tag.headerText;
    } else {
      header += ' ' + tag.headerText;
    }
  }

  return [header, ...tag.continuationLines];
}

/**
 * Serializes the canonical model back into a comment-value string (the text between `/*` and
 * `*\/`). For multi-line output, every content line is prefixed with `${indent} * `; blank
 * separators use `${indent} *` (no trailing space). For single-line output, the value is `* text `.
 */
function serializeJsdocValue(model: CanonicalJsdocModel, indent: string, workspacePrefixes: readonly string[]): string {
  let result: string;

  if (model.singleLine) {
    const descText = model.descriptionParagraphs[0]?.join(' ') ?? '';
    result = '* ' + descText + ' ';
  } else {
    const sections: string[][] = [];

    for (const paragraph of model.descriptionParagraphs) {
      sections.push([...paragraph]);
    }

    let currentBucket = -1;
    let currentSection: string[] | null = null;

    for (const tag of model.tags) {
      const b = bucketFor(tag, workspacePrefixes);

      if (b !== currentBucket) {
        currentSection = [];
        sections.push(currentSection);
        currentBucket = b;
      }

      currentSection!.push(...serializeTag(tag));
    }

    const allLines: string[] = [];

    for (let i = 0; i < sections.length; i += 1) {
      if (i > 0) allLines.push('');
      allLines.push(...sections[i]);
    }

    let value = '*';

    for (const line of allLines) {
      if (line.length === 0) {
        value += '\n' + indent + ' *';
      } else {
        value += '\n' + indent + ' * ' + line;
      }
    }

    value += '\n' + indent + ' ';
    result = value;
  }

  return result;
}

const LOWER_LETTER_PATTERN = /[a-z]/;

/**
 * Returns the offset of the first non-whitespace character of `text`, or -1.
 */
function firstNonBlankOffset(text: string): number {
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
 * Returns the offset of the last non-whitespace character of `text`, or -1.
 */
function lastNonBlankOffset(text: string): number {
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
 * Capitalizes the first letter of `text` if it's a lowercase ASCII letter. Returns the new string
 * (or the original when no change is needed).
 */
function capitalizeFirstLetter(text: string): string {
  let result = text;
  const idx = firstNonBlankOffset(text);

  if (idx !== -1) {
    const ch = text.charAt(idx);
    if (LOWER_LETTER_PATTERN.test(ch)) {
      result = text.slice(0, idx) + ch.toUpperCase() + text.slice(idx + 1);
    }
  }

  return result;
}

/**
 * Appends `.` after the last non-whitespace character of `text` if that character isn't already
 * terminal punctuation (`.`, `!`, `?`, `}`, `)`, `]`) or a backtick. Returns the new string.
 */
function appendTerminalPeriod(text: string): string {
  let result = text;
  const idx = lastNonBlankOffset(text);

  if (idx !== -1) {
    const ch = text.charAt(idx);
    if (!TERMINAL_PUNCTUATION.has(ch) && ch !== '`') {
      result = text.slice(0, idx + 1) + '.' + text.slice(idx + 1);
    }
  }

  return result;
}

/**
 * Capitalizes the first non-blank character of the first description paragraph in place. No-op
 * when the description is empty or doesn't start with a lowercase letter.
 */
function normalizeDescriptionCapital(model: CanonicalJsdocModel): void {
  const para = model.descriptionParagraphs[0];

  if (para && para.length > 0) {
    para[0] = capitalizeFirstLetter(para[0]);
  }
}

/**
 * Appends terminal punctuation to the last non-blank line of the first description paragraph.
 */
function normalizeDescriptionPeriod(model: CanonicalJsdocModel): void {
  const para = model.descriptionParagraphs[0];

  if (para && para.length > 0) {
    for (let i = para.length - 1; i >= 0; i -= 1) {
      if (para[i].trim().length > 0) {
        para[i] = appendTerminalPeriod(para[i]);
        break;
      }
    }
  }
}

/**
 * Strips a leading `- ` (and variants like `: `) from the headerText of `@param` tags so the
 * serializer can canonically re-add the ` - ` separator. Idempotent.
 */
function normalizeParamHyphen(tag: CanonicalTag): void {
  if (tag.tag === 'param') {
    tag.headerText = tag.headerText.replace(/^[-:]\s+/, '');
  }
}

/**
 * Strips a leading `- ` from the headerText of `@returns`/`@return` tags. The canonical form is
 * `@returns Description.` without a hyphen.
 */
function normalizeReturnsHyphen(tag: CanonicalTag): void {
  if (tag.tag === 'returns' || tag.tag === 'return') {
    tag.headerText = tag.headerText.replace(/^-\s+/, '');
  }
}

/**
 * Capitalizes the first letter of the tag's first description line (headerText, or the first
 * continuation line when headerText is empty). Applied only to `@param`/`@returns`/`@throws`.
 */
function normalizeTagDescriptionCapital(tag: CanonicalTag): void {
  if (tag.tag === 'param' || tag.tag === 'returns' || tag.tag === 'return' || tag.tag === 'throws') {
    if (tag.headerText.trim().length > 0) {
      tag.headerText = capitalizeFirstLetter(tag.headerText);
    } else {
      for (let i = 0; i < tag.continuationLines.length; i += 1) {
        if (tag.continuationLines[i].trim().length > 0) {
          tag.continuationLines[i] = capitalizeFirstLetter(tag.continuationLines[i]);
          break;
        }
      }
    }
  }
}

/**
 * Appends terminal punctuation to the last non-blank line of the tag body. Applied to
 * `@param`/`@returns`/`@throws`.
 */
function normalizeTagDescriptionPeriod(tag: CanonicalTag): void {
  if (tag.tag === 'param' || tag.tag === 'returns' || tag.tag === 'return' || tag.tag === 'throws') {
    let mutated = false;

    for (let i = tag.continuationLines.length - 1; i >= 0; i -= 1) {
      if (tag.continuationLines[i].trim().length > 0) {
        tag.continuationLines[i] = appendTerminalPeriod(tag.continuationLines[i]);
        mutated = true;
        break;
      }
    }

    if (!mutated && tag.headerText.trim().length > 0) {
      tag.headerText = appendTerminalPeriod(tag.headerText);
    }
  }
}

/**
 * Wraps the body of an `@example` tag in a triple-backtick `ts` fenced block when it isn't
 * already fenced. No-op when the body is empty or already opens with ` ``` `.
 */
function normalizeExampleFence(tag: CanonicalTag): void {
  if (tag.tag === 'example') {
    const bodyLines: string[] = [];

    if (tag.headerText.length > 0) bodyLines.push(tag.headerText);
    for (const line of tag.continuationLines) bodyLines.push(line);

    let firstNonBlank: string | null = null;
    for (const line of bodyLines) {
      if (line.trim().length > 0) {
        firstNonBlank = line;
        break;
      }
    }

    if (firstNonBlank !== null && !firstNonBlank.trimStart().startsWith('```')) {
      const content: string[] = [];
      for (const line of bodyLines) {
        if (line.trim().length > 0) content.push(line);
      }

      tag.headerText = '';
      tag.continuationLines = ['```ts', ...content, '```'];
    }
  }
}

/**
 * Stable-sorts the model's tags by canonical rank, then reorders `@param` tags to match the
 * declared parameter signature when `functionNode` is provided.
 */
function normalizeTagOrder(model: CanonicalJsdocModel, functionNode: AstNode | null, workspacePrefixes: readonly string[]): void {
  const indexed = model.tags.map((tag, index) => ({ tag, index, rank: rankFor(tag, workspacePrefixes) }));
  indexed.sort((a, b) => a.rank - b.rank || a.index - b.index);

  if (functionNode && Array.isArray(functionNode.params)) {
    const declared: string[] = [];
    for (const param of functionNode.params) {
      const name = extractParamName(param);
      if (typeof name === 'string') declared.push(name);
    }

    if (declared.length > 0) {
      const paramSlots: number[] = [];
      const paramEntries: typeof indexed = [];

      for (let i = 0; i < indexed.length; i += 1) {
        if (indexed[i].tag.tag === 'param') {
          paramSlots.push(i);
          paramEntries.push(indexed[i]);
        }
      }

      paramEntries.sort((a, b) => {
        const ai = a.tag.name === undefined ? -1 : declared.indexOf(a.tag.name);
        const bi = b.tag.name === undefined ? -1 : declared.indexOf(b.tag.name);
        const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
        const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
        return aRank - bRank || a.index - b.index;
      });

      for (let i = 0; i < paramSlots.length; i += 1) {
        indexed[paramSlots[i]] = paramEntries[i];
      }
    }
  }

  model.tags = indexed.map((e) => e.tag);
}

/**
 * Applies every in-place normalization to the canonical model. The order matters in two places:
 * the hyphen strips must run before the description-capital normalization (otherwise a leading
 * `- ` would block capitalization), and tag reordering runs last so it operates on already-fixed
 * tags. The pipeline is idempotent: a second pass on a fully-canonical model is a no-op.
 */
function applyCanonicalNormalizations(model: CanonicalJsdocModel, functionNode: AstNode | null, workspacePrefixes: readonly string[], forceMultiline: boolean): void {
  if (forceMultiline) {
    model.singleLine = false;
  }

  for (const tag of model.tags) {
    normalizeParamHyphen(tag);
    normalizeReturnsHyphen(tag);
    normalizeTagDescriptionCapital(tag);
    normalizeTagDescriptionPeriod(tag);
    normalizeExampleFence(tag);
  }

  normalizeDescriptionCapital(model);
  normalizeDescriptionPeriod(model);
  normalizeTagOrder(model, functionNode, workspacePrefixes);
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

    /**
     * Per-comment scratch state for the autofix. `commentFix` holds the lazily-computed rewrite
     * for the current comment (null when the comment is already canonical); `commentFixAttached`
     * tracks whether we've already attached it to a report so we don't emit duplicate fixes.
     */
    let commentFix: ((fixer: AstNode) => AstNode | null) | null = null;
    let commentFixAttached = false;

    function takeCommentFix(): ((fixer: AstNode) => AstNode | null) | undefined {
      let result: ((fixer: AstNode) => AstNode | null) | undefined;

      if (commentFix && !commentFixAttached) {
        commentFixAttached = true;
        result = commentFix;
      }

      return result;
    }

    function reportRangeMessage(commentNode: AstNode, parsed: ParsedJsdoc, messageId: string, lineIndex: number, data?: Record<string, string>): void {
      const line = parsed.lines[lineIndex];
      const startInValue = line?.textOffsetStart ?? 0;
      const endInValue = startInValue + (line?.text?.length ?? 0);
      const start = commentValueToSourceOffset(commentNode, startInValue);
      const end = commentValueToSourceOffset(commentNode, endInValue);
      const fix = AUTOFIXABLE_MESSAGE_IDS.has(messageId) ? takeCommentFix() : undefined;
      context.report({
        loc: {
          start: sourceCode.getLocFromIndex(start),
          end: sourceCode.getLocFromIndex(end)
        },
        messageId,
        data,
        fix
      });
    }

    function checkParamFormat(commentNode: AstNode, parsed: ParsedJsdoc, tag: ParsedJsdocTag): void {
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
          reportRangeMessage(commentNode, parsed, 'paramDescriptionPeriod', tag.startLineIndex, { name });
        }

        if (checkTypeRestating && TYPE_RESTATING_PATTERNS.some((re) => re.test(trimmed))) {
          reportRangeMessage(commentNode, parsed, 'descriptionTypeRestating', tag.startLineIndex);
        }
      }
    }

    function checkReturnsFormat(commentNode: AstNode, parsed: ParsedJsdoc, tag: ParsedJsdocTag): void {
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
        reportRangeMessage(commentNode, parsed, 'returnsDescriptionPeriod', tag.startLineIndex);
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

    function checkTags(commentNode: AstNode, parsed: ParsedJsdoc, functionNode: AstNode | null): void {
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
          checkParamFormat(commentNode, parsed, tag);
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
            checkReturnsFormat(commentNode, parsed, tag);
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

      // Compute the comment-level autofix once per JSDoc. `reportRangeMessage` consumes it for
      // the first autofixable finding so ESLint applies a single rewrite per comment per pass.
      commentFix = null;
      commentFixAttached = false;
      const indent = getCommentLineIndent(sourceText, commentNode);
      const wantsMultiline = !!(checkSingleLine && parsed.singleLine && functionNode && Array.isArray(functionNode.params) && functionNode.params.length > 0);

      if (indent !== null) {
        const model = buildCanonicalModel(parsed);
        applyCanonicalNormalizations(model, functionNode, workspacePrefixes, wantsMultiline);
        const newValue = serializeJsdocValue(model, indent, workspacePrefixes);

        if (newValue !== commentNode.value) {
          commentFix = (fixer: AstNode) => fixer.replaceTextRange(commentNode.range, '/*' + newValue + '*/');
        }
      }

      if (checkSingleLine && parsed.singleLine && functionNode && Array.isArray(functionNode.params) && functionNode.params.length > 0) {
        reportRangeMessage(commentNode, parsed, 'functionShouldBeMultiline', 0);
      }

      checkDescriptionBlock(commentNode, parsed);
      checkTags(commentNode, parsed, functionNode);
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
