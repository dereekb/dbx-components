/**
 * A STORED-ROW craft-note tier's reader — a tier whose notes are rows a host stores (a workspace document, a database
 * collection), each row's text parsed through the ONE tier loader ({@link parseLlmCraftNoteSet}), so a stored note
 * obeys exactly the format a committed or folder note does.
 *
 * - A row with `enabled: false` is a TOMBSTONE over its id, whatever text it kept: it parses as the minimal tombstone
 *   note, so it shadows a lower tier's note and a broken text can never un-hide it.
 * - A row whose note id is not its row id is refused (one row, one id).
 * - The reader memoizes on the rows' content, so an unchanged tier parses once however many prompts it serves.
 */

import { type Maybe } from '@dereekb/util';
import { parseLlmCraftNoteSet, type LlmCraftNoteFile, type LlmCraftNoteRefusal, type LlmCraftNoteSet } from './llm.craft.frontmatter';
import { type LlmCraftNoteId, type LlmCraftNoteTier } from './llm.craft.identity';
import { type LlmCraftSiteRegistry } from './llm.craft.site';

/**
 * One stored craft-note row — its id, its note text and its posture. A host's own row type with more fields fits
 * structurally.
 */
export interface LlmCraftNoteRow {
  /**
   * The row id — the note id its text must declare.
   */
  readonly id: LlmCraftNoteId;
  /**
   * The whole note text (frontmatter + body).
   */
  readonly text?: Maybe<string>;
  /**
   * `false` ⇒ a tombstone over the id, whatever text the row kept.
   */
  readonly enabled?: Maybe<boolean>;
}

/**
 * The `source` a stored row parses under — `<tier>:<id>`.
 *
 * @param tier - The row tier.
 * @param id - The row id.
 * @returns The source.
 */
export function llmCraftNoteRowSourceOf(tier: LlmCraftNoteTier, id: LlmCraftNoteId): string {
  return `${tier}:${id}`;
}

/**
 * The minimal tombstone note text for an id — what an `enabled: false` row parses as.
 *
 * @param id - The note id.
 * @returns The note text.
 */
export function llmCraftNoteTombstoneText(id: LlmCraftNoteId): string {
  return `---\nid: ${id}\nenabled: false\n---\n`;
}

/**
 * Config for {@link llmCraftNoteRowFilesOf}.
 */
export interface LlmCraftNoteRowFilesOfConfig {
  /**
   * The stored rows.
   */
  readonly rows: ReadonlyArray<LlmCraftNoteRow>;
  /**
   * The tier they load into.
   */
  readonly tier: LlmCraftNoteTier;
}

/**
 * The files a row tier parses — a tombstone row as its tombstone text, a live row as its own text.
 *
 * @param config - The rows and their tier.
 * @returns The files.
 */
export function llmCraftNoteRowFilesOf(config: LlmCraftNoteRowFilesOfConfig): ReadonlyArray<LlmCraftNoteFile> {
  const { rows, tier } = config;
  return rows.map((row) => ({ source: llmCraftNoteRowSourceOf(tier, row.id), text: row.enabled === false ? llmCraftNoteTombstoneText(row.id) : (row.text ?? '') }));
}

/**
 * Config for {@link parseLlmCraftNoteRows}.
 */
export interface ParseLlmCraftNoteRowsConfig extends LlmCraftNoteRowFilesOfConfig {
  /**
   * The host's craft sites.
   */
  readonly sites: LlmCraftSiteRegistry;
}

/**
 * Parse a row tier — every row through the one tier loader, then refuse a note whose id is not its row id.
 *
 * @param config - The rows, their tier and the host's craft sites.
 * @returns The tier's notes and refused rows.
 */
export function parseLlmCraftNoteRows(config: ParseLlmCraftNoteRowsConfig): LlmCraftNoteSet {
  const { tier, sites } = config;
  const parsed = parseLlmCraftNoteSet({ files: llmCraftNoteRowFilesOf(config), tier, sites });
  const mismatched: LlmCraftNoteRefusal[] = [];
  const notes = parsed.notes.filter((note) => {
    const ok = note.source === llmCraftNoteRowSourceOf(tier, note.id);

    if (!ok) {
      mismatched.push({ source: note.source ?? tier, errors: [{ message: `the note id \`${note.id}\` is not its row id` }] });
    }

    return ok;
  });

  return { tier, notes, refused: [...parsed.refused, ...mismatched] };
}

/**
 * A memoized row-tier reader — the tier's notes for the current rows.
 */
export type LlmCraftNoteRowReader = (rows: Maybe<ReadonlyArray<LlmCraftNoteRow>>) => LlmCraftNoteSet;

/**
 * Config for {@link makeLlmCraftNoteRowReader}.
 */
export interface LlmCraftNoteRowReaderConfig {
  /**
   * The tier the rows load into.
   */
  readonly tier: LlmCraftNoteTier;
  /**
   * The host's craft sites.
   */
  readonly sites: LlmCraftSiteRegistry;
}

/**
 * A memoized row-tier reader — reparses only when the rows' ids, postures or texts changed; an unchanged content
 * returns the SAME set object.
 *
 * @param config - The tier and the host's craft sites.
 * @returns The reader.
 *
 * @example
 * ```ts
 * const readRows = makeLlmCraftNoteRowReader({ tier: 'workspace', sites });
 * const set = readRows(workspace.craftNoteRows);
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmCraftNoteRowReader(config: LlmCraftNoteRowReaderConfig): LlmCraftNoteRowReader {
  const { tier, sites } = config;
  let lastKey: Maybe<string>;
  let lastSet: LlmCraftNoteSet = { tier, notes: [], refused: [] };

  return (rows) => {
    const list = rows ?? [];
    const key = JSON.stringify(list.map((row) => [row.id, row.enabled === false, row.text ?? null]));

    if (key !== lastKey) {
      lastKey = key;
      lastSet = list.length === 0 ? { tier, notes: [], refused: [] } : parseLlmCraftNoteRows({ rows: list, tier, sites });
    }

    return lastSet;
  };
}
