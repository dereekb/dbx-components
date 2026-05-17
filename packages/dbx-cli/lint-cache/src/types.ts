import type { Maybe } from '@dereekb/util';
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
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly project: string;
  readonly projectRoot: string;
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
 * @param projectName - The Nx project name (may contain `@` or `/` characters from scoped sub-projects).
 * @returns The sanitized filename, e.g. `my-project.json` or `dbx-cli_lint-cache.json`.
 */
export function cacheFileName(projectName: string): string {
  return `${projectName.replaceAll(/[^A-Za-z0-9._-]/g, '_')}.json`;
}
