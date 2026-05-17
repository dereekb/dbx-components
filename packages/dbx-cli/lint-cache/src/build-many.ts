import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runBuild } from './build';
import { listProjects, type ProjectInfo } from './project-lookup';
import type { LintCache } from './types';

export interface BuildManyOptions {
  readonly workspaceRoot: string;
  readonly outputDir: string;
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly concurrency: number;
  readonly continueOnError: boolean;
  readonly nxArgs: readonly string[] | undefined;
  readonly fix: boolean;
  readonly onProgress: ((event: BuildManyProgressEvent) => void) | undefined;
}

export type BuildManyProgressEvent = { readonly kind: 'start'; readonly project: string; readonly index: number; readonly total: number } | { readonly kind: 'done'; readonly project: string; readonly index: number; readonly total: number; readonly cache: LintCache } | { readonly kind: 'error'; readonly project: string; readonly index: number; readonly total: number; readonly error: string };

export interface BuildManyProjectResult {
  readonly project: string;
  readonly cachePath: string | undefined;
  readonly errorCount: number | undefined;
  readonly warningCount: number | undefined;
  readonly filesWithIssues: number | undefined;
  readonly error: string | undefined;
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
 */
export async function runBuildMany(opts: BuildManyOptions): Promise<BuildManyResult> {
  const lintable = listProjects(opts.workspaceRoot).filter((p) => p.hasLintTarget);
  const targets = filterProjects(lintable, opts.include, opts.exclude);

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
          fix: opts.fix
        });
        results.push({
          project: project.name,
          cachePath,
          errorCount: cache.errorCount,
          warningCount: cache.warningCount,
          filesWithIssues: cache.filesWithIssues,
          error: undefined
        });
        opts.onProgress?.({ kind: 'done', project: project.name, index, total, cache });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({
          project: project.name,
          cachePath: undefined,
          errorCount: undefined,
          warningCount: undefined,
          filesWithIssues: undefined,
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

/**
 * Returns the subset of `projects` matched by the include/exclude patterns.
 * Patterns with `*` or `?` are treated as globs (`*` ≡ `.*`, `?` ≡ `.`).
 * Plain patterns are substring matches. With no include patterns the result
 * starts with every project; exclude patterns then trim it.
 */
export function filterProjects(projects: readonly ProjectInfo[], include: readonly string[], exclude: readonly string[]): readonly ProjectInfo[] {
  const includeMatchers = include.map(matcherFor);
  const excludeMatchers = exclude.map(matcherFor);
  return projects.filter((p) => {
    if (includeMatchers.length > 0 && !includeMatchers.some((m) => m(p.name))) return false;
    if (excludeMatchers.length > 0 && excludeMatchers.some((m) => m(p.name))) return false;
    return true;
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
