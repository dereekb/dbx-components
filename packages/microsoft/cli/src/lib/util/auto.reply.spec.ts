import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError } from '@dereekb/dbx-cli';
import { microsoftGraphUpdateAutomaticRepliesRequest } from '@dereekb/microsoft';
import { msGraphCliAutoReplyBackupPath, msGraphCliAutoReplyOutput, parseMsGraphCliDateTimeTimeZoneOption, parseMsGraphCliEnumOption, readMsGraphCliAutoReplyBackup, writeMsGraphCliAutoReplyBackup } from './auto.reply';

describe('auto-reply helpers', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'msgraph-cli-auto-reply-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('saves the read setting without @odata.context and restores it as the same PATCH body', async () => {
    // models: https://learn.microsoft.com/en-us/graph/api/resources/automaticrepliessetting
    const read = {
      '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#users/mailboxSettings/automaticRepliesSetting',
      status: 'scheduled' as const,
      externalAudience: 'contactsOnly' as const,
      scheduledStartDateTime: { dateTime: '2030-01-01T00:00:00.0000000', timeZone: 'UTC' },
      scheduledEndDateTime: { dateTime: '2030-01-02T00:00:00.0000000', timeZone: 'UTC' },
      internalReplyMessage: '<p>Away</p>',
      externalReplyMessage: ''
    };

    await writeMsGraphCliAutoReplyBackup(join(dir, 'config'), read, new Date('2026-11-12T00:00:00Z'));
    const backup = await readMsGraphCliAutoReplyBackup(join(dir, 'config'));
    const { '@odata.context': _context, ...fields } = read;

    expect(backup).toEqual({ savedAt: '2026-11-12T00:00:00.000Z', setting: fields });
    expect(microsoftGraphUpdateAutomaticRepliesRequest(backup.setting).body).toEqual({ automaticRepliesSetting: fields });
    expect(statSync(msGraphCliAutoReplyBackupPath(join(dir, 'config'))).mode & 0o777).toBe(0o600);
  });

  it('refuses a restore when no backup was saved', async () => {
    await expect(readMsGraphCliAutoReplyBackup(dir)).rejects.toBeInstanceOf(CliError);
  });

  it('hides the reply messages unless asked', () => {
    const setting = { status: 'alwaysEnabled' as const, internalReplyMessage: '<p>Away</p>', externalReplyMessage: '' };
    expect(msGraphCliAutoReplyOutput(setting, false)).toEqual({ status: 'alwaysEnabled', internalReplyMessageChars: 11, externalReplyMessageChars: 0 });
    expect(msGraphCliAutoReplyOutput(setting, true)).toEqual(setting);
  });

  it('parses --start as UTC, or as wall-clock time with --tz, and rejects an offset with --tz', () => {
    expect(parseMsGraphCliDateTimeTimeZoneOption('start', '2026-11-16T09:00:00-08:00')).toEqual({ dateTime: '2026-11-16T17:00:00.000', timeZone: 'UTC' });
    expect(parseMsGraphCliDateTimeTimeZoneOption('start', '2026-11-16T09:00', 'Pacific Standard Time')).toEqual({ dateTime: '2026-11-16T09:00', timeZone: 'Pacific Standard Time' });
    expect(parseMsGraphCliDateTimeTimeZoneOption('start', undefined)).toBeUndefined();
    expect(() => parseMsGraphCliDateTimeTimeZoneOption('start', '2026-11-16T09:00Z', 'Pacific Standard Time')).toThrow(CliError);
    expect(() => parseMsGraphCliDateTimeTimeZoneOption('start', 'soon')).toThrow(CliError);
  });

  it('matches enum options case-insensitively and rejects others', () => {
    expect(parseMsGraphCliEnumOption('audience', 'contactsonly', ['none', 'contactsOnly', 'all'])).toBe('contactsOnly');
    expect(() => parseMsGraphCliEnumOption('audience', 'everyone', ['none', 'contactsOnly', 'all'])).toThrow(CliError);
  });
});
