/**
 * Shared input-handling helpers used by per-domain validator tool wrappers
 * (`*-validate-folder.tool.ts`, `*-validate.tool.ts`, `*-validate-api.tool.ts`).
 *
 * Centralises the cwd-bounded path resolution that each tool wrapper
 * needs so the security check (rejecting paths that escape `process.cwd()`)
 * lives in one place.
 */

import { glob as fsGlob, readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

/**
 * One file's raw contents passed into a source-text validator.
 * Tool wrappers reading paths or globs off disk resolve them to this
 * shape before calling into the validator core.
 */
export interface ValidatorSource {
  readonly name: string;
  readonly text: string;
}

/**
 * Throws when `relative` (resolved against `cwd`) escapes `cwd`.
 * Used by tool wrappers to enforce the "no paths outside the server cwd"
 * security check before any file I/O.
 *
 * @param relative - the caller-supplied relative path
 * @param cwd - the server cwd to bound the path against
 */
export function ensurePathInsideCwd(relative: string, cwd: string): void {
  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;
  const absolute = resolve(cwd, relative);
  if (!absolute.startsWith(cwdPrefix) && absolute !== cwd) {
    throw new Error(`Path \`${relative}\` resolves outside the server cwd and is not allowed.`);
  }
}

/**
 * Resolves a `paths` + `glob` input pair into a deduplicated, cwd-bounded
 * list of relative folder paths. Glob matches are filtered to directories
 * only — non-directory matches are silently skipped, matching the
 * behaviour each tool wrapper previously implemented inline.
 *
 * @param config - shared call config
 * @param config.paths - explicit relative paths supplied by the caller (may be undefined)
 * @param config.glob - single glob pattern resolved against `cwd` (may be undefined)
 * @param config.cwd - the server cwd to bound the resolved paths against
 * @returns the deduplicated list of relative folder paths
 */
export async function resolveFolderPaths(config: { readonly paths: readonly string[] | undefined; readonly glob: string | undefined; readonly cwd: string }): Promise<readonly string[]> {
  const { paths, glob, cwd } = config;
  const collected: string[] = [];
  const seen = new Set<string>();

  const accept = (relative: string): void => {
    if (seen.has(relative)) return;
    ensurePathInsideCwd(relative, cwd);
    seen.add(relative);
    collected.push(relative);
  };

  if (paths) {
    for (const p of paths) {
      accept(p);
    }
  }
  if (glob) {
    for await (const match of fsGlob(glob, { cwd })) {
      const absolute = resolve(cwd, match);
      try {
        const stats = await stat(absolute);
        if (!stats.isDirectory()) continue;
      } catch {
        continue;
      }
      accept(match);
    }
  }

  return collected;
}

/**
 * Resolves an inline `sources` list plus an optional `paths` + `glob`
 * pair into a deduplicated `{ name, text }[]` for source-text validators.
 *
 * Inline sources take precedence and seed the dedup set by `name`. Any
 * `paths` / `glob` matches are then read off disk (cwd-bounded), with the
 * relative path used as the source `name`. Paths escaping `cwd` are
 * rejected via {@link ensurePathInsideCwd}.
 *
 * @param config - shared call config
 * @param config.sources - inline `{ name, text }` records (may be undefined)
 * @param config.paths - explicit relative file paths supplied by the caller (may be undefined)
 * @param config.glob - single glob pattern resolved against `cwd` (may be undefined)
 * @param config.cwd - the server cwd to bound the resolved paths against
 * @returns the deduplicated source list (inline first, then path / glob)
 */
export async function resolveValidatorSources(config: { readonly sources: readonly ValidatorSource[] | undefined; readonly paths: readonly string[] | undefined; readonly glob: string | undefined; readonly cwd: string }): Promise<readonly ValidatorSource[]> {
  const { sources, paths, glob, cwd } = config;
  const collected: ValidatorSource[] = [];
  const seenNames = new Set<string>();

  if (sources) {
    for (const src of sources) {
      if (seenNames.has(src.name)) continue;
      seenNames.add(src.name);
      collected.push(src);
    }
  }

  const pathList: string[] = [];
  if (paths) {
    for (const p of paths) {
      pathList.push(p);
    }
  }
  if (glob) {
    for await (const match of fsGlob(glob, { cwd })) {
      pathList.push(match);
    }
  }

  for (const relative of pathList) {
    if (seenNames.has(relative)) continue;
    ensurePathInsideCwd(relative, cwd);
    const absolute = resolve(cwd, relative);
    const text = await readFile(absolute, 'utf8');
    seenNames.add(relative);
    collected.push({ name: relative, text });
  }

  return collected;
}
