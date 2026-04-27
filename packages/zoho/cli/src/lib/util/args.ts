import type { Argv } from 'yargs';

// MARK: Multi-page flags
export const DUMP_OUTPUT_MODES = ['raw', 'page_by_line', 'data_by_line'] as const;
export type DumpOutputMode = (typeof DUMP_OUTPUT_MODES)[number];

export const DUMP_MERGE_MODES = ['replace', 'concat'] as const;
export type DumpMergeMode = (typeof DUMP_MERGE_MODES)[number];

export const MULTIPLE_PAGES_OUTPUT_MODES = ['meta', 'pages', 'merged_page'] as const;
export type MultiplePagesOutputMode = (typeof MULTIPLE_PAGES_OUTPUT_MODES)[number];

export interface MultiplePagesOptions {
  readonly multiplePages: number;
  readonly multiplePagesOutput: MultiplePagesOutputMode;
  readonly dumpOutput: DumpOutputMode;
  readonly dumpMerge: DumpMergeMode;
}

/**
 * Adds multi-page pagination flags shared by every paginated list command.
 *
 * Used by both {@link withPagination} (CRM/Recruit page-based) and
 * {@link withDeskPagination} (Desk offset-based).
 */
export function withMultiplePages<T>(yargs: Argv<T>): Argv<T & MultiplePagesOptions> {
  return yargs
    .option('multiple-pages', {
      type: 'number',
      default: 1,
      describe: 'Pages to fetch in this invocation (>=1). Continues from --page (CRM/Recruit) or --from (Desk).'
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

export interface PaginationOptions {
  readonly page: number;
  readonly perPage: number;
}

export function withPagination<T>(yargs: Argv<T>): Argv<T & PaginationOptions & MultiplePagesOptions> {
  return withMultiplePages(yargs.option('page', { type: 'number', default: 1, describe: 'Page number (1-based)' }).option('per-page', { type: 'number', default: 20, describe: 'Records per page' })) as unknown as Argv<T & PaginationOptions & MultiplePagesOptions>;
}

export interface DeskPaginationOptions {
  readonly from: number;
  readonly limit: number;
}

export function withDeskPagination<T>(yargs: Argv<T>): Argv<T & DeskPaginationOptions & MultiplePagesOptions> {
  return withMultiplePages(yargs.option('from', { type: 'number', default: 1, describe: 'Start index (1-based)' }).option('limit', { type: 'number', default: 25, describe: 'Max records (max 50)' })) as unknown as Argv<T & DeskPaginationOptions & MultiplePagesOptions>;
}

export interface ModuleOptions {
  readonly module: string;
}

export function withModule<T>(yargs: Argv<T>): Argv<T & ModuleOptions> {
  return yargs.option('module', {
    alias: 'm',
    type: 'string',
    demandOption: true,
    describe: 'Zoho module name (e.g. Candidates, Contacts, Leads)'
  }) as unknown as Argv<T & ModuleOptions>;
}

export interface RecordIdOptions {
  readonly id: string;
}

export function withRecordId<T>(yargs: Argv<T>): Argv<T & RecordIdOptions> {
  return yargs.option('id', {
    type: 'string',
    demandOption: true,
    describe: 'Record ID'
  }) as unknown as Argv<T & RecordIdOptions>;
}

export interface FieldsOptions {
  readonly fields?: string;
}

export function withFields<T>(yargs: Argv<T>, required = false): Argv<T & FieldsOptions> {
  return yargs.option('fields', {
    type: 'string',
    demandOption: required,
    describe: 'Comma-separated field names to return'
  }) as unknown as Argv<T & FieldsOptions>;
}

export interface SortOptions {
  readonly sortBy?: string;
  readonly sortOrder?: string;
}

export function withSort<T>(yargs: Argv<T>): Argv<T & SortOptions> {
  return yargs.option('sort-by', { type: 'string', describe: 'Field to sort by' }).option('sort-order', { type: 'string', choices: ['asc', 'desc'] as const, describe: 'Sort direction' }) as unknown as Argv<T & SortOptions>;
}
