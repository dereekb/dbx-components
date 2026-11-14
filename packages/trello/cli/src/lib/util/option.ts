import { CliError } from '@dereekb/dbx-cli';
import { TRELLO_API_URL, type TrelloBoardId, type TrelloCardId, type TrelloContext, type TrelloList, type TrelloPosition, listBoardLists, matchTrelloList, parseTrelloCardRef } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import { readFile } from 'node:fs/promises';
import type { Argv } from 'yargs';

/**
 * Matches a Trello board url and captures its shortLink.
 */
export const TRELLO_BOARD_URL_REGEX = /https?:\/\/trello\.com\/b\/([A-Za-z0-9_-]+)/;

/**
 * The hosts `--api-url` (and an absolute `request` url) may point at: Trello's own api host, or loopback for a local
 * fake. Anything else would send the credentials off-host.
 */
export const TRELLO_CLI_ALLOWED_API_HOSTS: readonly string[] = ['api.trello.com', '127.0.0.1', 'localhost', '[::1]', '::1'];

/**
 * Parses a card argument — a card link, a shortLink, or a card id — into the value every card api accepts.
 *
 * @param value - The argument as typed.
 * @returns The shortLink or id.
 * @throws {CliError} `INVALID_ARGUMENT` when the value is not a card reference.
 */
export function parseTrelloCliCardArg(value: unknown): TrelloCardId {
  const text = value == null ? undefined : String(value);
  const parsed = parseTrelloCardRef(text);

  if (!parsed) {
    throw new CliError({ message: `"${String(value)}" is not a card link, shortLink or id.`, code: 'INVALID_ARGUMENT', suggestion: 'Pass https://trello.com/c/<shortLink>/…, the 8-character shortLink, or the 24-character card id.' });
  }

  return parsed;
}

/**
 * Parses a board argument — a board link, a shortLink, or a board id — into the value every board api accepts.
 *
 * @param value - The argument as typed.
 * @returns The shortLink or id, or undefined for an empty value.
 * @throws {CliError} `INVALID_ARGUMENT` when the value is not a board reference.
 */
export function parseTrelloCliBoardArg(value: unknown): Maybe<TrelloBoardId> {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  let result: Maybe<TrelloBoardId>;

  if (trimmed.length > 0) {
    const linked = TRELLO_BOARD_URL_REGEX.exec(trimmed)?.[1];
    result = linked ?? (/^[A-Za-z0-9]+$/.test(trimmed) ? trimmed : undefined);

    if (result == null) {
      throw new CliError({ message: `"${trimmed}" is not a board link, shortLink or id.`, code: 'INVALID_ARGUMENT', suggestion: 'Pass https://trello.com/b/<shortLink>/…, the board shortLink, or the 24-character board id.' });
    }
  }

  return result;
}

/**
 * Splits a comma-separated option (or a repeated one) into its trimmed, non-empty values.
 *
 * @param value - The option value(s).
 * @returns The values, or an empty array.
 */
export function parseTrelloCliListOption(value: unknown): string[] {
  let values: unknown[] = [];

  if (Array.isArray(value)) {
    values = value;
  } else if (value != null) {
    values = [value];
  }

  return values
    .flatMap((x) => String(x).split(','))
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/**
 * Parses a JSON option.
 *
 * @param name - The option name, for the error.
 * @param value - The option value.
 * @returns The parsed value, or undefined when the option was not given.
 * @throws {CliError} `INVALID_ARGUMENT` on invalid JSON.
 */
export function parseTrelloCliJsonOption<T>(name: string, value: unknown): Maybe<T> {
  let result: Maybe<T>;

  if (typeof value === 'string' && value.trim()) {
    try {
      result = JSON.parse(value) as T;
    } catch {
      throw new CliError({ message: `--${name} is not valid JSON.`, code: 'INVALID_ARGUMENT', suggestion: `Quote it as one argument, e.g. --${name} '{"fields":"name"}'` });
    }
  }

  return result;
}

/**
 * Input for {@link readTrelloCliTextOption}.
 */
export interface TrelloCliTextOptionInput {
  /**
   * The inline value (e.g. `--desc`).
   */
  readonly value?: unknown;
  /**
   * The path to read instead (e.g. `--desc-file`). Wins over `value`.
   */
  readonly file?: unknown;
}

/**
 * Reads a text value from either an inline option or a file option (e.g. `--desc` / `--desc-file`).
 *
 * @param input - The inline value and the file path.
 * @returns The text, or undefined when neither was given.
 */
export async function readTrelloCliTextOption(input: TrelloCliTextOptionInput): Promise<Maybe<string>> {
  let result: Maybe<string>;

  if (typeof input.file === 'string' && input.file.length > 0) {
    result = await readFile(input.file, 'utf8');
  } else if (input.value != null) {
    result = String(input.value);
  }

  return result;
}

/**
 * Validates `--api-url`: an absolute http(s) url on Trello's api host or loopback.
 *
 * @param value - The option value.
 * @returns The url without a trailing slash, or undefined when the option was not given.
 * @throws {CliError} `INVALID_ARGUMENT` for any other host.
 */
export function parseTrelloCliApiUrl(value: unknown): Maybe<string> {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  let result: Maybe<string>;

  if (trimmed.length > 0) {
    let url: Maybe<URL>;

    try {
      url = new URL(trimmed);
    } catch {
      url = undefined;
    }

    if (url == null || (url.protocol !== 'https:' && url.protocol !== 'http:') || !isTrelloCliAllowedApiHost(url.hostname)) {
      throw new CliError({ message: `--api-url "${trimmed}" is not allowed.`, code: 'INVALID_ARGUMENT', suggestion: `Use ${TRELLO_API_URL} (the default) or a loopback url (http://127.0.0.1:<port>/1) for a local fake.` });
    }

    result = trimmed.replace(/\/+$/, '');
  }

  return result;
}

/**
 * Whether a hostname is one `--api-url` may point at.
 *
 * @param hostname - The url hostname.
 * @returns True for api.trello.com or loopback.
 */
export function isTrelloCliAllowedApiHost(hostname: string): boolean {
  return TRELLO_CLI_ALLOWED_API_HOSTS.includes(hostname.toLowerCase());
}

/**
 * Requires `--yes` for a destructive command.
 *
 * @param argv - The parsed arguments.
 * @param action - What the command would do, for the error.
 * @throws {CliError} `CONFIRMATION_REQUIRED` without `--yes`.
 */
export function requireTrelloCliConfirmation(argv: Readonly<Record<string, unknown>>, action: string): void {
  if (argv['yes'] !== true) {
    throw new CliError({ message: `${action} needs --yes.`, code: 'CONFIRMATION_REQUIRED', suggestion: 'Re-run with --yes to confirm.' });
  }
}

/**
 * Input for {@link resolveTrelloCliList}.
 */
export interface ResolveTrelloCliListInput {
  readonly trelloContext: TrelloContext;
  /**
   * The board to match a list name on. Not needed for a list id.
   */
  readonly boardId: Maybe<TrelloBoardId>;
  /**
   * The list as typed: its id or its name.
   */
  readonly list: string;
  /**
   * The board's lists, when already loaded.
   */
  readonly lists?: Maybe<readonly TrelloList[]>;
}

/**
 * Resolves a list argument — a list id, or a list name matched case-insensitively, ignoring a trailing "(…)" note — on a board.
 *
 * A 24-hex value is used as an id as-is. Anything else is matched against the board's open lists with `matchTrelloList`.
 *
 * @param input - The context, the board, and the list as typed.
 * @returns The list id.
 * @throws {CliError} `INVALID_ARGUMENT` / `BOARD_REQUIRED` when the list cannot be resolved.
 */
export async function resolveTrelloCliList(input: ResolveTrelloCliListInput): Promise<TrelloList | { readonly id: string }> {
  const { list } = input;
  let result: TrelloList | { readonly id: string };

  if (/^[a-f0-9]{24}$/i.test(list)) {
    result = { id: list };
  } else {
    if (input.boardId == null) {
      throw new CliError({ message: `Resolving the list "${list}" by name needs a board.`, code: 'BOARD_REQUIRED', suggestion: 'Pass --board <id|shortLink|url>, set one with: trello-cli config set default-board <board>, or pass the list id.' });
    }

    const lists = input.lists ?? (await listBoardLists(input.trelloContext)({ boardId: input.boardId, filter: 'open' }));
    const match = matchTrelloList({ lists, list });

    if (!match.ok) {
      throw new CliError({ message: match.message, code: 'INVALID_ARGUMENT', suggestion: `Run: trello-cli board lists to see the board's lists.` });
    }

    result = match.list;
  }

  return result;
}

/**
 * Parses a `--pos` option: `top`, `bottom`, or a number.
 *
 * @param value - The option value.
 * @returns The position, or undefined when the option was not given.
 * @throws {CliError} `INVALID_ARGUMENT` for anything else.
 */
export function parseTrelloCliPosition(value: unknown): TrelloPosition | undefined {
  let result: TrelloPosition | undefined;

  if (value != null && value !== '') {
    const text = String(value).trim().toLowerCase();
    const number = Number(text);

    if (text === 'top' || text === 'bottom') {
      result = text;
    } else if (Number.isFinite(number)) {
      result = number;
    } else {
      throw new CliError({ message: `--pos "${String(value)}" is not top, bottom or a number.`, code: 'INVALID_ARGUMENT' });
    }
  }

  return result;
}

/**
 * Adds the `<card>` positional every card command takes.
 *
 * @param yargs - The yargs instance.
 * @returns The yargs instance.
 */
export function withTrelloCliCardPositional(yargs: Argv): Argv {
  return yargs.positional('card', { type: 'string', demandOption: true, describe: 'The card: its link, shortLink or id' });
}

/**
 * Makes an attachment file name safe to write: strips control characters and path separators.
 *
 * @param name - The attachment's file name.
 * @returns A file name with no directory part.
 */
export function sanitizeTrelloCliFileName(name: string): string {
  const safe = name
    // eslint-disable-next-line no-control-regex -- strip ASCII control characters from a remote file name
    .replaceAll(/[\x00-\x1f\x7f]/g, '')
    .replaceAll(/[\\/]/g, '-')
    .replace(/^\.+/, '')
    .trim();
  return safe || 'attachment';
}
