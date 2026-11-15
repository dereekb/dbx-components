import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphAutomaticRepliesSetting, type MicrosoftGraphAutomaticRepliesStatus, type MicrosoftGraphDateTimeTimeZone, type MicrosoftGraphExternalAudienceScope, microsoftGraphAutomaticRepliesSettingFields } from '@dereekb/microsoft';
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
