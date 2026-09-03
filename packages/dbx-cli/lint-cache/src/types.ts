import type { Maybe } from '@dereekb/util';

/**
 * The lint engines this cache can be built from.
 *
 * `eslint` runs the explicit `lint` target that 90 project.json files declare;
 * `oxlint` runs the `oxlint` target inferred by the `@nx/oxlint` plugin. The two
 * are deliberately additive tiers rather than alternatives — see the
 * `adopt-the-nx-oxlint-plugin` plan (§2.3) for the tier boundary.
 */
export type LintCacheLinter = 'eslint' | 'oxlint';

export const LINT_CACHE_LINTERS: readonly LintCacheLinter[] = ['eslint', 'oxlint'];

export const DEFAULT_LINT_CACHE_LINTER: LintCacheLinter = 'eslint';

/**
 * The Nx target each linter is driven through. `eslint` uses the explicit
 * `@nx/eslint:lint` target; `oxlint` uses the target name pinned for the
 * `@nx/oxlint` plugin in `nx.json`.
 */
export const LINT_CACHE_LINTER_TARGET_NAMES: Readonly<Record<LintCacheLinter, string>> = {
  eslint: 'lint',
  oxlint: 'oxlint'
};

/**
 * Whether each linter's target is *inferred* by an Nx plugin rather than declared
 * in `project.json`.
 *
 * An inferred target exists only in the Nx project graph, so project discovery has
 * to ask Nx for it instead of reading files off disk. This is flagged per linter
 * rather than guessed at (e.g. from "no project declared it") so discovery never
 * fires an unexpected `nx show projects` subprocess for the declared case.
 */
export const LINT_CACHE_LINTER_TARGET_IS_INFERRED: Readonly<Record<LintCacheLinter, boolean>> = {
  eslint: false,
  oxlint: true
};

export interface LintCacheMessage {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly endLine: Maybe<number>;
  readonly endColumn: Maybe<number>;
  readonly ruleId: Maybe<string>;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly fixable: boolean;
  /**
   * Which engine reported this message. Present so a consumer reading a merged
   * view of both caches can answer "which linter found this" without inferring
   * it from the rule id.
   */
  readonly linter: LintCacheLinter;
}

export interface LintCacheRuleSummary {
  readonly rule: string;
  readonly errors: number;
  readonly warnings: number;
  readonly files: number;
}

export interface LintCacheFileSummary {
  readonly filePath: string;
  readonly errors: number;
  readonly warnings: number;
}

export interface LintCache {
  /**
   * Bumped to 2 when the `linter` / `linterVersion` / `targetName` discriminators
   * were added. Readers treat this as a number and do not pin it, so a v1 cache
   * left over from a previous run still parses.
   */
  readonly schemaVersion: 2;
  readonly generatedAt: string;
  readonly project: string;
  readonly projectRoot: string;
  readonly linter: LintCacheLinter;
  readonly linterVersion: string;
  /**
   * The Nx target that produced this cache, e.g. `lint` or `oxlint`.
   */
  readonly targetName: string;
  /**
   * @deprecated Retained so readers written against `schemaVersion: 1` keep
   * resolving a value. Use {@link LintCache.linterVersion} instead.
   */
  readonly eslintVersion: string;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly fixableErrorCount: number;
  readonly fixableWarningCount: number;
  readonly fileCount: number;
  readonly filesWithIssues: number;
  readonly ruleSummaries: readonly LintCacheRuleSummary[];
  readonly fileSummaries: readonly LintCacheFileSummary[];
  readonly messages: readonly LintCacheMessage[];
}

/**
 * Sanitizes a project name into a safe filename stem so the cache file path is predictable.
 *
 * The default (`eslint`) linter keeps the original unsuffixed name so caches written
 * before the oxlint tier existed — and every reader that computes this path itself —
 * continue to resolve. Every other linter gets a `.<linter>` infix so the two tiers
 * can share one cache directory without clobbering each other.
 *
 * @param projectName - The Nx project name (may contain `@` or `/` characters from scoped sub-projects).
 * @param linter - The engine whose cache is being named. Defaults to `eslint`.
 * @returns The sanitized filename, e.g. `my-project.json`, `my-project.oxlint.json`, or `dbx-cli_lint-cache.json`.
 */
export function cacheFileName(projectName: string, linter: LintCacheLinter = DEFAULT_LINT_CACHE_LINTER): string {
  const stem = projectName.replaceAll(/[^A-Za-z0-9._-]/g, '_');
  return linter === DEFAULT_LINT_CACHE_LINTER ? `${stem}.json` : `${stem}.${linter}.json`;
}

/**
 * Returns the aggregate index filename for a linter, following the same
 * back-compatible naming rule as {@link cacheFileName}.
 *
 * @param linter - The engine whose index is being named. Defaults to `eslint`.
 * @returns `index.json` for the default linter, `index.<linter>.json` otherwise.
 */
export function indexFileName(linter: LintCacheLinter = DEFAULT_LINT_CACHE_LINTER): string {
  return linter === DEFAULT_LINT_CACHE_LINTER ? 'index.json' : `index.${linter}.json`;
}
