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
 * Splits an ids file's content: a JSON array of strings, or ids separated by whitespace, commas or new lines.
 *
 * @param content - The file content.
 * @returns The ids, blanks dropped.
 * @throws {CliError} `INVALID_ARGUMENT` when a JSON array holds a non-string.
 */
export function parseMsGraphCliIdsFileContent(content: string): string[] {
  const trimmed = content.trim();
  let result: string[];

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown[];

    if (!Array.isArray(parsed) || parsed.some((x) => typeof x !== 'string')) {
      throw new CliError({ message: 'The ids file is a JSON array but not of strings.', code: 'INVALID_ARGUMENT' });
    }

    result = parsed as string[];
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
 * @returns The ids, in order.
 * @throws {CliError} `INVALID_ARGUMENT` when no id is given.
 */
export async function readMsGraphCliIdsOption(input: { readonly ids?: Maybe<readonly unknown[]>; readonly idsFile?: Maybe<string> }): Promise<string[]> {
  const ids = (input.ids ?? []).map(String).filter((x) => x.length > 0);

  if (input.idsFile) {
    ids.push(...parseMsGraphCliIdsFileContent(await readFile(input.idsFile, 'utf8')));
  }

  if (ids.length === 0) {
    throw new CliError({ message: 'No ids given.', code: 'INVALID_ARGUMENT', suggestion: 'Pass ids as arguments or with --ids-file <file> (one per line, or a JSON array).' });
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
