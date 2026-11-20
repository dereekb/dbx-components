/**
 * Host wiring for a FOLDER craft-note tier (a machine's own notes) — WHERE the folder is, and the drop-and-warn load of
 * it through the ONE tier loader (`parseLlmCraftNoteSet`).
 *
 * Read only through a host-passed folder: a host's runner resolves it with {@link resolveLlmCraftNotesDir} at boot; a
 * spec or a replay passes nothing, so it never reads the operator's machine.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { compareStringsByCodeUnit, errorMessageOf, type Maybe } from '@dereekb/util';
import { llmCraftNoteParseErrorLines, parseLlmCraftNoteSet, type LlmCraftNoteFile, type LlmCraftNoteSet, type LlmCraftNoteTier, type LlmCraftSiteRegistry, type LlmSwallowSink } from '@dereekb/llm';
import { DEFAULT_LLM_ENV_NAMES, firstLlmEnvEntry, type LlmEnvNames, type LlmEnvView } from './llm.node.env';

/**
 * The file a craft folder may keep for people; never loaded as a note.
 */
export const LLM_CRAFT_NOTES_README = 'README.md';

/**
 * The swallow site an unreadable craft-notes folder reports.
 */
export const LLM_CRAFT_NOTES_FOLDER_READ_SWALLOW_SITE = 'llm/craft-notes.folder-read';

/**
 * Config for {@link resolveLlmCraftNotesDir}.
 */
export interface ResolveLlmCraftNotesDirConfig {
  /**
   * The environment to read.
   */
  readonly env?: Maybe<LlmEnvView>;
  /**
   * The env var names. Defaults to {@link DEFAULT_LLM_ENV_NAMES}; names with no `craftNotesDir` never read the env.
   */
  readonly names?: Maybe<LlmEnvNames>;
  /**
   * The folder used when the env names none.
   */
  readonly defaultDir: string;
}

/**
 * The craft-notes folder: the `craftNotesDir` env var (trimmed, non-blank) when set, else `defaultDir`. Always a path —
 * an absent folder is the ordinary case and loads as no notes.
 *
 * @param config - The environment, the names and the default folder.
 * @returns The folder.
 *
 * @example
 * ```ts
 * const dir = resolveLlmCraftNotesDir({ env: process.env, defaultDir: join(homedir(), '.my-app', 'craft') });
 * ```
 */
export function resolveLlmCraftNotesDir(config: ResolveLlmCraftNotesDirConfig): string {
  const names = config.names ?? DEFAULT_LLM_ENV_NAMES;
  return firstLlmEnvEntry({ env: config.env, names: names.craftNotesDir ?? [] })?.value ?? config.defaultDir;
}

/**
 * The note files in a craft folder (`*.md`, its README excepted, not recursive), sorted by name in code-unit order
 * (never the host's locale). An absent folder, or a path that is not a folder, reads as none. Synchronous: hosts read
 * at boot.
 *
 * @param dir - The folder.
 * @returns The files.
 */
export function readLlmCraftNoteFiles(dir: string): ReadonlyArray<LlmCraftNoteFile> {
  const isDir = existsSync(dir) && statSync(dir).isDirectory();
  return isDir
    ? readdirSync(dir)
        .filter((name) => name.endsWith('.md') && name !== LLM_CRAFT_NOTES_README)
        .sort(compareStringsByCodeUnit)
        .map((name) => ({ source: name, text: readFileSync(join(dir, name), 'utf8') }))
    : [];
}

/**
 * Config for {@link loadLlmCraftNotes}.
 */
export interface LoadLlmCraftNotesConfig {
  /**
   * The folder to read.
   */
  readonly dir: string;
  /**
   * The tier the notes load into.
   */
  readonly tier: LlmCraftNoteTier;
  /**
   * The host's craft sites.
   */
  readonly sites: LlmCraftSiteRegistry;
  /**
   * Where a refused file's lines go (newline-terminated). Absent ⇒ silent.
   */
  readonly warn?: Maybe<(message: string) => void>;
  /**
   * Tallies an unreadable folder ({@link LLM_CRAFT_NOTES_FOLDER_READ_SWALLOW_SITE}). Absent ⇒ only the warning reports it.
   */
  readonly swallow?: Maybe<LlmSwallowSink>;
}

/**
 * Load a folder tier — every note file through the one tier loader. A bad file is DROPPED and warned about (one line
 * per refusal), never thrown; an unreadable folder loads as no notes.
 *
 * @param config - The folder, the tier, the craft sites and the sinks.
 * @returns The tier's notes and refused files.
 *
 * @example
 * ```ts
 * const machine = loadLlmCraftNotes({ dir, tier: 'machine', sites, warn: (line) => process.stderr.write(line) });
 * ```
 */
export function loadLlmCraftNotes(config: LoadLlmCraftNotesConfig): LlmCraftNoteSet {
  const { dir, tier, sites, warn, swallow } = config;
  let files: ReadonlyArray<LlmCraftNoteFile> = [];

  try {
    files = readLlmCraftNoteFiles(dir);
  } catch (error) {
    swallow?.(LLM_CRAFT_NOTES_FOLDER_READ_SWALLOW_SITE, error);
    warn?.(`craft notes: could not read ${dir}: ${errorMessageOf(error)}\n`);
  }

  const set = parseLlmCraftNoteSet({ files, tier, sites });

  for (const refusal of set.refused) {
    for (const line of llmCraftNoteParseErrorLines(refusal.errors, join(dir, refusal.source))) {
      warn?.(`craft notes: skipped ${line}\n`);
    }
  }

  return set;
}
