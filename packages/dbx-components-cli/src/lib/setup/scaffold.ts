/**
 * The scaffold engine: turns an archive subtree + token table into a sorted
 * plan of file writes, then applies it. One recursive walk per module subtree
 * replaces the hundreds of `curl … | sed … > file` lines in the script.
 *
 * Each planned entry is classified `text` (token-substituted), `binary` (copied
 * raw, e.g. `icon.png`), or `exec` (token-substituted, then `chmod 0755`, e.g.
 * the `.sh` utility scripts + husky hooks). Token selection per file is delegated
 * to the {@link SetupTokenTable}: a per-file list when present, else the global
 * list — never both (see tokens.ts).
 */

import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Maybe } from '@dereekb/util';
import { type SetupToken, type SetupTokenTable } from './tokens.js';
import { applyTokens } from './substitute.js';
import { type TemplateArchive } from './archive.js';

/**
 * How a scaffolded file is materialized.
 */
export type ScaffoldEntryMode = 'text' | 'binary' | 'exec';

/**
 * One planned file write. Sourced either from the archive or from literal content.
 */
export interface ScaffoldPlanEntry {
  /**
   * Archive-relative source path. Omitted for literal-content entries.
   */
  readonly archivePath?: Maybe<string>;
  /**
   * Literal file content. When set, takes precedence over `archivePath`.
   */
  readonly literal?: Maybe<string>;
  /**
   * Absolute destination path on disk.
   */
  readonly destPath: string;
  readonly mode: ScaffoldEntryMode;
  /**
   * Ordered token list applied for text/exec entries (empty for binary).
   */
  readonly tokens: readonly SetupToken[];
}

/**
 * Builds a literal-content plan entry (the in-process equivalent of the
 * script's `echo … > file` writes — e.g. `src/index.ts`, `.env.local`).
 *
 * @param input - The literal entry inputs.
 * @param input.destPath - Absolute destination path.
 * @param input.content - Literal file content.
 * @param input.mode - Optional materialization mode (defaults to `text`).
 * @param input.tokens - Optional tokens to apply to the literal content.
 * @returns A literal scaffold plan entry.
 */
export function literalScaffoldEntry(input: { readonly destPath: string; readonly content: string; readonly mode?: Maybe<ScaffoldEntryMode>; readonly tokens?: Maybe<readonly SetupToken[]> }): ScaffoldPlanEntry {
  return { destPath: input.destPath, literal: input.content, mode: input.mode ?? 'text', tokens: input.tokens ?? [] };
}

/**
 * Inputs for {@link buildScaffoldPlan}.
 */
export interface BuildScaffoldPlanInput {
  readonly archive: TemplateArchive;
  /**
   * Archive-relative subtree prefix to scaffold (e.g. `components/firebase`).
   */
  readonly subtree: string;
  /**
   * Absolute directory the subtree contents are written into.
   */
  readonly destRoot: string;
  readonly tokens: SetupTokenTable;
  /**
   * Optional overrides mapping an archive path to a destination path relative to
   * `destRoot`, replacing the default mapping (used for renames like
   * `test-demo-api.sh` → `test-<api>.sh`).
   */
  readonly pathOverrides?: Maybe<ReadonlyMap<string, string>>;
}

const BINARY_EXTENSIONS: ReadonlySet<string> = new Set(['png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'woff', 'woff2', 'ttf', 'eot']);

/**
 * Code-point string comparator for sorting (avoids a nested ternary).
 *
 * @param a - First value.
 * @param b - Second value.
 * @returns Negative when `a` sorts first, positive when `b` does, zero when equal.
 */
function compareText(a: string, b: string): number {
  let result = 0;
  if (a < b) {
    result = -1;
  } else if (a > b) {
    result = 1;
  }
  return result;
}

/**
 * Classifies a file's materialization mode from its archive path.
 *
 * @param archivePath - Archive-relative source path.
 * @returns The entry mode (`binary`, `exec`, or `text`).
 */
function deriveEntryMode(archivePath: string): ScaffoldEntryMode {
  const ext = archivePath.includes('.') ? archivePath.slice(archivePath.lastIndexOf('.') + 1).toLowerCase() : '';
  let mode: ScaffoldEntryMode;
  if (BINARY_EXTENSIONS.has(ext)) {
    mode = 'binary';
  } else if (ext === 'sh' || archivePath.includes('.husky/')) {
    mode = 'exec';
  } else {
    mode = 'text';
  }
  return mode;
}

/**
 * Strips the `.template` infix from a path segment so `project.template.json`
 * becomes `project.json`, `webpack.config.template.js` → `webpack.config.js`.
 *
 * @param relPath - Path possibly containing a `.template` infix.
 * @returns The path with `.template` removed.
 */
function stripTemplateInfix(relPath: string): string {
  return relPath.replace(/\.template(\.[^./]+)$/, '$1');
}

/**
 * Resolves the ordered token list for an entry: a per-file list when keyed,
 * the global list otherwise, and an empty list for binary entries.
 *
 * @param archivePath - Archive-relative source path.
 * @param mode - The resolved entry mode.
 * @param tokens - The two-layer token table.
 * @returns The ordered token list to apply.
 */
function resolveEntryTokens(archivePath: string, mode: ScaffoldEntryMode, tokens: SetupTokenTable): readonly SetupToken[] {
  let resolved: readonly SetupToken[];
  if (mode === 'binary') {
    resolved = [];
  } else {
    resolved = tokens.perFile.get(archivePath) ?? tokens.global;
  }
  return resolved;
}

/**
 * Builds the sorted scaffold plan for a subtree. No disk I/O.
 *
 * @param input - Archive, subtree, destination root, token table, optional renames.
 * @returns Planned entries sorted by destination path.
 */
export function buildScaffoldPlan(input: BuildScaffoldPlanInput): readonly ScaffoldPlanEntry[] {
  const { archive, subtree, destRoot, tokens, pathOverrides } = input;
  const normalizedSubtree = subtree.replaceAll(/^\/+|\/+$/g, '');
  const prefix = normalizedSubtree.length > 0 ? `${normalizedSubtree}/` : '';
  const archivePaths = archive.listSubtree(normalizedSubtree);

  const entries = archivePaths.map((archivePath): ScaffoldPlanEntry => {
    const override = pathOverrides?.get(archivePath);
    const relWithinSubtree = override ?? stripTemplateInfix(archivePath.slice(prefix.length));
    const mode = deriveEntryMode(archivePath);
    return {
      archivePath,
      destPath: join(destRoot, relWithinSubtree),
      mode,
      tokens: resolveEntryTokens(archivePath, mode, tokens)
    };
  });

  return entries.sort((a, b) => compareText(a.destPath, b.destPath));
}

/**
 * Builds a single archive-sourced plan entry, resolving its mode + tokens the
 * same way {@link buildScaffoldPlan} does. Used for the files modules scaffold
 * individually (renames, cross-subtree files, the `.env` fan-out).
 *
 * @param input - The archive entry inputs.
 * @param input.archivePath - Source archive-relative path.
 * @param input.destPath - Absolute destination path.
 * @param input.tokens - The two-layer token table.
 * @param input.tokensOverride - Optional token list overriding the resolved one (for the `.env` fan-out).
 * @returns A scaffold plan entry.
 */
export function archiveScaffoldEntry(input: { readonly archivePath: string; readonly destPath: string; readonly tokens: SetupTokenTable; readonly tokensOverride?: Maybe<readonly SetupToken[]> }): ScaffoldPlanEntry {
  const mode = deriveEntryMode(input.archivePath);
  return {
    archivePath: input.archivePath,
    destPath: input.destPath,
    mode,
    tokens: input.tokensOverride ?? resolveEntryTokens(input.archivePath, mode, input.tokens)
  };
}

/**
 * A single applied (or dry-run) write.
 */
export interface ScaffoldWriteResult {
  readonly destPath: string;
  readonly mode: ScaffoldEntryMode;
  /**
   * `true` when the write was suppressed by `dryRun`.
   */
  readonly skipped: boolean;
}

/**
 * Inputs for {@link applyScaffoldPlan}.
 */
export interface ApplyScaffoldPlanInput {
  readonly archive: TemplateArchive;
  readonly plan: readonly ScaffoldPlanEntry[];
  /**
   * When `true`, computes results without touching disk.
   */
  readonly dryRun?: Maybe<boolean>;
}

/**
 * Renders a single template entry's text content with its tokens applied.
 *
 * @param archive - The template archive.
 * @param archivePath - Archive-relative source path.
 * @param tokens - Ordered tokens to apply.
 * @returns The substituted text, or `undefined` when the entry is absent.
 */
export function renderTemplateText(archive: TemplateArchive, archivePath: string, tokens: readonly SetupToken[]): Maybe<string> {
  const data = archive.readEntry(archivePath);
  return data == null ? undefined : applyTokens(data.toString('utf8'), tokens);
}

/**
 * Writes a single file into the project, creating parent dirs and (for exec
 * mode) marking it executable. Honors `dryRun`.
 *
 * @param input - The write inputs.
 * @param input.destPath - Absolute destination path.
 * @param input.data - File content (string for text/exec, Buffer for binary).
 * @param input.mode - Materialization mode (`exec` marks the file executable).
 * @param input.dryRun - When set, computes the result without touching disk.
 * @returns The write result.
 */
export function writeScaffoldFile(input: { readonly destPath: string; readonly data: string | Buffer; readonly mode: ScaffoldEntryMode; readonly dryRun?: Maybe<boolean> }): ScaffoldWriteResult {
  const { destPath, data, mode, dryRun } = input;
  if (!dryRun) {
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, data);
    if (mode === 'exec') {
      chmodSync(destPath, 0o755);
    }
  }
  return { destPath, mode, skipped: Boolean(dryRun) };
}

/**
 * Applies a scaffold plan, writing each entry (or computing the would-be writes
 * under `dryRun`). Missing archive entries are skipped silently — the plan is
 * built from the archive listing, so this only guards against a race.
 *
 * @param input - Archive, plan, and dry-run flag.
 * @returns One result per planned entry.
 */
export function applyScaffoldPlan(input: ApplyScaffoldPlanInput): readonly ScaffoldWriteResult[] {
  const { archive, plan, dryRun } = input;
  const results: ScaffoldWriteResult[] = [];
  for (const entry of plan) {
    let data: Maybe<string | Buffer>;
    if (entry.literal != null) {
      data = applyTokens(entry.literal, entry.tokens);
    } else if (entry.archivePath != null) {
      const raw = archive.readEntry(entry.archivePath);
      if (raw != null) {
        data = entry.mode === 'binary' ? raw : applyTokens(raw.toString('utf8'), entry.tokens);
      }
    }
    if (data == null) {
      continue;
    }
    results.push(writeScaffoldFile({ destPath: entry.destPath, data, mode: entry.mode, dryRun }));
  }
  return results;
}
