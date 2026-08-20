/**
 * Plain-text table and indentation helpers shared by the CLI's human-readable
 * renderers (`model-info`, `firestore-queries`, ...).
 *
 * These started life private to `manifest/model-info-utils.ts`; every catalog
 * command renders the same column-aligned shape, so they live here once.
 */

/**
 * Renders rows as a column-aligned, two-space-separated table.
 *
 * Every column except the last is padded to the widest cell in that column,
 * and trailing whitespace is stripped from each line.
 *
 * @param rows - The rows to render, each an ordered list of cell texts.
 * @returns The formatted table with no trailing newline, or `''` when empty.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderTable(rows: readonly (readonly string[])[]): string {
  let result: string;
  if (rows.length === 0) {
    result = '';
  } else {
    const widths: number[] = [];
    for (const row of rows) {
      row.forEach((cell, i) => {
        const cellWidth = cell.length;
        widths[i] = Math.max(widths[i] ?? 0, cellWidth);
      });
    }
    result = rows
      .map((row) =>
        row
          .map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i] ?? 0)))
          .join('  ')
          .replace(/\s+$/, '')
      )
      .join('\n');
  }
  return result;
}

/**
 * Truncates `text` to at most `max` characters, replacing the final character
 * with an ellipsis when a cut is made.
 *
 * @param text - The text to truncate.
 * @param max - The maximum length of the result.
 * @returns The original text, or a truncated copy ending in `…`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

/**
 * Indents every non-empty line of `text` by `indent` spaces.
 *
 * @param text - The text to indent.
 * @param indent - The number of spaces to prefix. Values `<= 0` are a no-op.
 * @returns The indented text.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function indentLines(text: string, indent: number): string {
  let result: string;
  if (indent <= 0) {
    result = text;
  } else {
    const pad = ' '.repeat(indent);
    result = text
      .split('\n')
      .map((line) => (line.length > 0 ? pad + line : line))
      .join('\n');
  }
  return result;
}
