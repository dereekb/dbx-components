/**
 * Shared types for the `dbx_log_search` tool.
 */

/**
 * Reference to a single change-log file on disk discovered by {@link discoverLogs}.
 * Holds the metadata needed for filtering (mtime) and rendering (project, name)
 * without forcing a content read.
 */
export interface LogFileRef {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly project: string;
  readonly fileName: string;
  readonly mtimeMs: number;
  readonly sizeBytes: number;
}

/**
 * Parsed shape of a change-log markdown file. All section fields may be
 * `undefined` because logs are user-written and the format is enforced only at
 * Stop-time — historical entries may omit any section.
 */
export interface ParsedLog {
  readonly ref: LogFileRef;
  readonly title: string;
  readonly date: string | undefined;
  readonly summary: string | undefined;
  readonly commitSubject: string | undefined;
  readonly commitBody: string | undefined;
  readonly rawText: string;
}

export type LogSearchMode = 'fuzzy' | 'keyword' | 'list';
