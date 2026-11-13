import { describe, expect, it } from 'vitest';
import { microsoftGraphPathWithQuery } from './graph.api';
import {
  MICROSOFT_GRAPH_PREFER_INCLUDE_UNKNOWN_ENUM_MEMBERS,
  type MicrosoftGraphChat,
  type MicrosoftGraphChatMessage,
  microsoftGraphChatMatches,
  microsoftGraphChatMessageHostedContentRefs,
  microsoftGraphChatMessageHostedContentRequest,
  microsoftGraphChatMessagesRequest,
  microsoftGraphChatRequest,
  microsoftGraphSendChannelMessageRequest,
  microsoftGraphSoftDeleteChannelMessageRequest,
  microsoftGraphSoftDeleteChatMessageRequest
} from './graph.teams.api';

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

describe('chat dump requests', () => {
  it('continues a listing from a skip token and asks for system events only when told to', () => {
    // models: TC9 (a filtered nextLink carries $top, $orderby, $filter and $skiptoken) and TC10 (Prefer: include-unknown-enum-members)
    const request = microsoftGraphChatMessagesRequest({ chatId: 'c', since: '2026-11-01T00:00:00.000Z', skipToken: 'tok=1', includeSystemEvents: true });
    expect(request.query).toEqual({ $top: 50, $orderby: 'lastModifiedDateTime desc', $filter: 'lastModifiedDateTime gt 2026-11-01T00:00:00.000Z', $skiptoken: 'tok=1' });
    expect(request.headers).toEqual({ Prefer: MICROSOFT_GRAPH_PREFER_INCLUDE_UNKNOWN_ENUM_MEMBERS });
    expect(MICROSOFT_GRAPH_PREFER_INCLUDE_UNKNOWN_ENUM_MEMBERS).toBe('include-unknown-enum-members');
  });

  it('sends no skip token and no Prefer header by default, so teams chat messages is unchanged', () => {
    const request = microsoftGraphChatMessagesRequest({ chatId: 'c' });
    expect(request.headers).toBeUndefined();
    expect(microsoftGraphPathWithQuery(request.path, request.query)).toBe('/chats/c/messages?%24top=50&%24orderby=lastModifiedDateTime+desc');
  });

  it('reads one chat with its members', () => {
    expect(microsoftGraphChatRequest('19:abc@thread.v2')).toEqual({ method: 'GET', path: '/chats/19%3Aabc%40thread.v2', query: { $expand: 'members' } });
  });

  it('reads a hosted content through $value with ConsistencyLevel: eventual', () => {
    // models: TC14 (chatmessagehostedcontent-get) — eventual consistency is needed for edited or deleted messages
    expect(microsoftGraphChatMessageHostedContentRequest({ chatId: '19:abc@thread.v2', messageId: '171', hostedContentId: 'aWQ9eA==' })).toEqual({ method: 'GET', path: '/chats/19%3Aabc%40thread.v2/messages/171/hostedContents/aWQ9eA%3D%3D/$value', headers: { ConsistencyLevel: 'eventual' } });
  });

  describe('microsoftGraphChatMessageHostedContentRefs()', () => {
    function message(content: string): Pick<MicrosoftGraphChatMessage, 'body'> {
      return { body: { contentType: 'html', content } };
    }

    it('finds every image in body order, on v1.0 and beta, decoding encoded ids', () => {
      // models: TC13 (bodies reference https://graph.microsoft.com/v1.0/chats/{c}/messages/{m}/hostedContents/{id}/$value; docs also show /beta/)
      const refs = microsoftGraphChatMessageHostedContentRefs(message('<p>a</p><img src="https://graph.microsoft.com/v1.0/chats/19:abc@thread.v2/messages/171/hostedContents/aWQ9eA%3D%3D/$value" width="10"><img src="https://graph.microsoft.com/beta/chats/19:abc@thread.v2/messages/171/hostedContents/aWQ9eQ/$value">'));
      expect(refs).toEqual([
        { chatId: '19:abc@thread.v2', messageId: '171', hostedContentId: 'aWQ9eA==' },
        { chatId: '19:abc@thread.v2', messageId: '171', hostedContentId: 'aWQ9eQ' }
      ]);
    });

    it('keeps the ids a forwarded image names, accepts the /1.0/ typo and drops duplicates', () => {
      // models: TC13 (docs show a /1.0/ typo; parse loosely)
      const url = 'https://graph.microsoft.com/1.0/chats/19:other@thread.v2/messages/99/hostedContents/aWQ9eg/$value';
      const refs = microsoftGraphChatMessageHostedContentRefs(message(`<img src="${url}"><img src="${url}">`));
      expect(refs).toEqual([{ chatId: '19:other@thread.v2', messageId: '99', hostedContentId: 'aWQ9eg' }]);
    });

    it('returns nothing for a message without a body or without images', () => {
      expect(microsoftGraphChatMessageHostedContentRefs({})).toEqual([]);
      expect(microsoftGraphChatMessageHostedContentRefs({ body: null })).toEqual([]);
      expect(microsoftGraphChatMessageHostedContentRefs(message('<img src="https://example.com/a.png">'))).toEqual([]);
    });
  });
});
