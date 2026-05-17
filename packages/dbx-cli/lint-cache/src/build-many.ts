import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Maybe } from '@dereekb/util';

import { runBuild } from './build';
import { listProjects, type ProjectInfo } from './project-lookup';
import type { LintCache } from './types';

interface LintCacheIndex {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly projectCount: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly totalErrors: number;
  readonly totalWarnings: number;
  readonly projects: readonly BuildManyProjectResult[];
}

export interface BuildManyOptions {
  readonly workspaceRoot: string;
  readonly outputDir: string;
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly concurrency: number;
  readonly continueOnError: boolean;
  readonly nxArgs: Maybe<readonly string[]>;
  readonly fix: boolean;
  readonly onProgress: Maybe<(event: BuildManyProgressEvent) => void>;
}

export type BuildManyProgressEvent = { readonly kind: 'start'; readonly project: string; readonly index: number; readonly total: number } | { readonly kind: 'done'; readonly project: string; readonly index: number; readonly total: number; readonly cache: LintCache } | { readonly kind: 'error'; readonly project: string; readonly index: number; readonly total: number; readonly error: string };

export interface BuildManyProjectResult {
  readonly project: string;
  readonly cachePath: Maybe<string>;
  readonly errorCount: Maybe<number>;
  readonly warningCount: Maybe<number>;
  readonly filesWithIssues: Maybe<number>;
  /**
   * ISO-8601 timestamp from the project's cache file (i.e. when ESLint last
   * ran for that project). Lets consumers see staleness across the index
   * after single-project rebuilds. `null` if the project failed to build.
   */
  readonly generatedAt: Maybe<string>;
  readonly error: Maybe<string>;
}

export interface BuildManyResult {
  readonly indexPath: string;
  readonly projects: readonly BuildManyProjectResult[];
  readonly totalErrors: number;
  readonly totalWarnings: number;
}

/**
 * Discovers every Nx project with a `lint` target, filters by include/exclude
 * patterns, and runs `runBuild` for each one with a bounded concurrency pool.
 * After all projects finish, writes an aggregate `index.json` next to the
 * per-project cache files so a downstream agent can pick the project to
 * inspect without re-walking the workspace.
 *
 * @param opts - The workspace root, output directory, include/exclude patterns, concurrency, fix flag, and optional progress callback.
 * @returns The aggregate index path, per-project results, and workspace-wide error/warning totals.
 */
export async function runBuildMany(opts: BuildManyOptions): Promise<BuildManyResult> {
  const lintable = listProjects(opts.workspaceRoot).filter((p) => p.hasLintTarget);
  const targets = filterProjects({ projects: lintable, include: opts.include, exclude: opts.exclude });

  if (!existsSync(opts.outputDir)) mkdirSync(opts.outputDir, { recursive: true });

  const results: BuildManyProjectResult[] = [];
  const queue = [...targets];
  const total = targets.length;
  let started = 0;

  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const project = queue.shift();
      if (!project) return;
      started += 1;
      const index = started;
      opts.onProgress?.({ kind: 'start', project: project.name, index, total });
      try {
        const { cachePath, cache } = await runBuild({
          project: project.name,
          workspaceRoot: opts.workspaceRoot,
          outputDir: opts.outputDir,
          nxArgs: opts.nxArgs,
          fix: opts.fix,
          updateIndex: false
        });
        results.push(projectResultFromCache({ project: project.name, cachePath, cache }));
        opts.onProgress?.({ kind: 'done', project: project.name, index, total, cache });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({
          project: project.name,
          cachePath: undefined,
          errorCount: undefined,
          warningCount: undefined,
          filesWithIssues: undefined,
          generatedAt: undefined,
          error: message
        });
        opts.onProgress?.({ kind: 'error', project: project.name, index, total, error: message });
        if (!opts.continueOnError) throw e;
      }
    }
  };

  const pool = Array.from({ length: Math.max(1, opts.concurrency) }, () => worker());
  await Promise.all(pool);

  results.sort((a, b) => a.project.localeCompare(b.project));

  const totalErrors = results.reduce((acc, r) => acc + (r.errorCount ?? 0), 0);
  const totalWarnings = results.reduce((acc, r) => acc + (r.warningCount ?? 0), 0);

  const indexPath = join(opts.outputDir, 'index.json');
  writeFileSync(
    indexPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        projectCount: results.length,
        succeeded: results.filter((r) => r.error == null).length,
        failed: results.filter((r) => r.error != null).length,
        totalErrors,
        totalWarnings,
        projects: results
      },
      null,
      2
    )
  );

  return { indexPath, projects: results, totalErrors, totalWarnings };
}

export interface FilterProjectsInput {
  readonly projects: readonly ProjectInfo[];
  readonly include: readonly string[];
  readonly exclude: readonly string[];
}

/**
 * Returns the subset of `projects` matched by the include/exclude patterns.
 *
 * Patterns with `*` or `?` are treated as globs (`*` ≡ `.*`, `?` ≡ `.`).
 * Plain patterns are substring matches. With no include patterns the result
 * starts with every project; exclude patterns then trim it.
 *
 * @param input - The projects to filter and the include/exclude patterns to apply.
 * @returns A new array with the matched projects in their original order.
 */
export function filterProjects(input: FilterProjectsInput): readonly ProjectInfo[] {
  const includeMatchers = input.include.map(matcherFor);
  const excludeMatchers = input.exclude.map(matcherFor);
  return input.projects.filter((p) => {
    let keep = true;
    if (includeMatchers.length > 0 && !includeMatchers.some((m) => m(p.name))) keep = false;
    if (keep && excludeMatchers.length > 0 && excludeMatchers.some((m) => m(p.name))) keep = false;
    return keep;
  });
}

function matcherFor(pattern: string): (s: string) => boolean {
  let result: (s: string) => boolean;
  if (!pattern.includes('*') && !pattern.includes('?')) {
    result = (s) => s.includes(pattern);
  } else {
    const re = globToRegExp(pattern);
    result = (s) => re.test(s);
  }
  return result;
}

function globToRegExp(pattern: string): RegExp {
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i] as string;
    if (ch === '*') {
      regex += '.*';
      i += 1;
    } else if (ch === '?') {
      regex += '.';
      i += 1;
    } else if ('.+^$()|[]{}\\/'.includes(ch)) {
      regex += `\\${ch}`;
      i += 1;
    } else {
      regex += ch;
      i += 1;
    }
  }
  return new RegExp(`^${regex}$`);
}

export interface ProjectResultFromCacheInput {
  readonly project: string;
  readonly cachePath: string;
  readonly cache: LintCache;
}

/**
 * Builds a `BuildManyProjectResult` from a single project's cache file.
 *
 * Shared by `runBuildMany` (collecting per-project results) and `runBuild`
 * (patching the matching entry in `index.json` when present).
 *
 * @param input - The project name, written cache path, and parsed cache.
 * @returns A populated `BuildManyProjectResult` with `error` set to `undefined`.
 */
export function projectResultFromCache(input: ProjectResultFromCacheInput): BuildManyProjectResult {
  return {
    project: input.project,
    cachePath: input.cachePath,
    errorCount: input.cache.errorCount,
    warningCount: input.cache.warningCount,
    filesWithIssues: input.cache.filesWithIssues,
    generatedAt: input.cache.generatedAt,
    error: undefined
  };
}

export interface PatchIndexEntryInput {
  readonly outputDir: string;
  readonly entry: BuildManyProjectResult;
}

/**
 * Patches the matching project entry inside `<outputDir>/index.json`
 * after a single-project rebuild, so the aggregate index stays consistent
 * with the per-project cache that was just written.
 *
 * No-op when `index.json` does not exist yet (single-project `build` runs
 * are valid before any `build-many` has produced an index). Recomputes the
 * top-level `totalErrors` / `totalWarnings` / `succeeded` / `failed`
 * counters but does NOT touch the index-level `generatedAt` — that
 * represents the last full `build-many` run.
 *
 * @param input - The output directory containing `index.json` and the project entry to patch in.
 * @returns `true` if `index.json` existed and was patched; `false` if no index was present.
 */
export function patchIndexEntry(input: PatchIndexEntryInput): boolean {
  const indexPath = join(input.outputDir, 'index.json');
  let patched = false;
  if (existsSync(indexPath)) {
    const index = JSON.parse(readFileSync(indexPath, 'utf8')) as LintCacheIndex;
    const projects = [...index.projects];
    const existingIdx = projects.findIndex((p) => p.project === input.entry.project);
    if (existingIdx >= 0) {
      projects[existingIdx] = input.entry;
    } else {
      projects.push(input.entry);
      projects.sort((a, b) => a.project.localeCompare(b.project));
    }

    const next: LintCacheIndex = {
      schemaVersion: 1,
      generatedAt: index.generatedAt,
      projectCount: projects.length,
      succeeded: projects.filter((p) => p.error == null).length,
      failed: projects.filter((p) => p.error != null).length,
      totalErrors: projects.reduce((acc, r) => acc + (r.errorCount ?? 0), 0),
      totalWarnings: projects.reduce((acc, r) => acc + (r.warningCount ?? 0), 0),
      projects
    };
    writeFileSync(indexPath, JSON.stringify(next, null, 2));
    patched = true;
  }
  return patched;
}
