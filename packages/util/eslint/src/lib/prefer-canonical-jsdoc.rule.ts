import { getStatementAnchor } from './comments';
import type { Maybe } from '@dereekb/util';
import { parseJsdocComment, type ParsedJsdoc, type ParsedJsdocTag } from './jsdoc-parser';

interface AstNode {
  readonly type: string;
  [key: string]: any;
}

const TAG_LINE_REGEX = /^@([A-Za-z_]\w*)\s*(.*)$/;

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
  create(context: { options: UtilPreferCanonicalJsdocRuleOptions[]; report: (descriptor: { node?: AstNode; loc?: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => Maybe<AstNode | AstNode[]> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
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
 *
 * @param text - Source text scanned left-to-right.
 * @returns Zero-based offset of the first non-whitespace character, or `-1` when the text is blank.
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
 *
 * @param text - Source text scanned right-to-left.
 * @returns Zero-based offset of the last non-whitespace character, or `-1` when the text is blank.
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
 *
 * @param text - Description text whose opener is being validated.
 * @param check - Style requirement currently restricted to `'capital'`.
 * @returns True when the opener already satisfies the canonical form.
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
 *
 * @param text - Description text whose terminator is being validated.
 * @returns True when the text ends with canonical terminal punctuation (or a fenced closer).
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
 *
 * @param commentNode - Block comment whose original source location anchors the conversion.
 * @param valueOffset - Offset measured against the comment's `value` (post-`/**` prefix).
 * @returns Absolute offset into the file source text.
 */
function commentValueToSourceOffset(commentNode: AstNode, valueOffset: number): number {
  return commentNode.range[0] + 2 + valueOffset; // `/*` is 2 chars; `*` of `/**` is part of the value
}

/**
 * Detects whether the function-like node has parameters in its signature. Variable-bound arrow
 * functions arrive through their VariableDeclaration parent; class methods through MethodDefinition.
 *
 * @param anchor - Declaration node directly underneath the JSDoc comment.
 * @returns Underlying function-shaped node when one can be resolved; otherwise null.
 */
function functionLikeFromAnchor(anchor: AstNode): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;

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

const TYPE_RESTATING_PATTERNS: readonly RegExp[] = [/^a string\b/i, /^a number\b/i, /^a boolean\b/i, /^an array of\b/i, /^an instance of\b/i, /^a (?:map|set|promise|function|array|object|date)\b/i, /^the (?:string|number|boolean|array|map|set|promise|object|date)(?:\s+(?:value|object|data|instance))?\s*\.?\s*$/i];

/**
 * Returns the tag-order rank for a parsed tag, using the configured workspace prefixes.
 *
 * @param tag - Parsed tag whose canonical position should be looked up.
 * @param workspacePrefixes - Tag-name prefixes that are recognized as workspace tags.
 * @returns Numeric rank used by the sorting pass; lower ranks come first.
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
  type: Maybe<string>;
  name: Maybe<string>;
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
 *
 * @param sourceText - Full file source the comment sits within.
 * @param commentNode - Block-comment node whose indentation should be reconstructed.
 * @returns Leading-whitespace prefix on the comment's line, or null when the comment is inline.
 */
function getCommentLineIndent(sourceText: string, commentNode: AstNode): Maybe<string> {
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
 *
 * @param parsed - Immutable parsed view of the JSDoc block.
 * @returns Mutable canonical model that downstream normalizers can edit in place.
 */
function buildCanonicalModel(parsed: ParsedJsdoc): CanonicalJsdocModel {
  const descriptionParagraphs: string[][] = parsed.descriptionParagraphs.map((p) => p.split('\n'));

  const tags: CanonicalTag[] = parsed.tags.map((t) => {
    const firstLineText = t.lines[0]?.text ?? '';
    let headerText = '';
    const m = TAG_LINE_REGEX.exec(firstLineText);

    if (m) {
      let remainder = m[2];

      if (t.type !== undefined) {
        const tm = /^\{[^}]*\}\s*(.*)$/.exec(remainder);
        if (tm) remainder = tm[1];
      }

      if (t.name !== undefined) {
        const nm = /^[A-Za-z_$][A-Za-z0-9_$.[\]]*\s*(.*)$/.exec(remainder);
        if (nm) remainder = nm[1];
      }

      headerText = remainder;
    }

    const continuationLines = t.lines.slice(1).map((l) => l.text);
    while (continuationLines.length > 0 && (continuationLines.at(-1) as string).trim().length === 0) {
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
 *
 * @param tag - Tag whose serialization bucket should be resolved.
 * @param workspacePrefixes - Tag-name prefixes recognized as workspace tags.
 * @returns Bucket id used by the serializer to decide blank-line separators.
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
 *
 * @param tag - Canonical tag to render.
 * @returns Header line followed by any continuation lines for the tag.
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
 * Groups the canonical tags into bucketed sections, inserting a new section when the bucket changes.
 *
 * @param tags - Canonical tags in their already-ordered position.
 * @param workspacePrefixes - Tag-name prefixes recognized as workspace tags.
 * @returns Array of sections, each section a flat array of rendered tag lines.
 */
function groupTagsIntoSections(tags: readonly CanonicalTag[], workspacePrefixes: readonly string[]): string[][] {
  const sections: string[][] = [];
  let currentBucket = -1;
  let currentSection: string[] = [];
  let hasCurrentSection = false;

  for (const tag of tags) {
    const b = bucketFor(tag, workspacePrefixes);

    if (!hasCurrentSection || b !== currentBucket) {
      currentSection = [];
      sections.push(currentSection);
      currentBucket = b;
      hasCurrentSection = true;
    }

    currentSection.push(...serializeTag(tag));
  }

  return sections;
}

/**
 * Joins bucketed sections into a flat line array, inserting a blank separator between sections.
 *
 * @param sections - Sections produced by `groupTagsIntoSections` plus prepended description paragraphs.
 * @returns Flattened line array with a single blank between adjacent sections.
 */
function flattenSections(sections: readonly string[][]): string[] {
  const allLines: string[] = [];

  for (const [i, section] of sections.entries()) {
    if (i > 0) allLines.push('');
    allLines.push(...section);
  }

  return allLines;
}

/**
 * Renders a flat line array as a multi-line JSDoc comment value with the given column indent.
 *
 * @param allLines - Comment body lines (blanks rendered as `${indent} *`).
 * @param indent - Whitespace prefix used on every comment line.
 * @returns Comment-value text ready to splice between `/*` and `*\/`.
 */
function renderMultilineValue(allLines: readonly string[], indent: string): string {
  let value = '*';

  for (const line of allLines) {
    if (line.length === 0) {
      value += '\n' + indent + ' *';
    } else {
      value += '\n' + indent + ' * ' + line;
    }
  }

  value += '\n' + indent + ' ';
  return value;
}

/**
 * Serializes the canonical model back into a comment-value string (the text between `/*` and
 * `*\/`). For multi-line output, every content line is prefixed with `${indent} * `; blank
 * separators use `${indent} *` (no trailing space). For single-line output, the value is `* text `.
 *
 * @param model - Canonical view to serialize.
 * @param indent - Whitespace prefix used on every comment line (matches the comment's column).
 * @param workspacePrefixes - Tag-name prefixes recognized as workspace tags during bucketing.
 * @returns Rendered comment value ready to splice in via fixer.replaceTextRange.
 */
function serializeJsdocValue(model: CanonicalJsdocModel, indent: string, workspacePrefixes: readonly string[]): string {
  let result: string;

  if (model.singleLine) {
    const descText = model.descriptionParagraphs[0]?.join(' ') ?? '';
    result = '* ' + descText + ' ';
  } else {
    const descriptionSections: string[][] = model.descriptionParagraphs.map((paragraph) => [...paragraph]);
    const tagSections = groupTagsIntoSections(model.tags, workspacePrefixes);
    const allLines = flattenSections([...descriptionSections, ...tagSections]);
    result = renderMultilineValue(allLines, indent);
  }

  return result;
}

const LOWER_LETTER_PATTERN = /[a-z]/;

/**
 * Capitalizes the first letter of `text` if it's a lowercase ASCII letter. Returns the new string
 * (or the original when no change is needed).
 *
 * @param text - Description text whose opener should be upper-cased.
 * @returns Updated text with a leading capital letter, or the original when no rewrite was needed.
 */
function capitalizeFirstLetter(text: string): string {
  let result = text;
  const idx = firstNonBlankCharIndex(text);

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
 *
 * @param text - Description text whose terminator should be normalized.
 * @returns Updated text ending with terminal punctuation, or the original when none was needed.
 */
function appendTerminalPeriod(text: string): string {
  let result = text;
  const idx = lastNonBlankCharIndex(text);

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
 *
 * @param model - Canonical view whose first paragraph should be capitalized in place.
 */
function normalizeDescriptionCapital(model: CanonicalJsdocModel): void {
  const para = model.descriptionParagraphs[0];

  if (para && para.length > 0) {
    para[0] = capitalizeFirstLetter(para[0]);
  }
}

/**
 * Appends terminal punctuation to the last non-blank line of the first description paragraph.
 *
 * @param model - Canonical view whose first paragraph should gain a trailing period in place.
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
 *
 * @param tag - Canonical tag whose headerText should be stripped of any leading separator.
 */
function normalizeParamHyphen(tag: CanonicalTag): void {
  if (tag.tag === 'param') {
    tag.headerText = tag.headerText.replace(/^[-:]\s+/, '');
  }
}

/**
 * Strips a leading `- ` from the headerText of `@returns`/`@return` tags. The canonical form is
 * `@returns Description.` without a hyphen.
 *
 * @param tag - Canonical tag whose headerText should be stripped of any leading hyphen separator.
 */
function normalizeReturnsHyphen(tag: CanonicalTag): void {
  if (tag.tag === 'returns' || tag.tag === 'return') {
    tag.headerText = tag.headerText.replace(/^-\s+/, '');
  }
}

/**
 * Capitalizes the first letter of the tag's first description line (headerText, or the first
 * continuation line when headerText is empty). Applied only to `@param`/`@returns`/`@throws`.
 *
 * @param tag - Canonical tag whose description opener should be capitalized in place.
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
 *
 * @param tag - Canonical tag whose description should gain a trailing period in place.
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
 * Returns the first non-blank entry in a string array, or `null` when every entry is blank.
 *
 * @param lines - Candidate lines scanned in order.
 * @returns First non-blank line, or `null`.
 */
function findFirstNonBlankLine(lines: readonly string[]): Maybe<string> {
  let result: Maybe<string> = null;

  for (const line of lines) {
    if (line.trim().length > 0) {
      result = line;
      break;
    }
  }

  return result;
}

/**
 * Wraps the body of an `@example` tag in a triple-backtick `ts` fenced block when it isn't
 * already fenced. No-op when the body is empty or already opens with a fence.
 *
 * @param tag - Canonical `@example` tag whose body should be fenced in place.
 */
function normalizeExampleFence(tag: CanonicalTag): void {
  if (tag.tag !== 'example') return;

  const bodyLines: string[] = [];
  if (tag.headerText.length > 0) bodyLines.push(tag.headerText);
  bodyLines.push(...tag.continuationLines);

  const firstNonBlank = findFirstNonBlankLine(bodyLines);
  if (firstNonBlank === null) return;
  if (firstNonBlank.trimStart().startsWith('```')) return;

  const content = bodyLines.filter((line) => line.trim().length > 0);
  tag.headerText = '';
  tag.continuationLines = ['```ts', ...content, '```'];
}

interface IndexedTag {
  tag: CanonicalTag;
  index: number;
  rank: number;
}

/**
 * Extracts the declared parameter names from a function-like AST node.
 *
 * @param functionNode - Declaration whose `params` array supplies the declared names.
 * @returns Declared parameter identifiers in source order.
 */
function collectDeclaredParamNames(functionNode: AstNode): string[] {
  const declared: string[] = [];

  for (const param of functionNode.params) {
    const name = extractParamName(param);
    if (typeof name === 'string') declared.push(name);
  }

  return declared;
}

/**
 * Reorders `@param` entries inside the rank-sorted list to match the declared parameter signature
 * while leaving non-param entries in place.
 *
 * @param indexed - Rank-sorted entry list mutated in place.
 * @param declared - Declared parameter names in signature order.
 */
function reorderParamSlots(indexed: IndexedTag[], declared: readonly string[]): void {
  const paramSlots: number[] = [];
  const paramEntries: IndexedTag[] = [];

  for (const [i, element] of indexed.entries()) {
    if (element.tag.tag === 'param') {
      paramSlots.push(i);
      paramEntries.push(element);
    }
  }

  paramEntries.sort((a, b) => {
    const ai = a.tag.name == null ? -1 : declared.indexOf(a.tag.name);
    const bi = b.tag.name == null ? -1 : declared.indexOf(b.tag.name);
    const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    return aRank - bRank || a.index - b.index;
  });

  for (const [i, paramSlot] of paramSlots.entries()) {
    indexed[paramSlot] = paramEntries[i];
  }
}

/**
 * Stable-sorts the model's tags by canonical rank, then reorders `@param` tags to match the
 * declared parameter signature when `functionNode` is provided.
 *
 * @param model - Canonical view whose tag order should be normalized in place.
 * @param functionNode - Declaration whose parameter order anchors `@param` ordering; null skips that pass.
 * @param workspacePrefixes - Tag-name prefixes recognized as workspace tags during ranking.
 */
function normalizeTagOrder(model: CanonicalJsdocModel, functionNode: Maybe<AstNode>, workspacePrefixes: readonly string[]): void {
  const indexed: IndexedTag[] = model.tags.map((tag, index) => ({ tag, index, rank: rankFor(tag, workspacePrefixes) }));
  indexed.sort((a, b) => a.rank - b.rank || a.index - b.index);

  if (functionNode && Array.isArray(functionNode.params)) {
    const declared = collectDeclaredParamNames(functionNode);
    if (declared.length > 0) {
      reorderParamSlots(indexed, declared);
    }
  }

  model.tags = indexed.map((e) => e.tag);
}

/**
 * Inputs for {@link applyCanonicalNormalizations}.
 */
interface ApplyCanonicalNormalizationsInput {
  /**
   * Canonical view rewritten in place.
   */
  readonly model: CanonicalJsdocModel;
  /**
   * Declaration whose parameter order anchors `@param` ordering; null skips that pass.
   */
  readonly functionNode: Maybe<AstNode>;
  /**
   * Tag-name prefixes recognized as workspace tags during ranking and bucketing.
   */
  readonly workspacePrefixes: readonly string[];
  /**
   * When true, marks the model as multi-line before serialization.
   */
  readonly forceMultiline: boolean;
}

/**
 * Applies every in-place normalization to the canonical model. The order matters in two places:
 * the hyphen strips must run before the description-capital normalization (otherwise a leading
 * `- ` would block capitalization), and tag reordering runs last so it operates on already-fixed
 * tags. The pipeline is idempotent: a second pass on a fully-canonical model is a no-op.
 *
 * @param input - Model plus normalization context.
 */
function applyCanonicalNormalizations(input: ApplyCanonicalNormalizationsInput): void {
  const { model, functionNode, workspacePrefixes, forceMultiline } = input;

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
    let commentFix: Maybe<(fixer: AstNode) => Maybe<AstNode>> = null;
    let commentFixAttached = false;

    function takeCommentFix(): Maybe<(fixer: AstNode) => Maybe<AstNode>> {
      let result: Maybe<(fixer: AstNode) => Maybe<AstNode>>;

      if (commentFix && !commentFixAttached) {
        commentFixAttached = true;
        result = commentFix;
      }

      return result;
    }

    function reportRangeMessage(commentNode: AstNode, parsed: ParsedJsdoc, report: { messageId: string; lineIndex: number; data?: Record<string, string> }): void {
      const { messageId, lineIndex, data } = report;
      const line = parsed.lines[lineIndex];
      const startInValue = line?.textOffsetStart ?? 0;
      const endInValue = startInValue + (line?.text?.length ?? 0);
      const start = commentValueToSourceOffset(commentNode, startInValue);
      const end = commentValueToSourceOffset(commentNode, endInValue);
      const fix = AUTOFIXABLE_MESSAGE_IDS.has(messageId) ? (takeCommentFix() ?? undefined) : undefined;
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
          reportRangeMessage(commentNode, parsed, { messageId: 'paramHyphen', lineIndex: tag.startLineIndex, data: { name } });
        }
      }

      // The parser preserves the `- ` separator inside `tag.description`. Strip it for content checks.
      const trimmed = tag.description.replace(/^\s*-\s*/, '');

      if (trimmed.length > 0) {
        if (!startsCanonically(trimmed, 'capital')) {
          reportRangeMessage(commentNode, parsed, { messageId: 'paramDescriptionCapital', lineIndex: tag.startLineIndex, data: { name } });
        }
        if (!endsCanonically(trimmed)) {
          reportRangeMessage(commentNode, parsed, { messageId: 'paramDescriptionPeriod', lineIndex: tag.startLineIndex, data: { name } });
        }

        if (checkTypeRestating && TYPE_RESTATING_PATTERNS.some((re) => re.test(trimmed))) {
          reportRangeMessage(commentNode, parsed, { messageId: 'descriptionTypeRestating', lineIndex: tag.startLineIndex });
        }
      }
    }

    function checkReturnsFormat(commentNode: AstNode, parsed: ParsedJsdoc, tag: ParsedJsdocTag): void {
      const description = tag.description;
      const trimmed = description.trimStart();

      if (trimmed.startsWith('- ')) {
        reportRangeMessage(commentNode, parsed, { messageId: 'returnsNoHyphen', lineIndex: tag.startLineIndex });
      }

      if (trimmed.length === 0) return;

      const checkedDescription = trimmed.startsWith('- ') ? trimmed.slice(2) : trimmed;

      if (!startsCanonically(checkedDescription, 'capital')) {
        reportRangeMessage(commentNode, parsed, { messageId: 'returnsDescriptionCapital', lineIndex: tag.startLineIndex });
      }
      if (!endsCanonically(checkedDescription)) {
        reportRangeMessage(commentNode, parsed, { messageId: 'returnsDescriptionPeriod', lineIndex: tag.startLineIndex });
      }
      if (checkTypeRestating && TYPE_RESTATING_PATTERNS.some((re) => re.test(checkedDescription))) {
        reportRangeMessage(commentNode, parsed, { messageId: 'descriptionTypeRestating', lineIndex: tag.startLineIndex });
      }
    }

    function checkThrowsFormat(commentNode: AstNode, parsed: ParsedJsdoc, tag: ParsedJsdocTag): void {
      if (tag.type) {
        const description = tag.description;

        if (description.trim().length !== 0) {
          if (!startsCanonically(description, 'capital')) {
            reportRangeMessage(commentNode, parsed, { messageId: 'throwsDescriptionCapital', lineIndex: tag.startLineIndex });
          }
          if (!endsCanonically(description)) {
            reportRangeMessage(commentNode, parsed, { messageId: 'throwsDescriptionPeriod', lineIndex: tag.startLineIndex });
          }
        }
      } else {
        reportRangeMessage(commentNode, parsed, { messageId: 'throwsErrorType', lineIndex: tag.startLineIndex });
      }
    }

    function checkExampleFormat(commentNode: AstNode, parsed: ParsedJsdoc, tag: ParsedJsdocTag): void {
      const body = tag.description;
      const trimmed = body.replace(/^\s+/, '');
      if (trimmed.length === 0) return;
      if (!trimmed.startsWith('```')) {
        reportRangeMessage(commentNode, parsed, { messageId: 'exampleFence', lineIndex: tag.startLineIndex });
      }
    }

    function reportTagOrder(commentNode: AstNode, parsed: ParsedJsdoc): void {
      let lastRank = -Infinity;
      for (const tag of parsed.tags) {
        const rank = rankFor(tag, workspacePrefixes);
        if (rank < lastRank) {
          reportRangeMessage(commentNode, parsed, { messageId: 'tagOrder', lineIndex: tag.startLineIndex, data: { tag: tag.tag } });
        } else {
          lastRank = rank;
        }
      }
    }

    function reportParamOrderMismatch(commentNode: AstNode, parsed: ParsedJsdoc, paramTags: readonly ParsedJsdocTag[], functionNode: AstNode): void {
      const declared = functionNode.params.map((p: AstNode) => extractParamName(p)).filter((n: Maybe<string>): n is string => typeof n === 'string');
      // Collapse JSDoc dot-notation (e.g. `input.foo`) and consecutive dot-notation runs to the parent param.
      // `@param input.a` and `@param input.b` both reference the single declared `input` parameter.
      const documentedRaw = paramTags.map((t) => t.name ?? '');
      const documented: string[] = [];
      let lastBase: Maybe<string> = null;
      for (const name of documentedRaw) {
        const base = name.split('.')[0];
        if (base !== lastBase) {
          documented.push(base);
          lastBase = base;
        }
      }
      for (let i = 0; i < Math.min(declared.length, documented.length); i += 1) {
        if (declared[i] !== documented[i]) {
          reportRangeMessage(commentNode, parsed, { messageId: 'paramOrder', lineIndex: paramTags[i].startLineIndex, data: { name: documented[i] || '<unknown>', expected: declared[i] } });
          break;
        }
      }
    }

    function checkParamTags(commentNode: AstNode, parsed: ParsedJsdoc, paramTags: readonly ParsedJsdocTag[], functionNode: Maybe<AstNode>): void {
      for (const tag of paramTags) {
        checkParamFormat(commentNode, parsed, tag);
      }

      if (functionNode && Array.isArray(functionNode.params) && paramTags.length > 0) {
        reportParamOrderMismatch(commentNode, parsed, paramTags, functionNode);
      }
    }

    function checkTags(commentNode: AstNode, parsed: ParsedJsdoc, functionNode: Maybe<AstNode>): void {
      if (checkTagOrder) reportTagOrder(commentNode, parsed);

      const paramTags = parsed.tags.filter((t) => t.tag === 'param');

      if (checkParam) checkParamTags(commentNode, parsed, paramTags, functionNode);
      if (checkReturns) checkTagsByName(commentNode, parsed, ['returns', 'return'], checkReturnsFormat);
      if (checkThrows) checkTagsByName(commentNode, parsed, ['throws'], checkThrowsFormat);
      if (checkExampleFence) checkTagsByName(commentNode, parsed, ['example'], checkExampleFormat);
    }

    function checkFirstParagraph(commentNode: AstNode, parsed: ParsedJsdoc, first: string, firstLineIdx: number): void {
      if (!startsCanonically(first, 'capital')) {
        reportRangeMessage(commentNode, parsed, { messageId: 'descriptionMissingCapital', lineIndex: firstLineIdx });
      }
      if (!endsCanonically(first)) {
        reportRangeMessage(commentNode, parsed, { messageId: 'descriptionMissingPeriod', lineIndex: firstLineIdx });
      }
      if (checkTypeRestating && TYPE_RESTATING_PATTERNS.some((re) => re.test(first.trim()))) {
        reportRangeMessage(commentNode, parsed, { messageId: 'descriptionTypeRestating', lineIndex: firstLineIdx });
      }
    }

    function checkParagraphSeparators(commentNode: AstNode, parsed: ParsedJsdoc): void {
      const descLines = parsed.descriptionLines;
      let runStart = -1;
      let firstWasContent = false;

      for (let i = 0; i < descLines.length; i += 1) {
        const isBlank = descLines[i].blank;
        if (!isBlank) firstWasContent = true;

        if (isBlank && firstWasContent) {
          if (runStart === -1) runStart = i;
        } else if (!isBlank && runStart !== -1) {
          const runLength = i - runStart;
          if (runLength !== 1) {
            reportRangeMessage(commentNode, parsed, { messageId: 'descriptionParagraphSeparator', lineIndex: descLines[runStart].index });
          }
          runStart = -1;
        }
      }
    }

    function checkDescriptionBlock(commentNode: AstNode, parsed: ParsedJsdoc): void {
      if (!checkDescription) return;

      const paragraphs = parsed.descriptionParagraphs;
      if (paragraphs.length === 0) return;

      const firstLineIdx = firstDescriptionLineIndex(parsed);
      checkFirstParagraph(commentNode, parsed, paragraphs[0], firstLineIdx);

      if (paragraphs.length > 1) {
        checkParagraphSeparators(commentNode, parsed);
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

      if (indent != null) {
        const model = buildCanonicalModel(parsed);
        applyCanonicalNormalizations({ model, functionNode, workspacePrefixes, forceMultiline: wantsMultiline });
        const newValue = serializeJsdocValue(model, indent, workspacePrefixes);

        if (newValue !== commentNode.value) {
          commentFix = (fixer: AstNode) => fixer.replaceTextRange(commentNode.range, '/*' + newValue + '*/');
        }
      }

      if (checkSingleLine && parsed.singleLine && functionNode && Array.isArray(functionNode.params) && functionNode.params.length > 0) {
        reportRangeMessage(commentNode, parsed, { messageId: 'functionShouldBeMultiline', lineIndex: 0 });
      }

      checkDescriptionBlock(commentNode, parsed);
      checkTags(commentNode, parsed, functionNode);
    }

    function leadingJsdocFor(node: AstNode): Maybe<AstNode> {
      const anchor = getStatementAnchor(node);
      const comments: AstNode[] = sourceCode.getCommentsBefore(anchor) || [];
      let result: Maybe<AstNode> = null;

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

    function leadingJsdocForMethod(node: AstNode): Maybe<AstNode> {
      const comments: AstNode[] = sourceCode.getCommentsBefore(node) || [];
      let result: Maybe<AstNode> = null;

      for (const comment of comments) {
        if (comment.type === 'Block' && typeof comment.value === 'string' && comment.value.startsWith('*')) {
          result = comment;
        }
      }

      return result;
    }

    function isFunctionExpressionInit(init: Maybe<AstNode>): boolean {
      return !!init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression');
    }

    function findLeadingJsdocComment(anchor: AstNode): Maybe<AstNode> {
      const comments: AstNode[] = sourceCode.getCommentsBefore(anchor) || [];
      let jsdoc: Maybe<AstNode> = null;

      for (const comment of comments) {
        if (comment.type === 'Block' && typeof comment.value === 'string' && comment.value.startsWith('*')) {
          jsdoc = comment;
        }
      }

      return jsdoc;
    }

    function visitVariableDeclaration(node: AstNode): void {
      const declarator = node.declarations?.[0];
      if (!declarator) return;
      if (!isFunctionExpressionInit(declarator.init)) return;

      // Anchor for getStatementAnchor expects FunctionDeclaration; emulate for variable declarations.
      const anchor = resolveVariableAnchor(node);
      const jsdoc = findLeadingJsdocComment(anchor);
      if (jsdoc) checkOneJsdoc(jsdoc, anchor);
    }

    return {
      FunctionDeclaration: visitFunctionDeclaration,
      MethodDefinition: visitMethodDefinition,
      VariableDeclaration: visitVariableDeclaration
    };
  }
};

/**
 * Iterates over the tags in a parsed JSDoc and invokes the handler for each tag whose name matches the provided list.
 *
 * @param commentNode - The JSDoc comment AST node.
 * @param parsed - The parsed JSDoc model.
 * @param names - Tag names to match (e.g. `['returns', 'return']`).
 * @param handler - Callback invoked for every matched tag.
 *
 * @example
 * ```ts
 * checkTagsByName(commentNode, parsed, ['returns', 'return'], checkReturnsFormat);
 * ```
 */
function checkTagsByName(commentNode: AstNode, parsed: ParsedJsdoc, names: readonly string[], handler: (commentNode: AstNode, parsed: ParsedJsdoc, tag: ParsedJsdocTag) => void): void {
  for (const tag of parsed.tags) {
    if (names.includes(tag.tag)) {
      handler(commentNode, parsed, tag);
    }
  }
}

/**
 * Returns the line index of the first non-blank line in a JSDoc description.
 *
 * @param parsed - The parsed JSDoc model.
 * @returns The line index of the first non-blank description line, or 0 if all are blank.
 *
 * @example
 * ```ts
 * firstDescriptionLineIndex(parsed); // 1
 * ```
 */
function firstDescriptionLineIndex(parsed: ParsedJsdoc): number {
  let firstLineIdx = 0;
  for (const line of parsed.descriptionLines) {
    if (!line.blank) {
      firstLineIdx = line.index;
      break;
    }
  }
  return firstLineIdx;
}

/**
 * Resolves the anchor node to use for comment lookup, preferring an enclosing export declaration when present.
 *
 * @param node - The variable declaration AST node.
 * @returns The export declaration parent if present, otherwise the node itself.
 *
 * @example
 * ```ts
 * resolveVariableAnchor(variableDeclaration); // parent ExportNamedDeclaration or the node itself
 * ```
 */
function resolveVariableAnchor(node: AstNode): AstNode {
  const parent = node.parent;
  const parentExports = parent && (parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportDefaultDeclaration');
  return parentExports ? parent : node;
}

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
function extractParamName(param: AstNode): Maybe<string> {
  let name: Maybe<string> = null;

  if (param.type === 'Identifier') {
    name = param.name;
  } else if (param.type === 'AssignmentPattern' && param.left?.type === 'Identifier') {
    name = param.left.name;
  } else if (param.type === 'RestElement' && param.argument?.type === 'Identifier') {
    name = param.argument.name;
  } else if (param.type === 'TSParameterProperty' && param.parameter?.type === 'Identifier') {
    name = param.parameter.name;
  }

  // TypeScript's `this` parameter is a type-only declaration, not a documentable positional parameter.
  if (name === 'this') {
    name = null;
  }

  return name;
}
