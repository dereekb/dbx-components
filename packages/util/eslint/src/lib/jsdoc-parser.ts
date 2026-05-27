import type { Maybe } from '@dereekb/util';
/**
 * Minimal JSDoc parser used by the workspace's custom ESLint rules.
 *
 * Operates on the raw `value` of an ESLint Block comment (the text between `/*` and `*\/`,
 * which includes the leading `*` of a JSDoc opener). Returns a structured view of the comment:
 * description, paragraphs, tags (with their continuation lines), and per-line metadata.
 */

/**
 * Per-line view of a comment body.
 */
export interface ParsedJsdocLine {
  /**
   * Raw line content with leading whitespace + `*` prefix preserved.
   */
  readonly raw: string;
  /**
   * Text content after the leading whitespace + `*` + optional space prefix has been stripped.
   */
  readonly text: string;
  /**
   * True when the line is blank after stripping (only `* ` with nothing else).
   */
  readonly blank: boolean;
  /**
   * Index in the original `splitLines` array.
   */
  readonly index: number;
  /**
   * Character offset of `raw[0]` relative to the start of `commentValue` (not the source file).
   */
  readonly valueOffsetStart: number;
  /**
   * Character offset of `text[0]` relative to the start of `commentValue`. Equals `valueOffsetStart` plus the length of the stripped prefix.
   */
  readonly textOffsetStart: number;
}

/**
 * Parsed view of a single `@tag` block, including any continuation lines that follow it
 * up to the next tag (or end of comment).
 */
export interface ParsedJsdocTag {
  /**
   * Tag name without the leading `@`, e.g. `param`, `returns`, `throws`, `dbxUtil`, `__NO_SIDE_EFFECTS__`.
   */
  readonly tag: string;
  /**
   * For `@param`: the parameter name. For other tags: `undefined`.
   */
  readonly name: Maybe<string>;
  /**
   * For `@throws` / `@param` style: the `{Type}` annotation if present.
   */
  readonly type: Maybe<string>;
  /**
   * Remaining text on the tag line + continuation lines, joined with `\n`. Trimmed of trailing whitespace.
   */
  readonly description: string;
  /**
   * All lines belonging to this tag (the tag line itself and any continuation lines).
   */
  readonly lines: readonly ParsedJsdocLine[];
  /**
   * Index in the comment-lines array where the tag starts.
   */
  readonly startLineIndex: number;
  /**
   * Index (inclusive) where the tag ends.
   */
  readonly endLineIndex: number;
}

/**
 * Parsed view of a whole JSDoc comment.
 */
export interface ParsedJsdoc {
  /**
   * All lines in the comment body.
   */
  readonly lines: readonly ParsedJsdocLine[];
  /**
   * Lines belonging to the description (before any tag).
   */
  readonly descriptionLines: readonly ParsedJsdocLine[];
  /**
   * Description text joined with `\n`, with leading and trailing blank lines stripped.
   */
  readonly description: string;
  /**
   * Description split into paragraphs by blank lines, with each paragraph joined by `\n`.
   */
  readonly descriptionParagraphs: readonly string[];
  /**
   * All tags in source order.
   */
  readonly tags: readonly ParsedJsdocTag[];
  /**
   * True when the original comment is a single-line `/** ... *\/` block (no newlines).
   */
  readonly singleLine: boolean;
}

const TAG_LINE_REGEX = /^@([A-Za-z_]\w*)\s*(.*)$/;
const TYPE_ANNOTATION_REGEX = /^\{([^}]*)\}\s*(.*)$/;
const PARAM_NAME_REGEX = /^([A-Za-z_$][A-Za-z0-9_$.[\]]*)\s*(.*)$/;
const LINE_PREFIX_REGEX = /^(\s*\*?\s?)(.*)$/;

/**
 * Strips the leading whitespace + `*` + optional space prefix from a JSDoc body line and reports the length stripped.
 *
 * @param raw - The raw line as it appears in `comment.value`.
 * @returns A `{ text, prefixLength }` pair.
 *
 * @example
 * ```ts
 * stripPrefix(' * @param x - desc'); // { text: '@param x - desc', prefixLength: 3 }
 * stripPrefix(' *'); // { text: '', prefixLength: 2 }
 * stripPrefix('* hello'); // { text: 'hello', prefixLength: 2 }
 * ```
 */
function stripPrefix(raw: string): { readonly text: string; readonly prefixLength: number } {
  const match = LINE_PREFIX_REGEX.exec(raw);
  const result: { text: string; prefixLength: number } = { text: raw, prefixLength: 0 };

  if (match) {
    result.text = match[2];
    result.prefixLength = match[1].length;
  }

  return result;
}

/**
 * Splits the raw comment value into per-line views with prefix/offset metadata.
 *
 * @param commentValue - The `value` of an ESLint Block comment.
 * @returns Array of parsed line records in source order.
 */
function buildParsedLines(commentValue: string): ParsedJsdocLine[] {
  const rawLines = commentValue.split('\n');
  let runningOffset = 0;
  return rawLines.map((raw, index) => {
    const { text: stripped, prefixLength } = stripPrefix(raw);
    const text = stripped.trimEnd();
    const blank = text.length === 0;
    const valueOffsetStart = runningOffset;
    const textOffsetStart = runningOffset + prefixLength;
    runningOffset += raw.length + 1; // +1 for the consumed `\n` (overshoots on last line, harmless)
    return { raw, text, blank, index, valueOffsetStart, textOffsetStart };
  });
}

/**
 * Computes, per line, whether it sits inside a fenced code block (a ```` ``` ```` block, typically
 * an `@example` body) and therefore must not be treated as a tag boundary. Fence delimiter lines
 * themselves are flagged too. Without this, `@`-prefixed lines inside a fence — decorators like
 * `@Global()` / `@Module()`, or JSDoc snippets — would be mis-parsed as standalone JSDoc tags.
 *
 * @param lines - Parsed lines in source order.
 * @returns Boolean mask where `true` marks a line that must not start a tag.
 */
function computeFenceMask(lines: readonly ParsedJsdocLine[]): boolean[] {
  const mask: boolean[] = lines.map(() => false);
  let fenceOpen = false;

  for (const [i, line] of lines.entries()) {
    const isDelimiter = line.text.trimStart().startsWith('```');

    if (isDelimiter) {
      mask[i] = true;
      fenceOpen = !fenceOpen;
    } else {
      mask[i] = fenceOpen;
    }
  }

  return mask;
}

/**
 * Returns true when the line at `index` opens a JSDoc tag and is not masked out by a code fence.
 *
 * @param lines - Parsed lines in source order.
 * @param fenceMask - Mask from {@link computeFenceMask} marking fenced lines.
 * @param index - Line index to test.
 * @returns True when the line begins a tag that should be treated as a tag boundary.
 */
function isTagStart(lines: readonly ParsedJsdocLine[], fenceMask: readonly boolean[], index: number): boolean {
  return !fenceMask[index] && TAG_LINE_REGEX.test(lines[index].text);
}

/**
 * Returns the index of the first line that begins with a JSDoc `@tag`, or `-1` when none exists.
 *
 * @param lines - Parsed lines in source order.
 * @param fenceMask - Mask from {@link computeFenceMask} marking fenced lines.
 * @returns Zero-based line index of the first tag, or `-1` when no tag is present.
 */
function findFirstTagIndex(lines: readonly ParsedJsdocLine[], fenceMask: readonly boolean[]): number {
  let firstTagIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (isTagStart(lines, fenceMask, i)) {
      firstTagIndex = i;
      break;
    }
  }

  return firstTagIndex;
}

/**
 * Trims leading and trailing blank lines from a contiguous run of description lines.
 *
 * @param descriptionLines - Description-section lines before any tag.
 * @returns Sub-array with surrounding blank lines stripped.
 */
function trimBlankBoundaries(descriptionLines: readonly ParsedJsdocLine[]): readonly ParsedJsdocLine[] {
  let descStart = 0;
  let descEnd = descriptionLines.length;
  while (descStart < descEnd && descriptionLines[descStart].blank) descStart += 1;
  while (descEnd > descStart && descriptionLines[descEnd - 1].blank) descEnd -= 1;
  return descriptionLines.slice(descStart, descEnd);
}

/**
 * Splits the trimmed description lines into paragraphs separated by blank-line runs.
 *
 * @param trimmedDescription - Description lines with surrounding blank lines removed.
 * @returns Paragraph strings joined by `\n`.
 */
function buildDescriptionParagraphs(trimmedDescription: readonly ParsedJsdocLine[]): string[] {
  const descriptionParagraphs: string[] = [];
  let paragraphBuffer: string[] = [];

  for (const line of trimmedDescription) {
    if (line.blank) {
      if (paragraphBuffer.length > 0) {
        descriptionParagraphs.push(paragraphBuffer.join('\n'));
        paragraphBuffer = [];
      }
    } else {
      paragraphBuffer.push(line.text);
    }
  }

  if (paragraphBuffer.length > 0) {
    descriptionParagraphs.push(paragraphBuffer.join('\n'));
  }

  return descriptionParagraphs;
}

/**
 * Pulls an optional `{Type}` annotation off the front of a tag remainder.
 *
 * @param remainder - The tag-line text after the `@tagName` prefix.
 * @returns The annotation (or `undefined`) plus the remaining text.
 */
function extractTypeAnnotation(remainder: string): { readonly type: Maybe<string>; readonly rest: string } {
  let type: Maybe<string>;
  let rest = remainder;
  const typeMatch = TYPE_ANNOTATION_REGEX.exec(remainder);

  if (typeMatch) {
    type = typeMatch[1];
    rest = typeMatch[2];
  }

  return { type, rest };
}

/**
 * Pulls an optional parameter name off the front of a `@param` tag remainder.
 *
 * @param tagName - Tag name (only `'param'` extracts a name; other tags pass through).
 * @param remainder - The tag-line text after the optional `{Type}` annotation.
 * @returns The parameter name (or `undefined`) plus the remaining text.
 */
function extractParamName(tagName: string, remainder: string): { readonly name: Maybe<string>; readonly rest: string } {
  let name: Maybe<string>;
  let rest = remainder;

  if (tagName === 'param') {
    const nameMatch = PARAM_NAME_REGEX.exec(remainder);
    if (nameMatch) {
      name = nameMatch[1];
      rest = nameMatch[2];
    }
  }

  return { name, rest };
}

/**
 * Collects the tag line at `startIndex` plus every following non-tag continuation line.
 *
 * @param lines - All parsed lines in the comment.
 * @param fenceMask - Mask from {@link computeFenceMask} marking fenced lines.
 * @param startIndex - Index of the `@tag` opening line.
 * @returns The collected tag lines and the index of the next unconsumed line.
 */
function collectTagLines(lines: readonly ParsedJsdocLine[], fenceMask: readonly boolean[], startIndex: number): { readonly tagLines: ParsedJsdocLine[]; readonly nextIndex: number } {
  const tagLines: ParsedJsdocLine[] = [lines[startIndex]];
  let j = startIndex + 1;

  while (j < lines.length) {
    if (isTagStart(lines, fenceMask, j)) break;
    tagLines.push(lines[j]);
    j += 1;
  }

  return { tagLines, nextIndex: j };
}

/**
 * Joins the on-line remainder and continuation-line text into a tag description, dropping trailing
 * blank lines while preserving interior blanks.
 *
 * @param remainder - The on-line remainder after stripping `@tagName {Type} name`.
 * @param tagLines - All lines that belong to the tag (including the header line at index 0).
 * @returns Description text joined by `\n`.
 */
function buildTagDescription(remainder: string, tagLines: readonly ParsedJsdocLine[]): string {
  const descriptionParts: string[] = [];

  if (remainder.length > 0) descriptionParts.push(remainder);
  for (let k = 1; k < tagLines.length; k += 1) {
    descriptionParts.push(tagLines[k].text);
  }

  while (descriptionParts.length > 0 && (descriptionParts.at(-1) as string).trim().length === 0) {
    descriptionParts.pop();
  }

  return descriptionParts.join('\n');
}

/**
 * Builds a single parsed-tag record starting at `startIndex` in the line array.
 *
 * @param lines - All parsed lines in the comment.
 * @param fenceMask - Mask from {@link computeFenceMask} marking fenced lines.
 * @param startIndex - Index of the `@tag` opening line.
 * @returns The parsed tag and the next unconsumed line index.
 */
function parseTagAt(lines: readonly ParsedJsdocLine[], fenceMask: readonly boolean[], startIndex: number): { readonly tag: ParsedJsdocTag; readonly nextIndex: number } {
  const line = lines[startIndex];
  const match = TAG_LINE_REGEX.exec(line.text) as RegExpExecArray;
  const tagName = match[1];
  const { type, rest: afterType } = extractTypeAnnotation(match[2]);
  const { name, rest: afterName } = extractParamName(tagName, afterType);
  const { tagLines, nextIndex } = collectTagLines(lines, fenceMask, startIndex);
  const description = buildTagDescription(afterName, tagLines);

  return {
    tag: {
      tag: tagName,
      name,
      type,
      description,
      lines: tagLines,
      startLineIndex: startIndex,
      endLineIndex: nextIndex - 1
    },
    nextIndex
  };
}

/**
 * Parses every `@tag` block starting from `firstTagIndex` to the end of the line array.
 *
 * @param lines - All parsed lines in the comment.
 * @param fenceMask - Mask from {@link computeFenceMask} marking fenced lines.
 * @param firstTagIndex - Index where tag parsing should begin (`-1` skips entirely).
 * @returns All parsed tags in source order.
 */
function parseTags(lines: readonly ParsedJsdocLine[], fenceMask: readonly boolean[], firstTagIndex: number): ParsedJsdocTag[] {
  const tags: ParsedJsdocTag[] = [];

  if (firstTagIndex !== -1) {
    let i = firstTagIndex;
    while (i < lines.length) {
      if (!isTagStart(lines, fenceMask, i)) {
        i += 1;
        continue;
      }
      const { tag, nextIndex } = parseTagAt(lines, fenceMask, i);
      tags.push(tag);
      i = nextIndex;
    }
  }

  return tags;
}

/**
 * Parses the value of an ESLint Block comment that represents a JSDoc into a structured form.
 *
 * @param commentValue - The `value` of an ESLint Block comment (text between `/*` and `*\/`, including the leading `*`).
 * @returns A structured view of the JSDoc with description, paragraphs, and tags.
 *
 * @example
 * ```ts
 * const parsed = parseJsdocComment('*\n * Hello.\n *\n * @param x - The value.\n ');
 * // parsed.description === 'Hello.'
 * // parsed.tags[0].tag === 'param'
 * // parsed.tags[0].name === 'x'
 * // parsed.tags[0].description === 'The value.'
 * ```
 */
export function parseJsdocComment(commentValue: string): ParsedJsdoc {
  const singleLine = !commentValue.includes('\n');
  const lines = buildParsedLines(commentValue);
  const fenceMask = computeFenceMask(lines);
  const firstTagIndex = findFirstTagIndex(lines, fenceMask);
  const descriptionLines = firstTagIndex === -1 ? lines.slice() : lines.slice(0, firstTagIndex);
  const trimmedDescription = trimBlankBoundaries(descriptionLines);
  const description = trimmedDescription.map((l) => l.text).join('\n');
  const descriptionParagraphs = buildDescriptionParagraphs(trimmedDescription);
  const tags = parseTags(lines, fenceMask, firstTagIndex);

  return {
    lines,
    descriptionLines,
    description,
    descriptionParagraphs,
    tags,
    singleLine
  };
}
