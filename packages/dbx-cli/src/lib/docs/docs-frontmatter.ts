/**
 * A minimal markdown frontmatter parser for the docs manifest.
 *
 * Handles only what doc frontmatter needs — `key: scalar`, inline lists (`key: [a, b]`) and block lists
 * (`key:` followed by `- item` lines) — so the generator carries no `yaml` dependency. Anything else is
 * reported as a finding instead of being guessed at.
 */

/**
 * One parsed frontmatter value: a scalar string or a list of strings.
 */
export type DocsFrontmatterValue = string | readonly string[];

/**
 * A line the parser could not read, reported with its 1-based line number in the source file.
 */
export interface DocsFrontmatterProblem {
  readonly line: number;
  readonly message: string;
}

/**
 * Result of {@link parseDocsFrontmatter}.
 */
export interface DocsFrontmatterParseResult {
  /**
   * True when the content opened with a `---` frontmatter block.
   */
  readonly hasFrontmatter: boolean;
  readonly values: Readonly<Record<string, DocsFrontmatterValue>>;
  /**
   * The markdown after the frontmatter block (the whole content when there is none).
   */
  readonly body: string;
  readonly problems: readonly DocsFrontmatterProblem[];
}

const FRONTMATTER_DELIMITER = '---';
const BYTE_ORDER_MARK = 0xfeff;
const KEY_LINE_REGEX = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/;
const LIST_ITEM_REGEX = /^\s+-\s*(.*)$/;

/**
 * Parses the leading `---` frontmatter block of a markdown document.
 *
 * @param content - The full markdown file content.
 * @returns The parsed values, the remaining body, and any unreadable lines.
 * @example
 * ```ts
 * parseDocsFrontmatter('---\ntitle: Setup\naudience: [admin]\n---\n# Setup');
 * // values: { title: 'Setup', audience: ['admin'] }
 * ```
 */
export function parseDocsFrontmatter(content: string): DocsFrontmatterParseResult {
  const normalized = content.codePointAt(0) === BYTE_ORDER_MARK ? content.slice(1) : content;
  const lines = normalized.split(/\r?\n/);
  let result: DocsFrontmatterParseResult = { hasFrontmatter: false, values: {}, body: normalized, problems: [] };

  if (lines[0]?.trim() === FRONTMATTER_DELIMITER) {
    const closeIndex = lines.findIndex((line, i) => i > 0 && line.trim() === FRONTMATTER_DELIMITER);

    if (closeIndex === -1) {
      result = { ...result, problems: [{ line: 1, message: 'Frontmatter block is never closed with "---".' }] };
    } else {
      const { values, problems } = parseDocsFrontmatterLines(lines.slice(1, closeIndex));
      result = { hasFrontmatter: true, values, body: lines.slice(closeIndex + 1).join('\n'), problems };
    }
  }

  return result;
}

/**
 * Parses the lines between the frontmatter delimiters. Line numbers in problems are 1-based file lines (the opening
 * delimiter is line 1).
 *
 * @param lines - The frontmatter lines, without the delimiters.
 * @returns The parsed values and any unreadable lines.
 */
function parseDocsFrontmatterLines(lines: readonly string[]): Pick<DocsFrontmatterParseResult, 'values' | 'problems'> {
  const values: Record<string, DocsFrontmatterValue> = {};
  const problems: DocsFrontmatterProblem[] = [];
  let listKey: string | undefined;

  lines.forEach((line, i) => {
    const lineNumber = i + 2;
    const trimmed = line.trim();
    const listItem = LIST_ITEM_REGEX.exec(line);
    const keyLine = KEY_LINE_REGEX.exec(line);

    const isBlankOrComment = trimmed.length === 0 || trimmed.startsWith('#');

    if (isBlankOrComment) {
      return;
    }

    if (listItem != null && listKey != null) {
      const current = values[listKey];
      values[listKey] = [...(Array.isArray(current) ? current : []), unquoteDocsFrontmatterScalar(listItem[1])];
    } else if (keyLine == null) {
      problems.push({ line: lineNumber, message: `Unreadable frontmatter line "${trimmed}". Use "key: value", "key: [a, b]" or a "- item" list.` });
      listKey = undefined;
    } else {
      const [, key, rawValue] = keyLine;
      const valueText = rawValue.trim();
      listKey = undefined;

      if (valueText.length === 0) {
        values[key] = [];
        listKey = key;
      } else if (!valueText.startsWith('[')) {
        values[key] = unquoteDocsFrontmatterScalar(valueText);
      } else if (valueText.endsWith(']')) {
        values[key] = splitDocsFrontmatterInlineList(valueText.slice(1, -1));
      } else {
        problems.push({ line: lineNumber, message: `Inline list for "${key}" is missing its closing "]".` });
      }
    }
  });

  return { values, problems };
}

/**
 * Reads a frontmatter value as a list. A scalar becomes a one-item list; comma-separated scalars are split.
 *
 * @param value - The parsed frontmatter value.
 * @returns The non-empty trimmed items, or `undefined` when the value is unset.
 */
export function readDocsFrontmatterList(value: DocsFrontmatterValue | undefined): string[] | undefined {
  let result: string[] | undefined;

  if (typeof value === 'string') {
    result = splitDocsFrontmatterInlineList(value);
  } else if (value != null) {
    result = value.map((x) => x.trim()).filter((x) => x.length > 0);
  }

  return result;
}

function splitDocsFrontmatterInlineList(text: string): string[] {
  return text
    .split(',')
    .map(unquoteDocsFrontmatterScalar)
    .filter((x) => x.length > 0);
}

function unquoteDocsFrontmatterScalar(text: string): string {
  const trimmed = text.trim();
  const quote = trimmed[0];
  const isQuoted = trimmed.length >= 2 && (quote === '"' || quote === "'") && trimmed.endsWith(quote);
  return isQuoted ? trimmed.slice(1, -1) : trimmed;
}
