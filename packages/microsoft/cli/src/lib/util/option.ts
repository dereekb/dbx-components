import { CliError } from '@dereekb/dbx-cli';
import { type Maybe } from '@dereekb/util';
import { readFile } from 'node:fs/promises';
import type { Argv } from 'yargs';

/**
 * Parses a date option (`2026-01-01`, `2026-01-01T09:00:00Z`), failing with a `CliError` that names the option.
 *
 * @param name - The option name, for the error.
 * @param value - The raw option value.
 * @returns The date, or undefined when the option is not set.
 * @throws {CliError} `INVALID_ARGUMENT` when the value is not a date.
 */
export function parseMsGraphCliDateOption(name: string, value: unknown): Maybe<Date> {
  let result: Maybe<Date>;

  if (value != null && value !== '') {
    const date = new Date(String(value));

    if (Number.isNaN(date.getTime())) {
      throw new CliError({ message: `--${name} "${String(value)}" is not a date.`, code: 'INVALID_ARGUMENT', suggestion: `Use an ISO 8601 date or instant, e.g. --${name} 2026-01-01 or --${name} 2026-01-01T09:00:00Z` });
    }

    result = date;
  }

  return result;
}

/**
 * Splits an ids file's content: ids separated by whitespace, commas or new lines; a JSON array of ids, or of objects
 * with a string `id` (e.g. messages); or msgraph-cli's own JSON output of a list or search (`{ "ok": true, "data": [...] }`,
 * or a page `{ "data": { "value": [...] } }`), so `mail list … --all-pages --pick id > ids.json` feeds
 * `--ids-file ids.json` with no jq.
 *
 * @param content - The file content.
 * @returns The ids, blanks dropped.
 * @throws {CliError} `INVALID_ARGUMENT` when the JSON is not one of those shapes, or an item has no string id.
 */
export function parseMsGraphCliIdsFileContent(content: string): string[] {
  const trimmed = content.trim();
  let result: string[];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new CliError({ message: 'The ids file starts like JSON but does not parse.', code: 'INVALID_ARGUMENT', suggestion: 'Use one id per line, a JSON array of ids, or the JSON output of mail list / mail search.' });
    }

    // unwrap msgraph-cli output ({ ok, data }) and a Graph page ({ value })
    let items: unknown = parsed;

    if (items != null && !Array.isArray(items) && typeof items === 'object' && 'data' in items) {
      items = (items as { readonly data: unknown }).data;
    }

    if (items != null && !Array.isArray(items) && typeof items === 'object' && 'value' in items) {
      items = (items as { readonly value: unknown }).value;
    }

    if (!Array.isArray(items)) {
      throw new CliError({ message: 'The ids file is JSON but holds no array of ids.', code: 'INVALID_ARGUMENT', suggestion: 'Use a JSON array of ids or of objects with "id", or the JSON output of mail list / mail search (with --all-pages).' });
    }

    result = items.map((x) => {
      const id = typeof x === 'string' ? x : (x as Maybe<{ readonly id?: unknown }>)?.id;

      if (typeof id !== 'string') {
        throw new CliError({ message: 'An item in the ids file is neither a string nor an object with a string "id".', code: 'INVALID_ARGUMENT' });
      }

      return id;
    });
  } else {
    result = trimmed.split(/[\s,]+/);
  }

  return result.filter((x) => x.length > 0);
}

/**
 * Reads the ids a command acts on: the positional ids, then those in `--ids-file`.
 *
 * @param input - The positional ids and the ids file path.
 * @param input.ids - The positional ids.
 * @param input.idsFile - A file of ids (see {@link parseMsGraphCliIdsFileContent}).
 * @param input.suggestion - The suggestion of the `No ids given.` refusal, instead of the default.
 * @returns The ids, in order.
 * @throws {CliError} `INVALID_ARGUMENT` when no id is given.
 */
export async function readMsGraphCliIdsOption(input: { readonly ids?: Maybe<readonly unknown[]>; readonly idsFile?: Maybe<string>; readonly suggestion?: Maybe<string> }): Promise<string[]> {
  const ids = (input.ids ?? []).map(String).filter((x) => x.length > 0);

  if (input.idsFile) {
    ids.push(...parseMsGraphCliIdsFileContent(await readFile(input.idsFile, 'utf8')));
  }

  if (ids.length === 0) {
    throw new CliError({ message: 'No ids given.', code: 'INVALID_ARGUMENT', suggestion: input.suggestion ?? 'Pass ids as arguments or with --ids-file <file> (one per line, or a JSON array).' });
  }

  return ids;
}

/**
 * Adds the options every mail command shares: `--mailbox` and `--mutable-ids`.
 *
 * @param yargs - The command's yargs.
 * @returns The yargs, with the options added.
 */
export function msGraphCliMailboxOptions<T>(yargs: Argv<T>) {
  return yargs
    .option('mailbox', { type: 'string', describe: "Another mailbox's address (shared or delegated; needs the *.Shared scopes and an Exchange permission). Default: your own" })
    .option('mutable-ids', { type: 'boolean', default: false, describe: 'Return default ids, which change when a message moves folder, instead of immutable ids' });
}

/**
 * Adds `--all-pages` and `--max-pages`.
 *
 * @param yargs - The command's yargs.
 * @returns The yargs, with the options added.
 */
export function msGraphCliPagingOptions<T>(yargs: Argv<T>) {
  return yargs.option('all-pages', { type: 'boolean', default: false, describe: 'Follow @odata.nextLink and print every item as one array' }).option('max-pages', { type: 'number', describe: 'With --all-pages: stop after this many pages (default 20)' });
}
