import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphChat, type MicrosoftGraphItemBody, MICROSOFT_GRAPH_TEAMS_SEND_MIN_INTERVAL_MS, MicrosoftGraphError } from '@dereekb/microsoft';
import { type Maybe, type Milliseconds, waitForMs } from '@dereekb/util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MSGRAPH_CLI_NAME } from '../config/cli.config';
import { isMsGraphCliHtmlFile } from './mail.write';

/**
 * The file in the config dir holding the time of the last Teams send, so separate runs keep to 1 per second.
 */
export const MSGRAPH_CLI_TEAMS_SEND_STATE_FILE_NAME = 'teams.last-send.json';

/**
 * The terms-of-use note every Teams send command's help carries.
 */
export const MSGRAPH_CLI_TEAMS_TERMS_NOTE = 'Teams takes at most 1 message per second per chat or channel and per user, and Microsoft forbids using Teams as a log file, so there is no bulk or repeat mode.';

export interface MsGraphCliTeamsSendGateConfig {
  readonly configDir: string;
  readonly minInterval?: Maybe<Milliseconds>;
  /**
   * The clock. Defaults to `Date.now`; a spec passes a fake.
   */
  readonly now?: Maybe<() => number>;
  /**
   * Waits. Defaults to a real timer; a spec passes one that advances the fake clock.
   */
  readonly wait?: Maybe<(ms: Milliseconds) => Promise<unknown>>;
}

/**
 * Waits until at least `minInterval` (1 second) has passed since the last Teams send of any msgraph-cli run,
 * then records this send. Agents that call the CLI in a loop stay under Teams' 1 message per second limit.
 *
 * @param config - The config dir, interval, clock and wait.
 * @returns How long it waited.
 */
export async function awaitMsGraphCliTeamsSendSlot(config: MsGraphCliTeamsSendGateConfig): Promise<Milliseconds> {
  const now = config.now ?? Date.now;
  const wait = config.wait ?? waitForMs;
  const path = join(config.configDir, MSGRAPH_CLI_TEAMS_SEND_STATE_FILE_NAME);
  let lastSendAt = 0;

  try {
    lastSendAt = Number((JSON.parse(await readFile(path, 'utf8')) as { lastSendAt?: unknown }).lastSendAt) || 0;
  } catch {
    // no earlier send
  }

  const waited = Math.max(0, lastSendAt + (config.minInterval ?? MICROSOFT_GRAPH_TEAMS_SEND_MIN_INTERVAL_MS) - now());

  if (waited > 0) {
    await wait(waited);
  }

  await mkdir(config.configDir, { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify({ lastSendAt: now() }), { mode: 0o600 });
  return waited;
}

/**
 * Turns the 403 of an admin-consent-only Teams call into a `SCOPE_DENIED` that explains no standard preset grants the scope.
 *
 * @param error - The thrown value.
 * @param scope - The admin-consent scope the call needs.
 * @returns The mapped error, or the original when it is not a 403.
 */
export function msGraphCliTeamsAdminScopeError(error: unknown, scope: string): unknown {
  let result = error;

  if (error instanceof MicrosoftGraphError && error.status === 403) {
    result = new CliError({
      message: error.message,
      code: 'SCOPE_DENIED',
      suggestion: `This call needs ${scope}, which needs admin consent. Neither standard preset (Read, Read + Write) grants it, so the call only works through a token source whose connection a tenant admin consented with ${scope} for the organization. Compare the token's scopes with: ${MSGRAPH_CLI_NAME} auth show`
    });
  }

  return result;
}

/**
 * Runs an admin-consent-only call, mapping its 403 to the Admin-preset suggestion.
 *
 * @param scope - The admin-consent scope the call needs.
 * @param run - The call.
 * @returns The call's result.
 */
export async function runMsGraphCliTeamsAdminCall<T>(scope: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw msGraphCliTeamsAdminScopeError(e, scope);
  }
}

/**
 * Reads a Teams message body from `--text`, `--html` or `--file` (.html / .htm as HTML).
 *
 * @param input - The options.
 * @param input.text - Plain text.
 * @param input.html - HTML.
 * @param input.file - A file to read.
 * @returns The body.
 * @throws {CliError} `INVALID_ARGUMENT` unless exactly one is given.
 */
export async function readMsGraphCliTeamsBody(input: { readonly text?: Maybe<string>; readonly html?: Maybe<string>; readonly file?: Maybe<string> }): Promise<MicrosoftGraphItemBody> {
  const given = [input.text, input.html, input.file].filter((x) => x != null && x !== '');

  if (given.length !== 1) {
    throw new CliError({ message: 'Pass exactly one of --text, --html or --file.', code: 'INVALID_ARGUMENT' });
  }

  let result: MicrosoftGraphItemBody;

  if (input.file) {
    result = { contentType: isMsGraphCliHtmlFile(input.file) ? 'html' : 'text', content: await readFile(input.file, 'utf8') };
  } else if (input.html) {
    result = { contentType: 'html', content: input.html };
  } else {
    result = { contentType: 'text', content: String(input.text) };
  }

  return result;
}

/**
 * Parses `--with` for `teams chats` and `teams chat dump`: repeatable or comma-separated, each name trimmed and
 * blanks dropped.
 *
 * @param value - The option value: a string, an array of strings, or nothing.
 * @returns The names, in the order given.
 */
export function parseMsGraphCliTeamsWithNames(value: unknown): string[] {
  let values: unknown[];

  if (value == null) {
    values = [];
  } else if (Array.isArray(value)) {
    values = value;
  } else {
    values = [value];
  }

  return values
    .flatMap((x) => String(x).split(','))
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * What `teams chats` prints per chat: the members' names only, never their ids.
 */
export interface MsGraphCliChatOutput {
  readonly id: string;
  readonly topic?: Maybe<string>;
  readonly chatType?: Maybe<string>;
  readonly lastUpdatedDateTime?: Maybe<string>;
  readonly webUrl?: Maybe<string>;
  readonly members: string[];
}

/**
 * Builds the printed form of a chat.
 *
 * @param chat - The chat with its members.
 * @returns The output.
 */
export function msGraphCliChatOutput(chat: MicrosoftGraphChat): MsGraphCliChatOutput {
  return { id: chat.id, topic: chat.topic, chatType: chat.chatType, lastUpdatedDateTime: chat.lastUpdatedDateTime, webUrl: chat.webUrl, members: (chat.members ?? []).map((x) => x.displayName ?? x.email ?? '?') };
}
