/**
 * The craft-note PARSER — a markdown file with a small frontmatter block, read into an {@link LlmCraftNote}. Pure. The
 * frontmatter is read by `@dereekb/util` `parseMarkdownFrontmatter` (a YAML subset: bare, double-quoted JSON and
 * single-quoted scalars, `[flow]` and `- item` lists, ONE level of nesting, `# comments`, CRLF and a BOM normalized),
 * which names each refusal's 1-based file line.
 *
 * Craft adds its rules on top: the opening `---` fence is required, an empty `key:` reads as an empty map (`where`),
 * and the body is trimmed. The shape is then validated by an arktype schema that rejects an unknown key, and the
 * cross-field rules (sites, `where` facts, the `ask` inputs, the body budget) are checked last, against the host's site
 * registry.
 */

import { compareStringsByCodeUnit, isNotBlankString, type MarkdownFrontmatterLeaf, type MarkdownFrontmatterMap, type Maybe, parseMarkdownFrontmatter } from '@dereekb/util';
import { type } from 'arktype';
import { type LlmPromptSiteFactValue } from '../prompt/llm.prompt.site';
import { type LlmCraftNoteTier } from './llm.craft.identity';
import { DEFAULT_LLM_CRAFT_JUDGE_FLOOR, DEFAULT_LLM_CRAFT_NOTE_PRIORITY, LLM_CRAFT_NOTE_ID_PATTERN, LLM_CRAFT_NOTE_MAX_PRIORITY, type LlmCraftNote, type LlmCraftNoteWhere } from './llm.craft.note';
import { readLlmCraftAskInputs, readLlmCraftSiteFactShape, type LlmCraftSite, type LlmCraftSiteRegistry } from './llm.craft.site';

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

/**
 * The frontmatter values, their lines, the trimmed body, and every refusal.
 */
interface LlmCraftNoteSplit {
  readonly fields: Readonly<Record<string, MarkdownFrontmatterLeaf | MarkdownFrontmatterMap>>;
  readonly lines: ReadonlyMap<string, number>;
  readonly body: string;
  readonly errors: ReadonlyArray<LlmCraftNoteParseError>;
}

/**
 * Split a note into its frontmatter values (with their lines) and its body, through `@dereekb/util`'s reader plus the
 * craft rules: the opening fence is required, an empty `key:` reads as an empty map, and the body drops its blank lead
 * lines and trailing space.
 *
 * @param text - The whole file's text.
 * @returns The split.
 */
function splitLlmCraftNote(text: string): LlmCraftNoteSplit {
  const parsed = parseMarkdownFrontmatter(text);
  const opened = parsed.hasFrontmatter || parsed.unclosed;
  const errors: ReadonlyArray<LlmCraftNoteParseError> = opened ? parsed.problems : [{ line: 1, message: 'a craft note opens with a `---` frontmatter fence' }];
  const fields = Object.fromEntries(Object.entries(parsed.values).map(([key, value]) => [key, value ?? {}]));
  const body = parsed.hasFrontmatter ? parsed.body.replace(/^(?:[ \t]*\n)+/, '').trimEnd() : '';
  return { fields, lines: parsed.lines, body, errors };
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
function refuseLlmCraftNoteWhere(where: Readonly<Record<string, MarkdownFrontmatterLeaf>>, knownSites: ReadonlyArray<LlmCraftSite>, refuse: (key: string, message: string) => void): void {
  const knownKinds = knownSites.map((site) => site.kind);

  for (const [fact, raw] of Object.entries(where)) {
    const values: ReadonlyArray<LlmPromptSiteFactValue> = Array.isArray(raw) ? raw : [raw as LlmPromptSiteFactValue];
    const shapes = knownSites.map((site) => readLlmCraftSiteFactShape(site, fact)).filter((shape) => shape != null);
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

  if (body.length > registry.noteMaxChars) {
    refuse('body', `the body is ${body.length} characters; a note holds at most ${registry.noteMaxChars} (it is never truncated)`);
  }

  refuseLlmCraftNoteWhere(frontmatter.where ?? {}, knownSites, refuse);

  if (frontmatter.ask != null && readLlmCraftAskInputs(frontmatter.ask, knownSites).length === 0) {
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

  for (const file of [...config.files].sort((a, b) => compareStringsByCodeUnit(a.source, b.source))) {
    const parsed = parseLlmCraftNote({ text: file.text, tier, source: file.source, sites });

    if (parsed.errors != null) {
      refused.push({ source: file.source, errors: parsed.errors });
    } else if (notes.has(parsed.note.id)) {
      refused.push({ source: file.source, errors: [{ message: `id \`${parsed.note.id}\` is already loaded from ${notes.get(parsed.note.id)?.source ?? 'another file'} in the ${tier} tier` }] });
    } else {
      notes.set(parsed.note.id, parsed.note);
    }
  }

  return { tier, notes: Array.from(notes.values()).sort((a, b) => compareStringsByCodeUnit(a.id, b.id)), refused };
}
