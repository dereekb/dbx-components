import { describe, expect, it } from 'vitest';
import { microsoftGraphPathWithQuery } from './graph.api';
import { type MicrosoftGraphChat, microsoftGraphChatMatches, microsoftGraphChatMessagesRequest, microsoftGraphSendChannelMessageRequest, microsoftGraphSoftDeleteChannelMessageRequest, microsoftGraphSoftDeleteChatMessageRequest } from './graph.teams.api';

// synthetic chats; no real names
const CHATS: MicrosoftGraphChat[] = [
  { id: 'c1', chatType: 'oneOnOne', members: [{ displayName: 'Test User' }, { displayName: 'Ada Example', email: 'ada@example.com' }] },
  { id: 'c2', chatType: 'group', topic: 'Payroll sync', members: [{ displayName: 'Test User' }, { displayName: 'Ada Example' }, { displayName: 'Bob Sample' }] },
  { id: 'c3', chatType: 'group', topic: 'Lunch', members: [{ displayName: 'Test User' }, { displayName: 'Cy Placeholder' }] }
];

function matching(filter: Parameters<typeof microsoftGraphChatMatches>[1]): string[] {
  return CHATS.filter((x) => microsoftGraphChatMatches(x, filter)).map((x) => x.id);
}

describe('microsoftGraphChatMatches()', () => {
  it('requires every --with name to match a member name or address, case-insensitively', () => {
    // models: T-c (chat-list with $expand=members) — names are matched locally
    expect(matching({ withNames: ['ada'] })).toEqual(['c1', 'c2']);
    expect(matching({ withNames: ['ADA@EXAMPLE.COM'] })).toEqual(['c1']);
    expect(matching({ withNames: ['ada', 'bob'] })).toEqual(['c2']);
    expect(matching({ withNames: ['nobody'] })).toEqual([]);
  });

  it('filters by topic substring and chat type', () => {
    expect(matching({ topic: 'payroll' })).toEqual(['c2']);
    expect(matching({ chatType: 'oneOnOne' })).toEqual(['c1']);
    expect(matching({ withNames: ['ada'], chatType: 'group' })).toEqual(['c2']);
  });
});

describe('teams requests', () => {
  it('soft-deletes and restores a chat message through the /me/chats path', () => {
    // models: T-f (chatmessage-softdelete) — /me/chats/{id}/messages/{id}/softDelete answered 204 live
    expect(microsoftGraphSoftDeleteChatMessageRequest({ chatId: '19:abc@thread.v2', messageId: '171' })).toEqual({ method: 'POST', path: '/me/chats/19%3Aabc%40thread.v2/messages/171/softDelete' });
    expect(microsoftGraphSoftDeleteChatMessageRequest({ chatId: 'c', messageId: 'm', undo: true }).path).toBe('/me/chats/c/messages/m/undoSoftDelete');
    expect(microsoftGraphSoftDeleteChannelMessageRequest({ teamId: 't', channelId: 'ch', messageId: 'm' }).path).toBe('/teams/t/channels/ch/messages/m/softDelete');
  });

  it('orders chat messages by lastModifiedDateTime and filters --since on the same property, top capped at 50', () => {
    // models: docs-teams B5 (chat-list-messages) — $filter must use the $orderby property
    const request = microsoftGraphChatMessagesRequest({ chatId: 'c', since: '2026-11-01T00:00:00.000Z', top: 200 });
    expect(decodeURIComponent(microsoftGraphPathWithQuery(request.path, request.query))).toBe('/chats/c/messages?$top=50&$orderby=lastModifiedDateTime+desc&$filter=lastModifiedDateTime+gt+2026-11-01T00:00:00.000Z');
  });

  it('posts a channel reply under the parent message', () => {
    // models: T-g (chatmessage-post-replies) — the reply's replyToId is the parent id
    expect(microsoftGraphSendChannelMessageRequest({ teamId: 't', channelId: 'ch', replyToId: 'p1', body: { contentType: 'text', content: 'ok' } })).toEqual({ method: 'POST', path: '/teams/t/channels/ch/messages/p1/replies', body: { body: { contentType: 'text', content: 'ok' } } });
  });
});
