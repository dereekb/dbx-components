import type { Argv } from 'yargs';

export interface EnvOptions {
  readonly env?: string;
}

export function withEnv<T>(yargs: Argv<T>): Argv<T & EnvOptions> {
  return yargs.option('env', {
    type: 'string',
    describe: 'Named env to target (overrides activeEnv in config and the *_ENV var)'
  }) as unknown as Argv<T & EnvOptions>;
}

export interface OutputOptions {
  readonly dumpDir?: string;
  readonly pick?: string;
  readonly pickAll?: boolean;
}

export function withOutput<T>(yargs: Argv<T>): Argv<T & OutputOptions> {
  return yargs.option('dump-dir', { type: 'string', describe: 'Directory to save full responses as JSON files (overrides config)' }).option('pick', { type: 'string', describe: 'Comma-separated top-level fields to include in output (overrides config)' }).option('pick-all', { type: 'boolean', describe: 'Ignore any configured pick filters and return full response data' }) as unknown as Argv<T & OutputOptions>;
}

/**
 * Dump file format for {@link runPaginatedList} when `--dump-dir` is set.
 *
 * - `raw`: one full JSON page response (concatenated JSON when `--dump-merge=concat`, not standard JSON).
 * - `page_by_line`: NDJSON with one page response per line.
 * - `data_by_line`: NDJSON with one record per line.
 */
export const DUMP_OUTPUT_MODES = ['raw', 'page_by_line', 'data_by_line'] as const;
export type DumpOutputMode = (typeof DUMP_OUTPUT_MODES)[number];

/**
 * Across-pages dump merge mode for {@link runPaginatedList}.
 *
 * - `replace`: truncate the file each iteration; only the last page survives.
 * - `concat`: append each page to the file.
 */
export const DUMP_MERGE_MODES = ['replace', 'concat'] as const;
export type DumpMergeMode = (typeof DUMP_MERGE_MODES)[number];

/**
 * Stdout shape when `--multiple-pages > 1`.
 *
 * - `meta`: summary only (low memory).
 * - `pages`: array of page responses (holds all pages in memory).
 * - `merged_page`: concat all records into one array (holds all records in memory).
 */
export const MULTIPLE_PAGES_OUTPUT_MODES = ['meta', 'pages', 'merged_page'] as const;
export type MultiplePagesOutputMode = (typeof MULTIPLE_PAGES_OUTPUT_MODES)[number];

export interface MultiplePagesOptions {
  readonly multiplePages: number;
  readonly multiplePagesOutput: MultiplePagesOutputMode;
  readonly dumpOutput: DumpOutputMode;
  readonly dumpMerge: DumpMergeMode;
}

/**
 * Adds the multi-page pagination flag set shared by every paginated list command.
 *
 * Compose from a CLI-specific page/offset builder (e.g. Zoho's `withPagination` adds
 * `--page` / `--per-page`, then chains this for the multi-page controls).
 */
export function withMultiplePages<T>(yargs: Argv<T>): Argv<T & MultiplePagesOptions> {
  return yargs
    .option('multiple-pages', {
      type: 'number',
      default: 1,
      describe: 'Pages to fetch in this invocation (>=1). Continues from the per-API page/offset flag.'
    })
    .option('multiple-pages-output', {
      type: 'string',
      choices: MULTIPLE_PAGES_OUTPUT_MODES,
      default: 'meta',
      describe: 'Stdout shape when multiple-pages > 1: meta (summary, low memory), pages (array of page responses, WARNING: holds all pages in memory), merged_page (concat all records into one array, WARNING: holds all records in memory).'
    })
    .option('dump-output', {
      type: 'string',
      choices: DUMP_OUTPUT_MODES,
      default: 'raw',
      describe: 'Dump file format when --dump-dir is set. raw: one full JSON page response (concatenated JSON when --dump-merge=concat, not standard JSON). page_by_line: NDJSON of page responses. data_by_line: NDJSON of records.'
    })
    .option('dump-merge', {
      type: 'string',
      choices: DUMP_MERGE_MODES,
      default: 'replace',
      describe: 'Across pages with multiple-pages > 1: replace (truncate file each iteration; only last page survives) or concat (append).'
    }) as unknown as Argv<T & MultiplePagesOptions>;
}

export interface CallModelArgs {
  readonly model: string;
  readonly verb: string;
  readonly specifier?: string;
  readonly data?: string;
}

/**
 * Adds the standard generic-call positional + flag set: `<model> <verb> [specifier]` plus `--data <json>`.
 */
export function withCallModelArgs<T>(yargs: Argv<T>): Argv<T & CallModelArgs> {
  return yargs
    .positional('model', { type: 'string', demandOption: true, describe: 'Firestore model type (e.g. profile, guestbook)' })
    .positional('verb', {
      type: 'string',
      demandOption: true,
      describe: 'CRUD verb or custom action type (create, read, update, delete, query, or app-specific)'
    })
    .positional('specifier', { type: 'string', describe: 'Optional sub-function specifier' })
    .option('data', { type: 'string', describe: 'JSON-encoded payload (defaults to {} when omitted)' }) as unknown as Argv<T & CallModelArgs>;
}
