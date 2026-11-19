/**
 * The craft-note PARSER — a markdown file with a small frontmatter block, read into an {@link LlmCraftNote}. Pure, and
 * deliberately a SUBSET of YAML (a note needs no more, and the library carries no YAML dependency):
 *
 * - `key: scalar` — a bare word, a JSON-quoted string, `true` / `false`, or a number;
 * - `key: [flow, list]` — of scalars;
 * - ONE level of nesting — a key with no value opens a map of indented `key: value` rows (`where`);
 * - `# comments`, whole-line or after a value; CRLF and a leading BOM are normalized.
 *
 * Every refusal names its 1-based file line. The shape is then validated by an arktype schema that rejects an
 * unknown key, and the cross-field rules (sites, `where` facts, the `ask` inputs, the body budget) are checked last,
 * against the host's site registry.
 */

import { compareStrings, isNotBlankString, type Maybe } from '@dereekb/util';
import { type } from 'arktype';
import { type LlmPromptSiteFactValue } from '../prompt/llm.prompt.site';
import { type LlmCraftNoteTier } from './llm.craft.identity';
import { DEFAULT_LLM_CRAFT_JUDGE_FLOOR, DEFAULT_LLM_CRAFT_NOTE_PRIORITY, LLM_CRAFT_NOTE_ID_PATTERN, LLM_CRAFT_NOTE_MAX_PRIORITY, type LlmCraftNote, type LlmCraftNoteWhere } from './llm.craft.note';
import { llmCraftAskInputsOf, llmCraftSiteFactShapeOf, type LlmCraftSite, type LlmCraftSiteRegistry } from './llm.craft.site';

/**
 * One refusal — its message and, when it has one, the 1-based file line.
 */
export interface LlmCraftNoteParseError {
  readonly line?: number;
  readonly message: string;
}

/**
 * A parse's answer: the note, or every refusal.
 */
export type LlmCraftNoteParseResult = { readonly note: LlmCraftNote; readonly errors?: undefined } | { readonly note?: undefined; readonly errors: ReadonlyArray<LlmCraftNoteParseError> };

/**
 * Input to {@link parseLlmCraftNote}.
 */
export interface ParseLlmCraftNoteConfig {
  /**
   * The whole file's text.
   */
  readonly text: string;
  /**
   * The tier the note loads into.
   */
  readonly tier: LlmCraftNoteTier;
  /**
   * Where it came from, for people (a file name, a stored row).
   */
  readonly source?: string;
  /**
   * The host's craft sites — what `sites`, `where` and `ask` are checked against.
   */
  readonly sites: LlmCraftSiteRegistry;
}

/**
 * One frontmatter scalar or flow list.
 */
type LlmCraftFrontmatterScalarOrList = LlmPromptSiteFactValue | ReadonlyArray<LlmPromptSiteFactValue>;

/**
 * One frontmatter value — a scalar, a flow list, or a one-level map of either.
 */
type LlmCraftFrontmatterValue = LlmCraftFrontmatterScalarOrList | Readonly<Record<string, LlmCraftFrontmatterScalarOrList>>;

/**
 * The frontmatter schema — every key a note may carry; an unknown key is refused.
 */
export const llmCraftNoteFrontmatterSchema = /*#__PURE__*/ type({
  id: 'string',
  'title?': 'string',
  'sites?': 'string[]',
  'where?': { '[string]': 'string | number | boolean | (string | number | boolean)[]' },
  'ask?': 'string',
  'floor?': '0 <= number <= 1',
  'unserved?': "'include' | 'omit'",
  'priority?': `0 <= number.integer <= ${LLM_CRAFT_NOTE_MAX_PRIORITY}`,
  'enabled?': 'boolean',
  '+': 'reject'
});

/**
 * The frontmatter as the schema validated it.
 */
type LlmCraftNoteFrontmatter = typeof llmCraftNoteFrontmatterSchema.infer;

const KEY_PATTERN = /^([A-Za-z][A-Za-z0-9_-]*):(.*)$/;

/**
 * The byte-order mark a note file may open with.
 */
const BYTE_ORDER_MARK = String.fromCodePoint(0xfeff);

/**
 * The end index of a JSON string literal opening at `start` (the closing quote's index), or -1.
 *
 * @param text - The text.
 * @param start - The opening quote's index.
 * @returns The closing quote's index, or -1 when unterminated.
 */
function jsonStringEnd(text: string, start: number): number {
  let index = start + 1;
  let end = -1;

  while (index < text.length && end < 0) {
    const char = text[index];

    if (char === '\\') {
      index += 2;
    } else if (char === '"') {
      end = index;
    } else {
      index += 1;
    }
  }

  return end;
}

/**
 * Read one bare scalar: `true` / `false`, a number, else the string itself.
 *
 * @param bare - The trimmed bare text.
 * @returns The scalar.
 */
function bareScalar(bare: string): LlmPromptSiteFactValue {
  let value: LlmPromptSiteFactValue = bare;

  if (bare === 'true' || bare === 'false') {
    value = bare === 'true';
  } else if (/^-?\d+(\.\d+)?$/.test(bare)) {
    value = Number(bare);
  }

  return value;
}

/**
 * Whether what follows a value is legal — nothing, or a `#` comment.
 *
 * @param rest - The text after the value.
 * @returns Whether it is empty or a comment.
 */
function isTrailingComment(rest: string): boolean {
  const trimmed = rest.trim();
  return trimmed === '' || trimmed.startsWith('#');
}

/**
 * Parse one JSON-quoted string at the start of `raw`.
 *
 * @param raw - The text, opening with `"`.
 * @returns The string and the text after it, or a refusal message.
 */
function quotedOf(raw: string): { readonly value: string; readonly rest: string } | { readonly error: string } {
  const end = jsonStringEnd(raw, 0);
  let result: { readonly value: string; readonly rest: string } | { readonly error: string };

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
 * Read one flow-list item at `index`: a quoted string or a bare scalar.
 *
 * @param raw - The list text.
 * @param index - The item's first index.
 * @returns The item and the index after it, or a refusal message.
 */
function flowListItemOf(raw: string, index: number): { readonly item: LlmPromptSiteFactValue; readonly next: number } | { readonly error: string } {
  let result: { readonly item: LlmPromptSiteFactValue; readonly next: number } | { readonly error: string };

  if (raw[index] === '"') {
    const quoted = quotedOf(raw.slice(index));
    result = 'error' in quoted ? quoted : { item: quoted.value, next: raw.length - quoted.rest.length };
  } else {
    const stop = raw.slice(index).search(/[,\]]/);
    const bare = stop < 0 ? '' : raw.slice(index, index + stop).trim();

    if (stop < 0) {
      result = { error: 'an unclosed `[` list' };
    } else if (bare === '') {
      result = { error: 'an empty list item' };
    } else {
      result = { item: bareScalar(bare), next: index + stop };
    }
  }

  return result;
}

/**
 * Parse a flow list `[a, "b", 3]`.
 *
 * @param raw - The text, opening with `[`.
 * @returns The items and the text after the list, or a refusal message.
 */
function flowListOf(raw: string): { readonly value: ReadonlyArray<LlmPromptSiteFactValue>; readonly rest: string } | { readonly error: string } {
  const items: LlmPromptSiteFactValue[] = [];
  let index = 1;
  let result: { readonly value: ReadonlyArray<LlmPromptSiteFactValue>; readonly rest: string } | { readonly error: string } | undefined;

  while (result == null) {
    while (raw[index] === ' ') {
      index += 1;
    }

    if (index >= raw.length) {
      result = { error: 'an unclosed `[` list' };
    } else if (raw[index] === ']' && items.length === 0) {
      result = { value: items, rest: raw.slice(index + 1) };
    } else {
      const read = flowListItemOf(raw, index);

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
 * Parse one value: a quoted string, a flow list, or a bare scalar (a trailing ` # comment` dropped).
 *
 * @param raw - The trimmed text after `key:`.
 * @returns The value, or a refusal message.
 */
function valueOf(raw: string): { readonly value: LlmCraftFrontmatterScalarOrList } | { readonly error: string } {
  let result: { readonly value: LlmCraftFrontmatterScalarOrList } | { readonly error: string };

  if (raw.startsWith('"') || raw.startsWith('[')) {
    const parsed = raw.startsWith('"') ? quotedOf(raw) : flowListOf(raw);

    if ('error' in parsed) {
      result = parsed;
    } else if (isTrailingComment(parsed.rest)) {
      result = { value: parsed.value };
    } else {
      result = { error: 'unexpected text after the value (quote a value that holds `"` or `[`)' };
    }
  } else {
    const comment = raw.search(/\s#/);
    result = { value: bareScalar((comment < 0 ? raw : raw.slice(0, comment)).trim()) };
  }

  return result;
}

/**
 * The raw frontmatter rows plus the body, or every refusal.
 */
interface LlmCraftNoteSplit {
  readonly fields: Readonly<Record<string, LlmCraftFrontmatterValue>>;
  readonly lines: ReadonlyMap<string, number>;
  readonly body: string;
  readonly errors: ReadonlyArray<LlmCraftNoteParseError>;
}

/**
 * What the frontmatter rows are read into.
 */
interface LlmCraftNoteSplitAccumulator {
  readonly fields: Record<string, LlmCraftFrontmatterValue>;
  readonly keyLines: Map<string, number>;
  readonly errors: LlmCraftNoteParseError[];
}

/**
 * The map an un-valued key opened, which the indented rows below it fill.
 */
interface LlmCraftFrontmatterNestedMap {
  readonly key: string;
  readonly map: Record<string, LlmCraftFrontmatterScalarOrList>;
}

/**
 * One `key: value` frontmatter row.
 */
interface LlmCraftFrontmatterRow {
  readonly key: string;
  readonly raw: string;
  readonly lineNo: number;
}

/**
 * Read one INDENTED row into the map the key above it opened.
 *
 * @param acc - The accumulator.
 * @param nested - The open map, if any.
 * @param row - The row.
 */
function readIndentedFrontmatterRow(acc: LlmCraftNoteSplitAccumulator, nested: Maybe<LlmCraftFrontmatterNestedMap>, row: LlmCraftFrontmatterRow): void {
  const { key, raw, lineNo } = row;

  if (nested == null) {
    acc.errors.push({ line: lineNo, message: `\`${key}\` is indented, but no key above it opens a map` });
  } else if (raw === '' || raw.startsWith('#')) {
    acc.errors.push({ line: lineNo, message: `\`${nested.key}.${key}\` has no value (only one level of nesting)` });
  } else if (Object.hasOwn(nested.map, key)) {
    acc.errors.push({ line: lineNo, message: `\`${nested.key}.${key}\` is set twice` });
  } else {
    const parsed = valueOf(raw);

    if ('error' in parsed) {
      acc.errors.push({ line: lineNo, message: `\`${nested.key}.${key}\`: ${parsed.error}` });
    } else {
      nested.map[key] = parsed.value;
      acc.keyLines.set(`${nested.key}.${key}`, lineNo);
    }
  }
}

/**
 * Read one TOP-LEVEL row.
 *
 * @param acc - The accumulator.
 * @param row - The row.
 * @returns The map it opened (an un-valued key), else `undefined` (any open map is closed).
 */
function readTopLevelFrontmatterRow(acc: LlmCraftNoteSplitAccumulator, row: LlmCraftFrontmatterRow): Maybe<LlmCraftFrontmatterNestedMap> {
  const { key, raw, lineNo } = row;
  let nested: Maybe<LlmCraftFrontmatterNestedMap>;

  if (Object.hasOwn(acc.fields, key)) {
    acc.errors.push({ line: lineNo, message: `\`${key}\` is set twice` });
  } else if (raw === '' || raw.startsWith('#')) {
    const map: Record<string, LlmCraftFrontmatterScalarOrList> = {};
    acc.fields[key] = map;
    acc.keyLines.set(key, lineNo);
    nested = { key, map };
  } else {
    const parsed = valueOf(raw);

    if ('error' in parsed) {
      acc.errors.push({ line: lineNo, message: `\`${key}\`: ${parsed.error}` });
    } else {
      acc.fields[key] = parsed.value;
      acc.keyLines.set(key, lineNo);
    }
  }

  return nested;
}

/**
 * Split a note into its frontmatter rows (with their lines) and its body.
 *
 * @param text - The whole file's text.
 * @returns The split.
 */
function splitLlmCraftNote(text: string): LlmCraftNoteSplit {
  const lines = (text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text).replaceAll(/\r\n?/g, '\n').split('\n');
  const acc: LlmCraftNoteSplitAccumulator = { fields: {}, keyLines: new Map<string, number>(), errors: [] };
  const close = lines.findIndex((line, index) => index > 0 && line.trimEnd() === '---');
  let body = '';

  if (lines[0]?.trimEnd() !== '---') {
    acc.errors.push({ line: 1, message: 'a craft note opens with a `---` frontmatter fence' });
  } else if (close < 0) {
    acc.errors.push({ line: 1, message: 'the frontmatter is never closed with a `---` line' });
  } else {
    let nested: Maybe<LlmCraftFrontmatterNestedMap>;

    for (let index = 1; index < close; index += 1) {
      const line = lines[index];
      const lineNo = index + 1;
      const trimmed = line.trim();

      if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      }

      const indent = line.length - line.trimStart().length;
      const match = KEY_PATTERN.exec(trimmed);

      if (/^\s*\t/.test(line)) {
        acc.errors.push({ line: lineNo, message: 'indent with spaces, not tabs' });
      } else if (match == null) {
        acc.errors.push({ line: lineNo, message: 'expected `key: value`' });
      } else {
        const row: LlmCraftFrontmatterRow = { key: match[1], raw: match[2].trim(), lineNo };

        if (indent > 0) {
          readIndentedFrontmatterRow(acc, nested, row);
        } else {
          nested = readTopLevelFrontmatterRow(acc, row);
        }
      }
    }

    body = lines
      .slice(close + 1)
      .join('\n')
      .replace(/^(?:[ \t]*\n)+/, '')
      .trimEnd();
  }

  return { fields: acc.fields, lines: acc.keyLines, body, errors: acc.errors };
}

/**
 * Config for {@link llmCraftNoteRuleErrors}.
 */
interface LlmCraftNoteRuleErrorsConfig {
  readonly frontmatter: LlmCraftNoteFrontmatter;
  readonly body: string;
  readonly lineOf: (key: string) => Maybe<number>;
  readonly sites: LlmCraftSiteRegistry;
}

/**
 * Refuse each `where` fact none of the note's sites carries, a value of the wrong shape, and an empty list.
 *
 * @param where - The validated `where`.
 * @param knownSites - The note's registered sites.
 * @param refuse - Records one refusal at a key's line.
 */
function refuseLlmCraftNoteWhere(where: Readonly<Record<string, LlmCraftFrontmatterScalarOrList>>, knownSites: ReadonlyArray<LlmCraftSite>, refuse: (key: string, message: string) => void): void {
  const knownKinds = knownSites.map((site) => site.kind);

  for (const [fact, raw] of Object.entries(where)) {
    const values: ReadonlyArray<LlmPromptSiteFactValue> = Array.isArray(raw) ? raw : [raw as LlmPromptSiteFactValue];
    const shapes = knownSites.map((site) => llmCraftSiteFactShapeOf(site, fact)).filter((shape) => shape != null);
    const key = `where.${fact}`;

    if (values.length === 0) {
      refuse(key, `\`where.${fact}\` lists no value (it could never match)`);
    }

    if (knownSites.length > 0 && shapes.length === 0) {
      refuse(key, `\`${fact}\` is not a fact of ${knownKinds.join(' / ')}`);
    } else if (shapes.length > 0) {
      const wantsBoolean = shapes.every((shape) => shape === 'boolean');

      if (values.some((value) => (wantsBoolean ? typeof value !== 'boolean' : typeof value !== 'string'))) {
        refuse(key, `\`where.${fact}\` takes ${wantsBoolean ? '`true` / `false`' : 'words'}`);
      }
    }
  }
}

/**
 * The cross-field rules over a schema-valid frontmatter: the id, the sites, the `where` facts, the `ask` inputs, the
 * body. A tombstone (`enabled: false`) needs only its id.
 *
 * @param config - The validated frontmatter, the body, the key line reader and the site registry.
 * @returns Every refusal.
 */
function llmCraftNoteRuleErrors(config: LlmCraftNoteRuleErrorsConfig): ReadonlyArray<LlmCraftNoteParseError> {
  const { frontmatter, body, lineOf, sites: registry } = config;
  const errors: LlmCraftNoteParseError[] = [];
  /**
   * Record one refusal at a key's line.
   *
   * @param key - The key it concerns.
   * @param message - The refusal.
   */
  const refuse = (key: string, message: string): void => {
    const line = lineOf(key);
    errors.push({ ...(line == null ? {} : { line }), message });
  };
  const enabled = frontmatter.enabled !== false;
  const sites = frontmatter.sites ?? [];
  const knownSites: ReadonlyArray<LlmCraftSite> = sites.map((kind) => registry.siteOf(kind)).filter((site): site is LlmCraftSite => site != null);

  if (!LLM_CRAFT_NOTE_ID_PATTERN.test(frontmatter.id)) {
    refuse('id', `id \`${frontmatter.id}\` must match ${LLM_CRAFT_NOTE_ID_PATTERN.source}`);
  }

  for (const site of sites) {
    if (registry.siteOf(site) == null) {
      refuse('sites', `site \`${site}\` is not a craft site (${registry.kinds.join(', ')})`);
    }
  }

  if (new Set(sites).size !== sites.length) {
    refuse('sites', 'a site is listed twice');
  }

  if (enabled) {
    if (!isNotBlankString(frontmatter.title)) {
      refuse('title', 'an enabled note needs a `title`');
    }

    if (sites.length === 0) {
      refuse('sites', 'an enabled note needs at least one site');
    }

    if (body === '') {
      refuse('body', 'an enabled note needs a body');
    }
  }

  if (body.length > registry.noteMaxBytes) {
    refuse('body', `the body is ${body.length} bytes; a note holds at most ${registry.noteMaxBytes} (it is never truncated)`);
  }

  refuseLlmCraftNoteWhere(frontmatter.where ?? {}, knownSites, refuse);

  if (frontmatter.ask != null && llmCraftAskInputsOf(frontmatter.ask, knownSites).length === 0) {
    refuse('ask', `the ask names no input of its sites in backticks (one of: ${Array.from(new Set(knownSites.flatMap((site) => site.inputs))).join(', ')})`);
  }

  return errors;
}

/**
 * The file line an arktype error points at — its `where.<fact>` row when it has one, else its top-level key's.
 *
 * @param path - The error's path.
 * @param lines - The frontmatter key lines.
 * @returns The 1-based line, when known.
 */
function llmCraftFrontmatterErrorLineOf(path: ReadonlyArray<PropertyKey>, lines: ReadonlyMap<string, number>): Maybe<number> {
  let line: Maybe<number>;

  if (path.length > 0) {
    const head = String(path[0]);
    const key = path.length > 1 ? `${head}.${String(path[1])}` : head;
    line = lines.get(key) ?? lines.get(head);
  }

  return line;
}

/**
 * Parse one craft note.
 *
 * @param config - The text, the tier it loads into, where it came from and the host's craft sites.
 * @returns The note, or every refusal (with lines).
 *
 * @example
 * ```ts
 * const parsed = parseLlmCraftNote({ text, tier: 'machine', source: 'apparel-plain.md', sites });
 * if (parsed.errors != null) console.warn(llmCraftNoteParseErrorLines(parsed.errors, 'apparel-plain.md'));
 * ```
 */
export function parseLlmCraftNote(config: ParseLlmCraftNoteConfig): LlmCraftNoteParseResult {
  const { text, tier, source, sites } = config;
  const split = splitLlmCraftNote(text);
  let result: LlmCraftNoteParseResult;

  if (split.errors.length > 0) {
    result = { errors: split.errors };
  } else {
    const validated = llmCraftNoteFrontmatterSchema(split.fields);

    if (validated instanceof type.errors) {
      result = {
        errors: validated.map((error) => {
          const line = llmCraftFrontmatterErrorLineOf(error.path, split.lines);
          return { ...(line == null ? {} : { line }), message: error.message };
        })
      };
    } else {
      const lineOf = (key: string): Maybe<number> => (key === 'body' ? undefined : split.lines.get(key));
      const errors = llmCraftNoteRuleErrors({ frontmatter: validated, body: split.body, lineOf, sites });

      if (errors.length > 0) {
        result = { errors };
      } else {
        const where: LlmCraftNoteWhere = Object.fromEntries(Object.entries(validated.where ?? {}).map(([fact, raw]) => [fact, Array.isArray(raw) ? [...raw] : [raw]]));
        const note: LlmCraftNote = {
          id: validated.id,
          ...(validated.title == null ? {} : { title: validated.title }),
          sites: (validated.sites ?? []).filter((kind) => sites.siteOf(kind) != null),
          where,
          ...(validated.ask == null ? {} : { ask: validated.ask }),
          floor: validated.floor ?? DEFAULT_LLM_CRAFT_JUDGE_FLOOR,
          unserved: validated.unserved ?? 'omit',
          priority: validated.priority ?? DEFAULT_LLM_CRAFT_NOTE_PRIORITY,
          enabled: validated.enabled !== false,
          body: split.body,
          tier,
          ...(source == null ? {} : { source })
        };
        result = { note };
      }
    }
  }

  return result;
}

/**
 * One line per refusal, `<source>: line N: message` — what a loader warns and an authoring check prints.
 *
 * @param errors - The refusals.
 * @param source - Where the note came from, prefixed when given.
 * @returns The lines.
 */
export function llmCraftNoteParseErrorLines(errors: ReadonlyArray<LlmCraftNoteParseError>, source?: Maybe<string>): ReadonlyArray<string> {
  const prefix = source == null ? '' : `${source}: `;
  return errors.map((error) => {
    const at = error.line == null ? '' : `line ${error.line}: `;
    return `${prefix}${at}${error.message}`;
  });
}

/**
 * One note file to parse.
 */
export interface LlmCraftNoteFile {
  /**
   * Where it came from (a file name, a stored row's source).
   */
  readonly source: string;
  /**
   * Its whole text.
   */
  readonly text: string;
}

/**
 * One refused file.
 */
export interface LlmCraftNoteRefusal {
  readonly source: string;
  readonly errors: ReadonlyArray<LlmCraftNoteParseError>;
}

/**
 * A tier's parse: its tier, the loaded notes (sorted by id) and every refused file. The ONE tier loader shape — a
 * compile of committed notes refuses on any refusal, a machine folder drops and warns.
 */
export interface LlmCraftNoteSet {
  /**
   * The tier the notes loaded into.
   */
  readonly tier: LlmCraftNoteTier;
  readonly notes: ReadonlyArray<LlmCraftNote>;
  readonly refused: ReadonlyArray<LlmCraftNoteRefusal>;
}

/**
 * Config for {@link parseLlmCraftNoteSet}.
 */
export interface ParseLlmCraftNoteSetConfig {
  /**
   * The files.
   */
  readonly files: ReadonlyArray<LlmCraftNoteFile>;
  /**
   * The tier they load into.
   */
  readonly tier: LlmCraftNoteTier;
  /**
   * The host's craft sites.
   */
  readonly sites: LlmCraftSiteRegistry;
}

/**
 * Parse every file of one tier — the ONE tier loader. A second file claiming an id already loaded in this tier is
 * refused (the first, by source order, keeps it).
 *
 * @param config - The files, their tier and the host's craft sites.
 * @returns The tier's notes and refusals.
 */
export function parseLlmCraftNoteSet(config: ParseLlmCraftNoteSetConfig): LlmCraftNoteSet {
  const { tier, sites } = config;
  const notes = new Map<string, LlmCraftNote>();
  const refused: LlmCraftNoteRefusal[] = [];

  for (const file of [...config.files].sort((a, b) => compareStrings(a.source, b.source))) {
    const parsed = parseLlmCraftNote({ text: file.text, tier, source: file.source, sites });

    if (parsed.errors != null) {
      refused.push({ source: file.source, errors: parsed.errors });
    } else if (notes.has(parsed.note.id)) {
      refused.push({ source: file.source, errors: [{ message: `id \`${parsed.note.id}\` is already loaded from ${notes.get(parsed.note.id)?.source ?? 'another file'} in the ${tier} tier` }] });
    } else {
      notes.set(parsed.note.id, parsed.note);
    }
  }

  return { tier, notes: Array.from(notes.values()).sort((a, b) => compareStrings(a.id, b.id)), refused };
}
