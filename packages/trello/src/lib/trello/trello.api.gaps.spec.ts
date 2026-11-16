import { describe, expect, it } from 'vitest';
import { listBoardCards, listBoardMembers } from './trello.api.board';
import { deleteCommentOnCard, getCard, removeLabelFromCard, removeMemberFromCard, updateCommentOnCard } from './trello.api.card';
import { getMember, listMemberBoards } from './trello.api.member';
import { searchTrello } from './trello.api.search';
import { fakeTrelloContext } from './trello.fake';
import { TrelloInvalidTokenError, TrelloServerFetchResponseError } from '../trello.error.api';

describe('fakeTrelloContext()', () => {
  it('records the request and answers from the route table through the real factory', async () => {
    const fake = fakeTrelloContext({ routes: { 'GET /cards/card-1': { id: 'card-1', name: 'A card' } } });
    const card = await getCard(fake.trelloContext)({ cardId: 'card-1' });

    expect(card.name).toBe('A card');
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0].method).toBe('GET');
    expect(fake.requests[0].path).toBe('/cards/card-1');
    expect(fake.requests[0].headers.get('Authorization')).toBe('OAuth oauth_consumer_key="fake-key", oauth_token="fake-token"');
  });

  it('matches a wildcard route and prefers an exact key', async () => {
    const fake = fakeTrelloContext({ routes: { 'GET /cards/*': { id: 'wild' }, 'GET /cards/exact': { id: 'exact' } } });

    expect((await getCard(fake.trelloContext)({ cardId: 'other' })).id).toBe('wild');
    expect((await getCard(fake.trelloContext)({ cardId: 'exact' })).id).toBe('exact');
  });

  it('turns an unmatched request into a typed 404 error', async () => {
    const fake = fakeTrelloContext();
    await expect(getCard(fake.trelloContext)({ cardId: 'missing' })).rejects.toBeInstanceOf(TrelloServerFetchResponseError);
  });

  it('passes a non-2xx Response through the real error mapping', async () => {
    const fake = fakeTrelloContext({ routes: { 'GET /cards/card-1': new Response('invalid token', { status: 401 }) } });
    await expect(getCard(fake.trelloContext)({ cardId: 'card-1' })).rejects.toBeInstanceOf(TrelloInvalidTokenError);
  });
});

describe('getCard()', () => {
  it('sends no query string by default', async () => {
    const fake = fakeTrelloContext({ fallback: {} });
    await getCard(fake.trelloContext)({ cardId: 'c' });
    expect(fake.requests[0].url).toBe('https://api.trello.com/1/cards/c');
  });

  it('maps the expansion options onto the query', async () => {
    const fake = fakeTrelloContext({ fallback: {} });
    await getCard(fake.trelloContext)({ cardId: 'c', checklists: 'all', attachments: true, attachmentFields: 'name,url', fields: 'name' });
    const { query } = fake.requests[0];

    expect(query.get('checklists')).toBe('all');
    expect(query.get('attachments')).toBe('true');
    expect(query.get('attachment_fields')).toBe('name,url');
    expect(query.get('fields')).toBe('name');
  });
});

describe('listBoardCards()', () => {
  it('sends fields', async () => {
    const fake = fakeTrelloContext({ fallback: [] });
    await listBoardCards(fake.trelloContext)({ boardId: 'b', filter: 'open', fields: 'name,idList' });
    expect(fake.requests[0].query.get('fields')).toBe('name,idList');
    expect(fake.requests[0].query.get('filter')).toBe('open');
  });
});

describe('listBoardMembers()', () => {
  const members = [
    { id: 'm1', username: 'one' },
    { id: 'm2', username: 'two' }
  ];

  it('returns every member without a memberId', async () => {
    const fake = fakeTrelloContext({ routes: { 'GET /boards/b/members': members } });
    expect(await listBoardMembers(fake.trelloContext)({ boardId: 'b' })).toHaveLength(2);
  });

  it('honours memberId', async () => {
    const fake = fakeTrelloContext({ routes: { 'GET /boards/b/members': members } });
    const result = await listBoardMembers(fake.trelloContext)({ boardId: 'b', memberId: 'm2' });
    expect(result.map((x) => x.id)).toEqual(['m2']);
  });
});

describe('getMember()', () => {
  it('url-encodes fields', async () => {
    const fake = fakeTrelloContext({ fallback: {} });
    await getMember(fake.trelloContext)({ memberId: 'me', fields: 'id,username&evil=1' });
    expect(fake.requests[0].query.get('fields')).toBe('id,username&evil=1');
    expect(fake.requests[0].query.get('evil')).toBeNull();
  });

  it('sends no query string without fields', async () => {
    const fake = fakeTrelloContext({ fallback: {} });
    await getMember(fake.trelloContext)({ memberId: 'me' });
    expect(fake.requests[0].url).toBe('https://api.trello.com/1/members/me');
  });
});

describe('listMemberBoards()', () => {
  it('defaults to the authenticated member', async () => {
    const fake = fakeTrelloContext({ fallback: [] });
    await listMemberBoards(fake.trelloContext)({ filter: 'open', fields: 'name' });
    expect(fake.requests[0].path).toBe('/members/me/boards');
    expect(fake.requests[0].query.get('filter')).toBe('open');
  });
});

describe('searchTrello()', () => {
  it('maps its options onto Trello search parameters', async () => {
    const fake = fakeTrelloContext({ routes: { 'GET /search': { cards: [] } } });
    await searchTrello(fake.trelloContext)({ query: 'is:open bug', modelTypes: ['cards', 'boards'], idBoards: ['b1', 'b2'], cardsLimit: 5, cardFields: 'name', partial: true });
    const { query } = fake.requests[0];

    expect(query.get('query')).toBe('is:open bug');
    expect(query.get('modelTypes')).toBe('cards,boards');
    expect(query.get('idBoards')).toBe('b1,b2');
    expect(query.get('cards_limit')).toBe('5');
    expect(query.get('card_fields')).toBe('name');
    expect(query.get('partial')).toBe('true');
  });
});

describe('card label, member and comment removal/editing', () => {
  it('removeLabelFromCard() deletes one label', async () => {
    const fake = fakeTrelloContext({ routes: { 'DELETE /cards/c/idLabels/l': [] } });
    await removeLabelFromCard(fake.trelloContext)({ cardId: 'c', labelId: 'l' });
    expect(fake.requests[0].method).toBe('DELETE');
  });

  it('removeMemberFromCard() deletes one member', async () => {
    const fake = fakeTrelloContext({ routes: { 'DELETE /cards/c/idMembers/m': [] } });
    await removeMemberFromCard(fake.trelloContext)({ cardId: 'c', memberId: 'm' });
    expect(fake.requests[0].path).toBe('/cards/c/idMembers/m');
  });

  it('updateCommentOnCard() puts the new text', async () => {
    const fake = fakeTrelloContext({ routes: { 'PUT /cards/c/actions/a/comments': { id: 'a' } } });
    await updateCommentOnCard(fake.trelloContext)({ cardId: 'c', actionId: 'a', text: 'edited text' });
    expect(fake.requests[0].query.get('text')).toBe('edited text');
  });

  it('deleteCommentOnCard() deletes the comment', async () => {
    const fake = fakeTrelloContext({ routes: { 'DELETE /cards/c/actions/a/comments': {} } });
    await expect(deleteCommentOnCard(fake.trelloContext)({ cardId: 'c', actionId: 'a' })).resolves.toBeUndefined();
  });
});
