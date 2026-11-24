/**
 * A markdown frontmatter reader: the leading `---` … `---` block, read as a small, dependency-free subset of YAML.
 *
 * - `key: scalar`, where a scalar is a bare word, a double-quoted JSON string, or a single-quoted YAML string (`''` is
 *   one `'`). Bare `true` / `false` and plain decimal numbers are typed unless `typedScalars` is `false`.
 * - `key: [flow, list]` of scalars.
 * - `key:` alone opens ONE level of block: indented `- item` rows make a list of scalars, indented `key: value` rows
 *   make a map. With nothing under it the key reads as `null`.
 * - `# comments`, on their own line or after a value (a bare value's comment starts at ` #`). A BOM is dropped, and
 *   `\r\n` and lone `\r` line endings become `\n`.
 *
 * Every refusal names its 1-based file line, and a refused row is left out of the values.
 */

import { type Maybe } from '../value/maybe.type';
import { scanJsonStringLiteral } from './json';

/**
 * One frontmatter scalar: a string, or a typed `true` / `false` / number.
 */
export type MarkdownFrontmatterScalar = string | number | boolean;

/**
 * A frontmatter list, written `[a, b]` or as indented `- item` rows.
 */
export type MarkdownFrontmatterList = ReadonlyArray<MarkdownFrontmatterScalar>;

/**
 * A frontmatter scalar or list.
 */
export type MarkdownFrontmatterLeaf = MarkdownFrontmatterScalar | MarkdownFrontmatterList;

/**
 * A one-level map of indented `key: value` rows.
 */
export type MarkdownFrontmatterMap = Readonly<Record<string, MarkdownFrontmatterLeaf>>;

/**
 * One frontmatter value. `null` is a block-opening `key:` with no indented rows under it (YAML's null); the reader
 * never stores `undefined`.
 */
export type MarkdownFrontmatterValue = Maybe<MarkdownFrontmatterLeaf | MarkdownFrontmatterMap>;

/**
 * One row the reader refused, with its 1-based file line.
 */
export interface MarkdownFrontmatterProblem {
  readonly line: number;
  readonly message: string;
}

/**
 * The result of {@link splitMarkdownFrontmatter}.
 */
export interface MarkdownFrontmatterSplit {
  /**
   * Whether the text opens with a `---` line that a later `---` line closes.
   */
  readonly hasFrontmatter: boolean;
  /**
   * Whether the text opens with a `---` line that is never closed.
   */
  readonly unclosed: boolean;
  /**
   * The lines between the fences. Line `i` is file line `i + 2`. Empty unless `hasFrontmatter`.
   */
  readonly frontmatterLines: ReadonlyArray<string>;
  /**
   * The text after the closing fence, else the whole text. The BOM is dropped and line endings are `\n`.
   */
  readonly body: string;
}

/**
 * The result of {@link parseMarkdownFrontmatter}.
 */
export interface MarkdownFrontmatter extends Omit<MarkdownFrontmatterSplit, 'frontmatterLines'> {
  /**
   * The values by key, in row order. A refused row is left out.
   */
  readonly values: Readonly<Record<string, MarkdownFrontmatterValue>>;
  /**
   * The 1-based file line of each read key. A nested map row is keyed `parent.child`.
   */
  readonly lines: ReadonlyMap<string, number>;
  /**
   * Every refused row, in line order.
   */
  readonly problems: ReadonlyArray<MarkdownFrontmatterProblem>;
}

/**
 * The config of {@link parseMarkdownFrontmatter}.
 */
export interface ParseMarkdownFrontmatterConfig {
  /**
   * Whether a bare `true` / `false` reads as a boolean and a bare `-?digits(.digits)?` as a number. Defaults to `true`.
   * When `false`, every scalar is a string.
   */
  readonly typedScalars?: Maybe<boolean>;
}

/**
 * The fence line that opens and closes the block (compared after trimming).
 */
const MARKDOWN_FRONTMATTER_FENCE = '---';

/**
 * The byte-order mark a file may open with.
 */
const MARKDOWN_FRONTMATTER_BYTE_ORDER_MARK = String.fromCodePoint(0xfeff);

/**
 * A `key: value` row (on the trimmed line).
 */
const MARKDOWN_FRONTMATTER_KEY_PATTERN = /^([A-Za-z][\w-]*)[ \t]*:(.*)$/;

/**
 * A `- item` row (on the trimmed line).
 */
const MARKDOWN_FRONTMATTER_LIST_ITEM_PATTERN = /^-(?:\s+(.*))?$/;

/**
 * A bare number that reads as a number.
 */
const MARKDOWN_FRONTMATTER_NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * The message for text after a quoted value or a flow list.
 */
const MARKDOWN_FRONTMATTER_TRAILING_TEXT_MESSAGE = 'unexpected text after the value (quote a value that holds `"` or `[`)';

/**
 * A value read from the start of some text, with the text after it, or a refusal message.
 */
type MarkdownFrontmatterRead<T> = { readonly value: T; readonly rest: string } | { readonly error: string };

/**
 * A value, or a refusal message.
 */
type MarkdownFrontmatterResult<T> = { readonly value: T } | { readonly error: string };

/**
 * Splits a markdown text into its leading `---` frontmatter lines and its body.
 *
 * The first line must be the opening fence and a later line the closing fence; each is `---` once trimmed. A BOM is
 * dropped and `\r\n` / `\r` line endings become `\n`, in the body too. An unclosed block leaves the whole text as the body.
 *
 * @param text - The whole markdown text.
 * @returns The frontmatter lines and the body.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags markdown, frontmatter, split, fence, body, yaml, docs
 * @dbxUtilRelated parse-markdown-frontmatter
 *
 * @example
 * ```ts
 * splitMarkdownFrontmatter('---\ntitle: Setup\n---\n# Setup');
 * // { hasFrontmatter: true, unclosed: false, frontmatterLines: ['title: Setup'], body: '# Setup' }
 * splitMarkdownFrontmatter('# Setup'); // { hasFrontmatter: false, unclosed: false, frontmatterLines: [], body: '# Setup' }
 * ```
 */
export function splitMarkdownFrontmatter(text: string): MarkdownFrontmatterSplit {
  const normalized = (text.startsWith(MARKDOWN_FRONTMATTER_BYTE_ORDER_MARK) ? text.slice(1) : text).replaceAll(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  let result: MarkdownFrontmatterSplit = { hasFrontmatter: false, unclosed: false, frontmatterLines: [], body: normalized };

  if (lines[0].trim() === MARKDOWN_FRONTMATTER_FENCE) {
    const close = lines.findIndex((line, index) => index > 0 && line.trim() === MARKDOWN_FRONTMATTER_FENCE);

    if (close < 0) {
      result = { ...result, unclosed: true };
    } else {
      result = { hasFrontmatter: true, unclosed: false, frontmatterLines: lines.slice(1, close), body: lines.slice(close + 1).join('\n') };
    }
  }

  return result;
}

/**
 * Reads one bare scalar.
 *
 * @param bare - The trimmed bare text.
 * @param typedScalars - Whether `true` / `false` and numbers are typed.
 * @returns The scalar.
 */
function markdownFrontmatterBareScalar(bare: string, typedScalars: boolean): MarkdownFrontmatterScalar {
  let value: MarkdownFrontmatterScalar = bare;

  if (typedScalars) {
    if (bare === 'true' || bare === 'false') {
      value = bare === 'true';
    } else if (MARKDOWN_FRONTMATTER_NUMBER_PATTERN.test(bare)) {
      value = Number(bare);
    }
  }

  return value;
}

/**
 * Reads one double-quoted JSON string at the start of `raw`.
 *
 * @param raw - The text, opening with `"`.
 * @returns The string and the text after it, or a refusal message.
 */
function readMarkdownFrontmatterDoubleQuoted(raw: string): MarkdownFrontmatterRead<string> {
  const scan = scanJsonStringLiteral({ text: raw, start: 0 });
  const end = scan.closed ? scan.end - 1 : -1;
  let result: MarkdownFrontmatterRead<string>;

  if (end < 0) {
    result = { error: 'an unterminated quoted string' };
  } else {
    try {
      result = { value: JSON.parse(raw.slice(0, end + 1)) as string, rest: raw.slice(end + 1) };
    } catch {
      result = { error: 'a quoted string that is not valid JSON' };
    }
  }

  return result;
}

/**
 * Reads one single-quoted YAML string at the start of `raw`, where `''` stands for one `'`.
 *
 * @param raw - The text, opening with `'`.
 * @returns The string and the text after it, or a refusal message.
 */
function readMarkdownFrontmatterSingleQuoted(raw: string): MarkdownFrontmatterRead<string> {
  let index = 1;
  let end = -1;

  while (index < raw.length && end < 0) {
    if (raw[index] !== "'") {
      index += 1;
    } else if (raw[index + 1] === "'") {
      index += 2;
    } else {
      end = index;
    }
  }

  return end < 0 ? { error: 'an unterminated quoted string' } : { value: raw.slice(1, end).replaceAll("''", "'"), rest: raw.slice(end + 1) };
}

/**
 * Reads one quoted string at the start of `raw`, double- or single-quoted.
 *
 * @param raw - The text, opening with `"` or `'`.
 * @returns The string and the text after it, or a refusal message.
 */
function readMarkdownFrontmatterQuoted(raw: string): MarkdownFrontmatterRead<string> {
  return raw.startsWith('"') ? readMarkdownFrontmatterDoubleQuoted(raw) : readMarkdownFrontmatterSingleQuoted(raw);
}

/**
 * Whether `char` opens a quoted string.
 *
 * @param char - The character.
 * @returns Whether it is `"` or `'`.
 */
function isMarkdownFrontmatterQuote(char: Maybe<string>): boolean {
  return char === '"' || char === "'";
}

/**
 * The config of the flow-list readers.
 */
interface MarkdownFrontmatterFlowListConfig {
  readonly raw: string;
  readonly typedScalars: boolean;
}

/**
 * Reads one flow-list item at `index`: a quoted string or a bare scalar.
 *
 * @param config - The list text and the scalar typing.
 * @param index - The item's first index.
 * @returns The item and the index after it, or a refusal message.
 */
function readMarkdownFrontmatterFlowListItem(config: MarkdownFrontmatterFlowListConfig, index: number): { readonly item: MarkdownFrontmatterScalar; readonly next: number } | { readonly error: string } {
  const { raw, typedScalars } = config;
  let result: { readonly item: MarkdownFrontmatterScalar; readonly next: number } | { readonly error: string };

  if (isMarkdownFrontmatterQuote(raw[index])) {
    const quoted = readMarkdownFrontmatterQuoted(raw.slice(index));
    result = 'error' in quoted ? quoted : { item: quoted.value, next: raw.length - quoted.rest.length };
  } else {
    const stop = raw.slice(index).search(/[,\]]/);
    const bare = stop < 0 ? '' : raw.slice(index, index + stop).trim();

    if (stop < 0) {
      result = { error: 'an unclosed `[` list' };
    } else if (bare === '') {
      result = { error: 'an empty list item' };
    } else {
      result = { item: markdownFrontmatterBareScalar(bare, typedScalars), next: index + stop };
    }
  }

  return result;
}

/**
 * Reads a flow list `[a, "b", 'c', 3]`.
 *
 * @param config - The list text (opening with `[`) and the scalar typing.
 * @returns The items and the text after the list, or a refusal message.
 */
function readMarkdownFrontmatterFlowList(config: MarkdownFrontmatterFlowListConfig): MarkdownFrontmatterRead<MarkdownFrontmatterList> {
  const { raw } = config;
  const items: MarkdownFrontmatterScalar[] = [];
  let index = 1;
  let result: Maybe<MarkdownFrontmatterRead<MarkdownFrontmatterList>>;

  while (result == null) {
    while (raw[index] === ' ') {
      index += 1;
    }

    if (index >= raw.length) {
      result = { error: 'an unclosed `[` list' };
    } else if (raw[index] === ']' && items.length === 0) {
      result = { value: items, rest: raw.slice(index + 1) };
    } else {
      const read = readMarkdownFrontmatterFlowListItem(config, index);

      if ('error' in read) {
        result = read;
      } else {
        items.push(read.item);
        index = read.next;

        while (raw[index] === ' ') {
          index += 1;
        }

        if (raw[index] === ',') {
          index += 1;
        } else if (raw[index] === ']') {
          result = { value: items, rest: raw.slice(index + 1) };
        } else {
          result = { error: 'a list item followed by something other than `,` or `]`' };
        }
      }
    }
  }

  return result;
}

/**
 * Accepts a read value only when nothing but a `#` comment follows it.
 *
 * @param read - The read value and the text after it.
 * @returns The value, or a refusal message.
 */
function closedMarkdownFrontmatterValue<T>(read: MarkdownFrontmatterRead<T>): MarkdownFrontmatterResult<T> {
  let result: MarkdownFrontmatterResult<T>;

  if ('error' in read) {
    result = read;
  } else {
    const trailing = read.rest.trim();
    result = trailing === '' || trailing.startsWith('#') ? { value: read.value } : { error: MARKDOWN_FRONTMATTER_TRAILING_TEXT_MESSAGE };
  }

  return result;
}

/**
 * Reads one scalar: a quoted string, or a bare scalar with a trailing ` # comment` dropped.
 *
 * @param raw - The trimmed, non-empty text.
 * @param typedScalars - Whether bare scalars are typed.
 * @returns The scalar, or a refusal message.
 */
function readMarkdownFrontmatterScalar(raw: string, typedScalars: boolean): MarkdownFrontmatterResult<MarkdownFrontmatterScalar> {
  let result: MarkdownFrontmatterResult<MarkdownFrontmatterScalar>;

  if (isMarkdownFrontmatterQuote(raw[0])) {
    result = closedMarkdownFrontmatterValue(readMarkdownFrontmatterQuoted(raw));
  } else {
    const comment = raw.search(/\s#/);
    result = { value: markdownFrontmatterBareScalar((comment < 0 ? raw : raw.slice(0, comment)).trim(), typedScalars) };
  }

  return result;
}

/**
 * Reads one row value: a flow list or a scalar.
 *
 * @param raw - The trimmed, non-empty text after `key:`.
 * @param typedScalars - Whether bare scalars are typed.
 * @returns The value, or a refusal message.
 */
function readMarkdownFrontmatterLeaf(raw: string, typedScalars: boolean): MarkdownFrontmatterResult<MarkdownFrontmatterLeaf> {
  return raw.startsWith('[') ? closedMarkdownFrontmatterValue(readMarkdownFrontmatterFlowList({ raw, typedScalars })) : readMarkdownFrontmatterScalar(raw, typedScalars);
}

/**
 * Whether a row's raw value is empty or only a comment.
 *
 * @param raw - The trimmed text after `key:`.
 * @returns Whether no value is given.
 */
function isMarkdownFrontmatterValueAbsent(raw: string): boolean {
  return raw === '' || raw.startsWith('#');
}

/**
 * What the rows are read into.
 */
interface MarkdownFrontmatterAccumulator {
  readonly values: Record<string, MarkdownFrontmatterValue>;
  readonly lines: Map<string, number>;
  readonly problems: MarkdownFrontmatterProblem[];
  readonly typedScalars: boolean;
}

/**
 * The block a bare `key:` opened. Its first indented row decides whether it is a list or a map.
 */
interface MarkdownFrontmatterBlock {
  readonly key: string;
  readonly kind: Maybe<'list' | 'map'>;
  readonly list: MarkdownFrontmatterScalar[];
  readonly map: Record<string, MarkdownFrontmatterLeaf>;
}

/**
 * One `key: value` row.
 */
interface MarkdownFrontmatterRow {
  readonly key: string;
  readonly raw: string;
  readonly lineNo: number;
}

/**
 * Decides an open block's kind on its first indented row, storing the list or map as the key's value.
 *
 * @param acc - The accumulator.
 * @param block - The open block.
 * @param kind - The kind its row asks for.
 * @returns The block with its kind decided.
 */
function decideMarkdownFrontmatterBlock(acc: MarkdownFrontmatterAccumulator, block: MarkdownFrontmatterBlock, kind: 'list' | 'map'): MarkdownFrontmatterBlock {
  let result = block;

  if (block.kind == null) {
    acc.values[block.key] = kind === 'list' ? block.list : block.map;
    result = { ...block, kind };
  }

  return result;
}

/**
 * The problem for a block that mixes `- item` and `key: value` rows.
 *
 * @param block - The open block.
 * @param lineNo - The offending row's line.
 * @returns The problem.
 */
function mixedMarkdownFrontmatterBlockProblem(block: MarkdownFrontmatterBlock, lineNo: number): MarkdownFrontmatterProblem {
  return { line: lineNo, message: `\`${block.key}\` mixes \`- item\` rows and \`key: value\` rows` };
}

/**
 * Reads one indented `- item` row into the block above it.
 *
 * @param acc - The accumulator.
 * @param block - The open block, if any.
 * @param row - The item's text (after `- `) and its line.
 * @returns The open block after the row.
 */
function readMarkdownFrontmatterListItemRow(acc: MarkdownFrontmatterAccumulator, block: Maybe<MarkdownFrontmatterBlock>, row: Omit<MarkdownFrontmatterRow, 'key'>): Maybe<MarkdownFrontmatterBlock> {
  const { raw, lineNo } = row;
  let result = block;

  if (block == null) {
    acc.problems.push({ line: lineNo, message: 'a `- item` row is indented, but no key above it opens a list' });
  } else if (block.kind === 'map') {
    acc.problems.push(mixedMarkdownFrontmatterBlockProblem(block, lineNo));
  } else {
    result = decideMarkdownFrontmatterBlock(acc, block, 'list');
    let read: MarkdownFrontmatterResult<MarkdownFrontmatterScalar>;

    if (isMarkdownFrontmatterValueAbsent(raw)) {
      read = { error: 'an empty list item' };
    } else if (raw.startsWith('[')) {
      read = { error: 'a `- item` holds a `[` list (list items are scalars)' };
    } else {
      read = readMarkdownFrontmatterScalar(raw, acc.typedScalars);
    }

    if ('error' in read) {
      acc.problems.push({ line: lineNo, message: `\`${block.key}\`: ${read.error}` });
    } else {
      result.list.push(read.value);
    }
  }

  return result;
}

/**
 * Reads one indented `key: value` row into the block above it.
 *
 * @param acc - The accumulator.
 * @param block - The open block, if any.
 * @param row - The row.
 * @returns The open block after the row.
 */
function readMarkdownFrontmatterMapRow(acc: MarkdownFrontmatterAccumulator, block: Maybe<MarkdownFrontmatterBlock>, row: MarkdownFrontmatterRow): Maybe<MarkdownFrontmatterBlock> {
  const { key, raw, lineNo } = row;
  let result = block;

  if (block == null) {
    acc.problems.push({ line: lineNo, message: `\`${key}\` is indented, but no key above it opens a map` });
  } else if (block.kind === 'list') {
    acc.problems.push(mixedMarkdownFrontmatterBlockProblem(block, lineNo));
  } else {
    result = decideMarkdownFrontmatterBlock(acc, block, 'map');
    const path = `${block.key}.${key}`;

    if (isMarkdownFrontmatterValueAbsent(raw)) {
      acc.problems.push({ line: lineNo, message: `\`${path}\` has no value (only one level of nesting)` });
    } else if (Object.hasOwn(result.map, key)) {
      acc.problems.push({ line: lineNo, message: `\`${path}\` is set twice` });
    } else {
      const read = readMarkdownFrontmatterLeaf(raw, acc.typedScalars);

      if ('error' in read) {
        acc.problems.push({ line: lineNo, message: `\`${path}\`: ${read.error}` });
      } else {
        result.map[key] = read.value;
        acc.lines.set(path, lineNo);
      }
    }
  }

  return result;
}

/**
 * Reads one top-level `key: value` row. Any open block closes.
 *
 * @param acc - The accumulator.
 * @param row - The row.
 * @returns The block it opened (a bare `key:`), else `undefined`.
 */
function readMarkdownFrontmatterTopLevelRow(acc: MarkdownFrontmatterAccumulator, row: MarkdownFrontmatterRow): Maybe<MarkdownFrontmatterBlock> {
  const { key, raw, lineNo } = row;
  let block: Maybe<MarkdownFrontmatterBlock>;

  if (Object.hasOwn(acc.values, key)) {
    acc.problems.push({ line: lineNo, message: `\`${key}\` is set twice` });
  } else if (isMarkdownFrontmatterValueAbsent(raw)) {
    acc.values[key] = null;
    acc.lines.set(key, lineNo);
    block = { key, kind: undefined, list: [], map: {} };
  } else {
    const read = readMarkdownFrontmatterLeaf(raw, acc.typedScalars);

    if ('error' in read) {
      acc.problems.push({ line: lineNo, message: `\`${key}\`: ${read.error}` });
    } else {
      acc.values[key] = read.value;
      acc.lines.set(key, lineNo);
    }
  }

  return block;
}

/**
 * Reads the frontmatter rows into the accumulator.
 *
 * @param acc - The accumulator.
 * @param frontmatterLines - The lines between the fences (line `i` is file line `i + 2`).
 */
function readMarkdownFrontmatterRows(acc: MarkdownFrontmatterAccumulator, frontmatterLines: ReadonlyArray<string>): void {
  let block: Maybe<MarkdownFrontmatterBlock>;

  frontmatterLines.forEach((line, index) => {
    const lineNo = index + 2;
    const trimmed = line.trim();

    if (trimmed !== '' && !trimmed.startsWith('#')) {
      const indent = line.length - line.trimStart().length;
      const listItem = indent > 0 ? MARKDOWN_FRONTMATTER_LIST_ITEM_PATTERN.exec(trimmed) : null;
      const keyRow = MARKDOWN_FRONTMATTER_KEY_PATTERN.exec(trimmed);

      if (/^\s*\t/.test(line)) {
        acc.problems.push({ line: lineNo, message: 'indent with spaces, not tabs' });
      } else if (listItem != null) {
        block = readMarkdownFrontmatterListItemRow(acc, block, { raw: listItem[1] ?? '', lineNo });
      } else if (keyRow == null) {
        acc.problems.push({ line: lineNo, message: 'expected `key: value`' });
      } else {
        const row: MarkdownFrontmatterRow = { key: keyRow[1], raw: keyRow[2].trim(), lineNo };
        block = indent > 0 ? readMarkdownFrontmatterMapRow(acc, block, row) : readMarkdownFrontmatterTopLevelRow(acc, row);
      }
    }
  });
}

/**
 * Parses the leading `---` frontmatter block of a markdown text.
 *
 * The grammar is a small YAML subset: `key: scalar` (bare, double-quoted JSON, or single-quoted with `''` for `'`),
 * `key: [flow, list]`, and a bare `key:` opening one level of indented `- item` rows (a list) or `key: value` rows (a
 * map), with `#` comments. No problem is reported for a text with no opening fence. An unclosed block reports one
 * problem at line 1 and leaves the whole text as the body. Each refused row is reported at its line and left out of the
 * values: a malformed row, tab indentation, a duplicate key (the first is kept), an indented row with no block above
 * it, a block mixing list and map rows, an empty list item, and an unterminated quote or list.
 *
 * @param text - The whole markdown text.
 * @param config - Whether bare scalars are typed (default `true`).
 * @returns The values, their lines, the body and every problem.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags markdown, frontmatter, parse, yaml, metadata, docs, note
 * @dbxUtilRelated split-markdown-frontmatter, scan-json-string-literal
 *
 * @example
 * ```ts
 * const parsed = parseMarkdownFrontmatter([
 *   '---',
 *   'id: apparel-plain',
 *   'title: Plain apparel pages',
 *   'sites: [product-page]',
 *   'where:',
 *   '  category: [apparel]',
 *   'ask: "`brief` describes a garment with no logo."',
 *   'tags:',
 *   '  - apparel',
 *   "  - 'plain cut'",
 *   '---',
 *   'Name the garment and the colour.'
 * ].join('\n'));
 * // parsed.values: { id: 'apparel-plain', title: 'Plain apparel pages', sites: ['product-page'],
 * //   where: { category: ['apparel'] }, ask: '`brief` describes a garment with no logo.', tags: ['apparel', 'plain cut'] }
 * // parsed.lines.get('where.category'): 6
 * // parsed.body: 'Name the garment and the colour.'
 * ```
 */
export function parseMarkdownFrontmatter(text: string, config?: Maybe<ParseMarkdownFrontmatterConfig>): MarkdownFrontmatter {
  const { frontmatterLines, ...split } = splitMarkdownFrontmatter(text);
  const acc: MarkdownFrontmatterAccumulator = { values: {}, lines: new Map<string, number>(), problems: [], typedScalars: config?.typedScalars !== false };

  if (split.unclosed) {
    acc.problems.push({ line: 1, message: 'the frontmatter is never closed with a `---` line' });
  } else {
    readMarkdownFrontmatterRows(acc, frontmatterLines);
  }

  return { ...split, values: acc.values, lines: acc.lines, problems: acc.problems };
}
