import { type MultiplePagesOptions, withMultiplePages } from '@dereekb/dbx-cli';
import type { Argv } from 'yargs';

export { DUMP_MERGE_MODES, DUMP_OUTPUT_MODES, MULTIPLE_PAGES_OUTPUT_MODES, type DumpMergeMode, type DumpOutputMode, type MultiplePagesOptions, type MultiplePagesOutputMode, withMultiplePages } from '@dereekb/dbx-cli';

export interface PaginationOptions {
  readonly page: number;
  readonly perPage: number;
}

/**
 * Adds Zoho Recruit/CRM-style 1-based `--page` and `--per-page` options plus the dbx-cli `--all-pages` family to a yargs builder.
 *
 * @param yargs - Yargs builder to extend.
 * @returns The same builder, typed with {@link PaginationOptions} and {@link MultiplePagesOptions}.
 */
export function withPagination<T>(yargs: Argv<T>): Argv<T & PaginationOptions & MultiplePagesOptions> {
  return withMultiplePages(yargs.option('page', { type: 'number', default: 1, describe: 'Page number (1-based)' }).option('per-page', { type: 'number', default: 20, describe: 'Records per page' })) as unknown as Argv<T & PaginationOptions & MultiplePagesOptions>;
}

export interface DeskPaginationOptions {
  readonly from: number;
  readonly limit: number;
}

/**
 * Adds Zoho Desk-style `--from`/`--limit` pagination options (Desk uses an offset+limit window with a max of 50 records) plus the shared multi-page flags.
 *
 * @param yargs - Yargs builder to extend.
 * @returns The same builder, typed with {@link DeskPaginationOptions} and {@link MultiplePagesOptions}.
 */
export function withDeskPagination<T>(yargs: Argv<T>): Argv<T & DeskPaginationOptions & MultiplePagesOptions> {
  return withMultiplePages(yargs.option('from', { type: 'number', default: 1, describe: 'Start index (1-based)' }).option('limit', { type: 'number', default: 25, describe: 'Max records (max 50)' })) as unknown as Argv<T & DeskPaginationOptions & MultiplePagesOptions>;
}

export interface ModuleOptions {
  readonly module: string;
}

/**
 * Adds the required `--module` (alias `-m`) option used by generic record commands to address a Zoho module by name.
 *
 * @param yargs - Yargs builder to extend.
 * @returns The same builder, typed with {@link ModuleOptions}.
 */
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

/**
 * Adds the required `--id` option used by single-record commands to identify the target Zoho record.
 *
 * @param yargs - Yargs builder to extend.
 * @returns The same builder, typed with {@link RecordIdOptions}.
 */
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

/**
 * Adds the `--fields` option used to restrict the set of returned record fields. The flag is optional by default; pass `required = true` for endpoints (such as Zoho's get-record API) that mandate it.
 *
 * @param yargs - Yargs builder to extend.
 * @param required - When `true`, marks `--fields` as `demandOption` so yargs rejects invocations that omit it.
 * @returns The same builder, typed with {@link FieldsOptions}.
 */
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

/**
 * Adds optional `--sort-by` and `--sort-order` options for list commands that support server-side sorting.
 *
 * @param yargs - Yargs builder to extend.
 * @returns The same builder, typed with {@link SortOptions}.
 */
export function withSort<T>(yargs: Argv<T>): Argv<T & SortOptions> {
  return yargs.option('sort-by', { type: 'string', describe: 'Field to sort by' }).option('sort-order', { type: 'string', choices: ['asc', 'desc'] as const, describe: 'Sort direction' }) as unknown as Argv<T & SortOptions>;
}
