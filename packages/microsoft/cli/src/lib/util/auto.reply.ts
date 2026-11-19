import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphAutomaticRepliesSetting, type MicrosoftGraphAutomaticRepliesStatus, type MicrosoftGraphContext, type MicrosoftGraphDateTimeTimeZone, type MicrosoftGraphExternalAudienceScope, getMailboxTimeZone, microsoftGraphAutomaticRepliesSettingFields } from '@dereekb/microsoft';
import { type ISO8601DateString, type Maybe } from '@dereekb/util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The file in the config dir holding the automatic-replies setting as it was before the last change.
 */
export const MSGRAPH_CLI_AUTO_REPLY_BACKUP_FILE_NAME = 'auto-reply.backup.json';

export const MSGRAPH_CLI_AUTO_REPLY_STATUSES: readonly MicrosoftGraphAutomaticRepliesStatus[] = ['disabled', 'alwaysEnabled', 'scheduled'];
export const MSGRAPH_CLI_AUTO_REPLY_AUDIENCES: readonly MicrosoftGraphExternalAudienceScope[] = ['none', 'contactsOnly', 'all'];

/**
 * What the backup file holds.
 */
export interface MsGraphCliAutoReplyBackup {
  readonly savedAt: ISO8601DateString;
  readonly setting: MicrosoftGraphAutomaticRepliesSetting;
}

/**
 * Returns the backup file's path.
 *
 * @param configDir - The CLI config dir (`msGraphCliPaths().configDir`).
 * @returns The path.
 */
export function msGraphCliAutoReplyBackupPath(configDir: string): string {
  return join(configDir, MSGRAPH_CLI_AUTO_REPLY_BACKUP_FILE_NAME);
}

/**
 * Saves the setting read before a change, replacing any earlier backup. The file is readable by the user only:
 * it holds the reply messages.
 *
 * @param configDir - The CLI config dir.
 * @param setting - The setting as read from Graph.
 * @param now - The time saved.
 * @returns The backup written.
 */
export async function writeMsGraphCliAutoReplyBackup(configDir: string, setting: MicrosoftGraphAutomaticRepliesSetting, now: Date = new Date()): Promise<MsGraphCliAutoReplyBackup> {
  const backup: MsGraphCliAutoReplyBackup = { savedAt: now.toISOString(), setting: microsoftGraphAutomaticRepliesSettingFields(setting) };
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  await writeFile(msGraphCliAutoReplyBackupPath(configDir), JSON.stringify(backup, null, 2), { mode: 0o600 });
  return backup;
}

/**
 * Reads the saved backup.
 *
 * @param configDir - The CLI config dir.
 * @returns The backup.
 * @throws {CliError} `NOT_FOUND` when no backup was saved.
 */
export async function readMsGraphCliAutoReplyBackup(configDir: string): Promise<MsGraphCliAutoReplyBackup> {
  let content: string;

  try {
    content = await readFile(msGraphCliAutoReplyBackupPath(configDir), 'utf8');
  } catch {
    throw new CliError({ message: 'No automatic-replies backup is saved.', code: 'NOT_FOUND', suggestion: 'A backup is saved by `mail auto-reply set`, `off` or `restore` before each change.' });
  }

  return JSON.parse(content) as MsGraphCliAutoReplyBackup;
}

/**
 * What `mail auto-reply get` prints: the reply messages only on request, else their lengths.
 */
export interface MsGraphCliAutoReplyOutput extends Omit<MicrosoftGraphAutomaticRepliesSetting, 'internalReplyMessage' | 'externalReplyMessage'> {
  readonly internalReplyMessage?: Maybe<string>;
  readonly externalReplyMessage?: Maybe<string>;
  readonly internalReplyMessageChars?: number;
  readonly externalReplyMessageChars?: number;
}

/**
 * Builds the printed form of a setting.
 *
 * @param setting - The setting.
 * @param showMessages - Whether to include the reply messages.
 * @returns The output.
 */
export function msGraphCliAutoReplyOutput(setting: MicrosoftGraphAutomaticRepliesSetting, showMessages: boolean): MsGraphCliAutoReplyOutput {
  const { internalReplyMessage, externalReplyMessage, ...rest } = microsoftGraphAutomaticRepliesSettingFields(setting);
  return showMessages ? { ...rest, internalReplyMessage, externalReplyMessage } : { ...rest, internalReplyMessageChars: internalReplyMessage?.length ?? 0, externalReplyMessageChars: externalReplyMessage?.length ?? 0 };
}

/**
 * A date with no time, e.g. `2026-11-20`.
 */
export const MSGRAPH_CLI_LOCAL_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A wall-clock date-time with no `Z` and no offset, e.g. `2026-11-20T15:00`.
 */
export const MSGRAPH_CLI_LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/**
 * Returns whether a `--start` / `--end` value names no zone: a date (`2026-11-20`) or a wall-clock date-time
 * (`2026-11-20T15:00`) with no `Z` and no offset. Such a value is read in the mailbox's time zone unless a zone
 * option names one, never in the machine's (a cloud sandbox runs in UTC).
 *
 * @param value - The option value.
 * @returns True for a zone-less value.
 */
export function isMsGraphCliZonelessDateTime(value: unknown): boolean {
  const text = value == null ? '' : String(value);
  return MSGRAPH_CLI_LOCAL_DATE_ONLY_PATTERN.test(text) || MSGRAPH_CLI_LOCAL_DATE_TIME_PATTERN.test(text);
}

/**
 * Reads the mailbox's time zone for a zone-less `--start` / `--end`, failing with what to pass instead.
 *
 * @param input - The Graph context and the zone option the command takes, for the suggestion.
 * @param input.graphContext - The Graph context.
 * @param input.option - The command's zone option, e.g. `tz` or `event-tz`.
 * @returns The zone name, e.g. `Central Standard Time`.
 * @throws {CliError} `INVALID_ARGUMENT` when the mailbox time zone cannot be read (it needs `MailboxSettings.Read`) or is not set.
 */
export async function readMsGraphCliMailboxTimeZone(input: { readonly graphContext: MicrosoftGraphContext; readonly option: string }): Promise<string> {
  let zone: Maybe<string>;

  try {
    zone = await getMailboxTimeZone(input.graphContext)();
  } catch {
    zone = undefined;
  }

  if (!zone) {
    throw new CliError({ message: "The start / end name no time zone, and the mailbox's time zone could not be read (it needs MailboxSettings.Read).", code: 'INVALID_ARGUMENT', suggestion: `Pass --${input.option} "<zone>" (e.g. "Pacific Standard Time"), or instants with an offset (2026-11-20T15:00-08:00).` });
  }

  return zone;
}

/**
 * Turns an auto-reply window value into a Graph `dateTimeTimeZone` when no `--tz` was given: a zone-less value (a
 * date reads as its midnight) is a wall-clock time in the mailbox's time zone; a value with `Z` or an offset is an
 * instant, sent as UTC.
 *
 * @param name - The option name, for the error.
 * @param value - The option value.
 * @param mailboxTimeZone - The mailbox's time zone, read when a value is zone-less.
 * @returns The date-time and zone, or undefined when the option is not set.
 * @throws {CliError} `INVALID_ARGUMENT` when a zone-less value has no mailbox time zone to be read in, or a value does not parse.
 */
export function parseMsGraphCliMailboxDateTimeOption(name: string, value: unknown, mailboxTimeZone: Maybe<string>): Maybe<MicrosoftGraphDateTimeTimeZone> {
  let result: Maybe<MicrosoftGraphDateTimeTimeZone>;

  if (isMsGraphCliZonelessDateTime(value)) {
    if (!mailboxTimeZone) {
      throw new CliError({ message: `--${name} "${String(value)}" has no time zone.`, code: 'INVALID_ARGUMENT', suggestion: 'Pass --tz "<zone>", or an instant with an offset (2026-12-22T17:00-06:00).' });
    }

    const text = String(value);
    result = parseMsGraphCliDateTimeTimeZoneOption(name, MSGRAPH_CLI_LOCAL_DATE_ONLY_PATTERN.test(text) ? `${text}T00:00` : text, mailboxTimeZone);
  } else {
    result = parseMsGraphCliDateTimeTimeZoneOption(name, value);
  }

  return result;
}

/**
 * Turns a `--start` / `--end` value into a Graph `dateTimeTimeZone`.
 *
 * With `timeZone`, the value is a wall-clock time in that zone and must not carry an offset. Without one, the
 * value is any ISO 8601 instant and is sent as UTC.
 *
 * @param name - The option name, for the error.
 * @param value - The option value.
 * @param timeZone - The `--tz` value.
 * @returns The date-time and zone, or undefined when the option is not set.
 * @throws {CliError} `INVALID_ARGUMENT` when the value does not parse, or has an offset while `--tz` is set.
 */
export function parseMsGraphCliDateTimeTimeZoneOption(name: string, value: unknown, timeZone?: Maybe<string>): Maybe<MicrosoftGraphDateTimeTimeZone> {
  let result: Maybe<MicrosoftGraphDateTimeTimeZone>;

  if (value != null && value !== '') {
    const text = String(value);

    if (timeZone) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text)) {
        throw new CliError({ message: `--${name} "${text}" must be a local date-time without an offset when --tz is set, e.g. 2026-11-16T09:00.`, code: 'INVALID_ARGUMENT' });
      }

      result = { dateTime: text, timeZone };
    } else {
      const date = new Date(text);

      if (Number.isNaN(date.getTime())) {
        throw new CliError({ message: `--${name} "${text}" is not an ISO 8601 date/time.`, code: 'INVALID_ARGUMENT' });
      }

      result = { dateTime: date.toISOString().replace(/Z$/, ''), timeZone: 'UTC' };
    }
  }

  return result;
}

/**
 * Picks a value from a fixed list, for an enum option.
 *
 * @param name - The option name, for the error.
 * @param value - The option value.
 * @param allowed - The accepted values.
 * @returns The value, or undefined when the option is not set.
 * @throws {CliError} `INVALID_ARGUMENT` when the value is not in the list.
 */
export function parseMsGraphCliEnumOption<T extends string>(name: string, value: unknown, allowed: readonly T[]): Maybe<T> {
  let result: Maybe<T>;

  if (value != null && value !== '') {
    const match = allowed.find((x) => x.toLowerCase() === String(value).toLowerCase());

    if (!match) {
      throw new CliError({ message: `--${name} must be one of ${allowed.join(', ')}; got "${String(value)}".`, code: 'INVALID_ARGUMENT' });
    }

    result = match;
  }

  return result;
}
