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
  readonly name: string | undefined;
  /**
   * For `@throws` / `@param` style: the `{Type}` annotation if present.
   */
  readonly type: string | undefined;
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

const TAG_LINE_REGEX = /^@([A-Za-z_][A-Za-z0-9_]*)\s*(.*)$/;

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
  const match = raw.match(/^(\s*\*?\s?)(.*)$/);
  const result: { text: string; prefixLength: number } = { text: raw, prefixLength: 0 };

  if (match) {
    result.text = match[2];
    result.prefixLength = match[1].length;
  }

  return result;
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
  const rawLines = commentValue.split('\n');

  // For single-line JSDocs, the value is `* description` (the leading `*` belongs to the opener).
  // Treat the whole thing as one "line" of description after stripping.
  let runningOffset = 0;
  const lines: ParsedJsdocLine[] = rawLines.map((raw, index) => {
    const { text: stripped, prefixLength } = stripPrefix(raw);
    const text = stripped.trimEnd();
    const blank = text.length === 0;
    const valueOffsetStart = runningOffset;
    const textOffsetStart = runningOffset + prefixLength;
    runningOffset += raw.length + 1; // +1 for the consumed `\n` (overshoots on last line, harmless)
    return { raw, text, blank, index, valueOffsetStart, textOffsetStart };
  });

  // Locate the first tag line.
  let firstTagIndex = -1;
  for (const [i, line] of lines.entries()) {
    if (TAG_LINE_REGEX.test(line.text)) {
      firstTagIndex = i;
      break;
    }
  }

  const descriptionLines = firstTagIndex === -1 ? lines.slice() : lines.slice(0, firstTagIndex);

  // Strip leading and trailing blank lines from the description for the joined string.
  let descStart = 0;
  let descEnd = descriptionLines.length;
  while (descStart < descEnd && descriptionLines[descStart].blank) descStart += 1;
  while (descEnd > descStart && descriptionLines[descEnd - 1].blank) descEnd -= 1;
  const trimmedDescription = descriptionLines.slice(descStart, descEnd);
  const description = trimmedDescription.map((l) => l.text).join('\n');

  // Split description into paragraphs by blank-line runs.
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

  // Parse tags. Each tag begins on a line matching TAG_LINE_REGEX; subsequent non-tag lines
  // (including blanks) belong to that tag until the next tag line or end of comment.
  const tags: ParsedJsdocTag[] = [];
  if (firstTagIndex !== -1) {
    let i = firstTagIndex;
    while (i < lines.length) {
      const line = lines[i];
      const match = line.text.match(TAG_LINE_REGEX);
      if (!match) {
        i += 1;
        continue;
      }

      const tagName = match[1];
      let remainder = match[2];

      // Pull off an optional `{Type}` annotation immediately after the tag name (for @throws, @param, etc.).
      let typeAnnotation: string | undefined;
      const typeMatch = remainder.match(/^\{([^}]*)\}\s*(.*)$/);
      if (typeMatch) {
        typeAnnotation = typeMatch[1];
        remainder = typeMatch[2];
      }

      // For @param: pull off the parameter name (first word).
      let nameAnnotation: string | undefined;
      if (tagName === 'param') {
        const nameMatch = remainder.match(/^([A-Za-z_$][A-Za-z0-9_$.[\]]*)\s*(.*)$/);
        if (nameMatch) {
          nameAnnotation = nameMatch[1];
          remainder = nameMatch[2];
        }
      }

      // Collect continuation lines: from i+1 until next tag line or end of comment.
      const tagLines: ParsedJsdocLine[] = [line];
      let j = i + 1;
      while (j < lines.length) {
        if (TAG_LINE_REGEX.test(lines[j].text)) break;
        tagLines.push(lines[j]);
        j += 1;
      }

      // Build the description string: the remainder of the tag line + any continuation line text.
      const descriptionParts: string[] = [];
      if (remainder.length > 0) descriptionParts.push(remainder);
      for (let k = 1; k < tagLines.length; k += 1) {
        descriptionParts.push(tagLines[k].text);
      }
      // Trim trailing blank lines from the tag's collected text but preserve interior blanks (matter for @example fenced blocks).
      while (descriptionParts.length > 0 && descriptionParts[descriptionParts.length - 1].trim().length === 0) {
        descriptionParts.pop();
      }

      tags.push({
        tag: tagName,
        name: nameAnnotation,
        type: typeAnnotation,
        description: descriptionParts.join('\n'),
        lines: tagLines,
        startLineIndex: i,
        endLineIndex: j - 1
      });

      i = j;
    }
  }

  return {
    lines,
    descriptionLines,
    description,
    descriptionParagraphs,
    tags,
    singleLine
  };
}
