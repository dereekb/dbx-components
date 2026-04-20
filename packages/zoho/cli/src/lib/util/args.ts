import type { Argv } from 'yargs';

export interface PaginationOptions {
  readonly page: number;
  readonly perPage: number;
}

export function withPagination<T>(yargs: Argv<T>): Argv<T & PaginationOptions> {
  return yargs.option('page', { type: 'number', default: 1, describe: 'Page number (1-based)' }).option('per-page', { type: 'number', default: 20, describe: 'Records per page' }) as unknown as Argv<T & PaginationOptions>;
}

export interface DeskPaginationOptions {
  readonly from: number;
  readonly limit: number;
}

export function withDeskPagination<T>(yargs: Argv<T>): Argv<T & DeskPaginationOptions> {
  return yargs.option('from', { type: 'number', default: 1, describe: 'Start index (1-based)' }).option('limit', { type: 'number', default: 25, describe: 'Max records (max 50)' }) as unknown as Argv<T & DeskPaginationOptions>;
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
