import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphChat, type MicrosoftGraphChatMessage } from '@dereekb/microsoft';
import { MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHAT_MANIFEST_KIND, MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_KIND, MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_VERSION, msGraphCliTeamsChatDumpMessagePath, msGraphCliTeamsChatKey } from './teams.chat.dump';
import { msGraphCliTeamsChatMessageSearchText, msGraphCliTeamsChatSearchHitFromGraph, msGraphCliTeamsChatSearchMatcher, msGraphCliTeamsChatSearchSnippet, searchMsGraphCliTeamsChatDump } from './teams.chat.search';

interface FakeMessage {
  readonly message: MicrosoftGraphChatMessage;
  readonly deleted?: boolean;
  readonly markdown?: boolean;
}

/**
 * Writes a teams chat dump the way `teams chat dump` lays it out: the top-level manifest, and per chat its chat.json,
 * manifest and message files.
 *
 * @param dir - The dump directory.
 * @param chats - The chats and their messages.
 */
function writeDump(dir: string, chats: { readonly chat: MicrosoftGraphChat; readonly messages: FakeMessage[] }[]): void {
  const index: Record<string, unknown> = {};

  for (const { chat, messages } of chats) {
    const chatKey = msGraphCliTeamsChatKey(chat.id);
    const chatDir = join(dir, 'chats', chatKey);
    const entries: Record<string, unknown> = {};
    mkdirSync(chatDir, { recursive: true });
    writeFileSync(join(chatDir, 'chat.json'), JSON.stringify(chat));

    for (const { message, deleted, markdown } of messages) {
      const file = msGraphCliTeamsChatDumpMessagePath(message);
      mkdirSync(dirname(join(chatDir, file)), { recursive: true });
      writeFileSync(join(chatDir, `${file}.json`), JSON.stringify(message));

      if (markdown !== false) {
        writeFileSync(join(chatDir, `${file}.md`), '### x');
      }

      entries[message.id] = { file, lastModifiedDateTime: message.createdDateTime, ...(deleted ? { deletedDateTime: '2026-11-10T00:00:00Z' } : {}) };
    }

    writeFileSync(join(chatDir, 'manifest.json'), JSON.stringify({ version: MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_VERSION, kind: MSGRAPH_CLI_TEAMS_CHAT_DUMP_CHAT_MANIFEST_KIND, chat: chatKey, counts: {}, messages: entries, removed: [] }));
    index[chatKey] = { addedAt: '2026-11-01T00:00:00Z' };
  }

  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ version: MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_VERSION, kind: MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_KIND, selection: 'x', counts: {}, chats: index }));
}

function message(input: { readonly id: string; readonly createdDateTime: string; readonly sender: string; readonly html: string }): MicrosoftGraphChatMessage {
  return { id: input.id, createdDateTime: input.createdDateTime, messageType: 'message', from: { user: { displayName: input.sender } }, body: { contentType: 'html', content: input.html } };
}

const ADA_CHAT: MicrosoftGraphChat = { id: '19:ada@thread.v2', chatType: 'oneOnOne', members: [{ displayName: 'Ada Lovelace' }, { displayName: 'Me' }] };
const TEAM_CHAT: MicrosoftGraphChat = { id: '19:team@thread.v2', chatType: 'group', topic: 'Budget team', members: [{ displayName: 'Grace Hopper' }, { displayName: 'Ada Lovelace' }, { displayName: 'Me' }] };

describe('teams chat search', () => {
  describe('msGraphCliTeamsChatSearchMatcher()', () => {
    it('needs every word, keeps quoted phrases together, and ignores case', () => {
      const match = msGraphCliTeamsChatSearchMatcher({ query: 'Budget "next week"' });
      expect(match('the budget is due next week')).toBe(4);
      expect(match('the budget is due week next')).toBe(-1);
      expect(match('nothing')).toBe(-1);
    });

    it('matches case when asked, and every message on an empty query', () => {
      expect(msGraphCliTeamsChatSearchMatcher({ query: 'Budget', caseSensitive: true })('budget')).toBe(-1);
      expect(msGraphCliTeamsChatSearchMatcher({ query: '  ' })('anything')).toBe(0);
    });

    it('takes a regular expression with --regex and refuses an invalid one', () => {
      expect(msGraphCliTeamsChatSearchMatcher({ query: String.raw`invoice #\d+`, regex: true })('see Invoice #42')).toBe(4);
      expect(() => msGraphCliTeamsChatSearchMatcher({ query: '(', regex: true })).toThrow(CliError);
    });
  });

  it('searches the subject, body text and attachment names, with image links reduced to [image]', () => {
    const text = msGraphCliTeamsChatMessageSearchText({ subject: 'Plan', body: { contentType: 'html', content: '<p>See <b>this</b><img src="https://example.com/a.png"></p><attachment id="a1"></attachment>' }, attachments: [{ id: 'a1', name: 'Q3 budget.xlsx' }] });
    expect(text).toBe('Plan\nSee **this**[image]\n[attachment: Q3 budget.xlsx]\nQ3 budget.xlsx');
  });

  it('cuts a snippet around the match and marks the cuts', () => {
    const text = `${'a'.repeat(200)} needle ${'b'.repeat(300)}`;
    const snippet = msGraphCliTeamsChatSearchSnippet(text, 201);
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet).toContain('needle');
    expect(msGraphCliTeamsChatSearchSnippet('short needle', 6)).toBe('short needle');
  });

  it('builds a hit from a Graph search hit, from either shape Graph documents', () => {
    // models: search-concept-chat-messages examples — from.emailAddress, webLink, <c0> highlights and <ddd/> cuts
    const hit = msGraphCliTeamsChatSearchHitFromGraph({
      hitId: 'h1',
      summary: '<ddd/>the <c0>budget</c0> is due<ddd/>',
      resource: { id: 'm1', chatId: '19:c', createdDateTime: '2026-11-01T00:00:00Z', from: { emailAddress: { name: 'Ada', address: 'ada@example.com' } }, webLink: 'https://teams.microsoft.com/l/message/1' }
    });
    expect(hit).toEqual({ id: 'm1', chatId: '19:c', channelIdentity: undefined, createdDateTime: '2026-11-01T00:00:00Z', from: 'Ada', snippet: '…the budget is due…', webUrl: 'https://teams.microsoft.com/l/message/1' });

    const other = msGraphCliTeamsChatSearchHitFromGraph({ hitId: 'h2', resource: { from: { user: { displayName: 'Grace' } }, channelIdentity: { teamId: 't', channelId: 'c' }, webUrl: 'https://x' } });
    expect(other).toMatchObject({ id: 'h2', from: 'Grace', channelIdentity: { teamId: 't', channelId: 'c' }, webUrl: 'https://x', snippet: '' });
  });

  describe('searchMsGraphCliTeamsChatDump()', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'msgraph-cli-chat-search-'));
      writeDump(dir, [
        {
          chat: ADA_CHAT,
          messages: [
            { message: message({ id: 'a1', createdDateTime: '2026-10-01T10:00:00.000Z', sender: 'Ada Lovelace', html: '<p>Draft budget attached</p>' }) },
            { message: message({ id: 'a2', createdDateTime: '2026-11-05T10:00:00.000Z', sender: 'Me', html: '<p>Budget looks good</p>' }), markdown: false },
            { message: message({ id: 'a3', createdDateTime: '2026-11-06T10:00:00.000Z', sender: 'Ada Lovelace', html: '<p>old budget text</p>' }), deleted: true }
          ]
        },
        {
          chat: TEAM_CHAT,
          messages: [{ message: message({ id: 't1', createdDateTime: '2026-11-07T09:00:00.000Z', sender: 'Grace Hopper', html: '<p>Budget review at 3</p>' }) }, { message: message({ id: 't2', createdDateTime: '2026-11-08T09:00:00.000Z', sender: 'Grace Hopper', html: '<p>Lunch?</p>' }) }]
        }
      ]);
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('returns every match newest first, with chat labels, files and the deleted flag', async () => {
      const result = await searchMsGraphCliTeamsChatDump({ dir, query: 'budget' });

      expect(result).toMatchObject({ chats: 2, scanned: 5, matches: 4, truncated: false });
      expect(result.hits.map((x) => x.id)).toEqual(['t1', 'a3', 'a2', 'a1']);
      expect(result.hits[0]).toMatchObject({ chatId: TEAM_CHAT.id, chat: 'Budget team', from: 'Grace Hopper', snippet: 'Budget review at 3' });
      expect(result.hits[0].file).toMatch(/^chats\/[0-9a-f]{16}\/messages\/2026\/11\/2026-11-07T09-00-00Z_[0-9a-f]{8}\.md$/);
      expect(result.hits[1]).toMatchObject({ chat: 'Ada Lovelace, Me', deleted: true });
      expect(result.hits[2].file).toMatch(/\.json$/);
    });

    it('filters by chat members, sender, dates and deletion, and caps at --top', async () => {
      expect((await searchMsGraphCliTeamsChatDump({ dir, query: 'budget', withNames: ['grace'] })).hits.map((x) => x.id)).toEqual(['t1']);
      expect((await searchMsGraphCliTeamsChatDump({ dir, query: 'budget', chatId: ADA_CHAT.id, from: 'ada' })).hits.map((x) => x.id)).toEqual(['a3', 'a1']);

      const ranged = await searchMsGraphCliTeamsChatDump({ dir, query: '', since: new Date('2026-11-01T00:00:00Z'), until: new Date('2026-11-07T00:00:00Z'), includeDeleted: false });
      expect(ranged.hits.map((x) => x.id)).toEqual(['a2']);
      // the dated file names skip messages outside the range without reading them
      expect(ranged.scanned).toBe(1);

      const capped = await searchMsGraphCliTeamsChatDump({ dir, query: 'budget', top: 1 });
      expect(capped).toMatchObject({ matches: 4, truncated: true });
      expect(capped.hits).toHaveLength(1);
    });

    it('refuses a directory that holds no teams chat dump', async () => {
      const empty = join(dir, 'empty');
      mkdirSync(empty);
      await expect(searchMsGraphCliTeamsChatDump({ dir: empty, query: 'x' })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    });
  });
});
