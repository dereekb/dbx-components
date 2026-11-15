import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError } from '@dereekb/dbx-cli';
import { awaitMsGraphCliTeamsSendSlot, msGraphCliChatOutput, parseMsGraphCliTeamsWithNames, readMsGraphCliTeamsBody } from './teams';

describe('teams helpers', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'msgraph-cli-teams-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps sends at least 1 second apart across runs', async () => {
    // models: T-k (throttling-limits) — 1 message per second per chat/channel and per user
    let clock = 10_000;
    const waits: number[] = [];
    const config = { configDir: join(dir, 'config'), now: () => clock, wait: async (ms: number) => void (waits.push(ms), (clock += ms)) };

    expect(await awaitMsGraphCliTeamsSendSlot(config)).toBe(0);
    clock += 300;
    expect(await awaitMsGraphCliTeamsSendSlot(config)).toBe(700);
    clock += 5000;
    expect(await awaitMsGraphCliTeamsSendSlot(config)).toBe(0);
    expect(waits).toEqual([700]);
  });

  it('takes exactly one of --text, --html or --file', async () => {
    expect(await readMsGraphCliTeamsBody({ text: 'hi' })).toEqual({ contentType: 'text', content: 'hi' });
    expect(await readMsGraphCliTeamsBody({ html: '<b>hi</b>' })).toEqual({ contentType: 'html', content: '<b>hi</b>' });
    await expect(readMsGraphCliTeamsBody({})).rejects.toBeInstanceOf(CliError);
    await expect(readMsGraphCliTeamsBody({ text: 'a', html: 'b' })).rejects.toBeInstanceOf(CliError);
  });

  it('parses --with as repeatable or comma-separated names, trimmed, blanks dropped', () => {
    expect(parseMsGraphCliTeamsWithNames(undefined)).toEqual([]);
    expect(parseMsGraphCliTeamsWithNames('Ada')).toEqual(['Ada']);
    expect(parseMsGraphCliTeamsWithNames(['Ada, Grace', ' Linus ', ''])).toEqual(['Ada', 'Grace', 'Linus']);
    expect(parseMsGraphCliTeamsWithNames('Ada,,  ,Grace')).toEqual(['Ada', 'Grace']);
  });

  it('prints member names only', () => {
    expect(msGraphCliChatOutput({ id: 'c1', chatType: 'oneOnOne', members: [{ displayName: 'Ada Example', userId: 'u1', email: 'ada@example.com' }] }).members).toEqual(['Ada Example']);
  });
});
