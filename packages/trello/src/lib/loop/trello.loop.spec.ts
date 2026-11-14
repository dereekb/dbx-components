import { describe, expect, it } from 'vitest';
import { fakeTrelloContext } from '../trello/trello.fake';
import { type TrelloAction, type TrelloCard, type TrelloCommentCardActionData, type TrelloLabel } from '../trello/trello.api.card.type';
import { type TrelloList } from '../trello/trello.api.list.type';
import { diffTrelloBoardSnapshots, fetchTrelloBoardSnapshot, trelloCardFingerprint, type TrelloBoardSnapshot } from './trello.loop.snapshot';
import { listTrelloBoardActivitySince } from './trello.loop.activity';
import { mergeTrelloMarkdownPreservedBlocks, readTrelloMarkdownPreservedBlocks, renderTrelloCardMarkdown } from './trello.loop.render';
import { findTrelloMentions, isTrelloActionAuthoredBy } from './trello.loop.mention';
import { matchTrelloList, normalizeTrelloListName, resolveTrelloBoardNames } from './trello.loop.board';
import { updateTrelloCardLabels } from './trello.loop.label';
import { probeTrelloAuth } from './trello.loop.auth';

const LISTS: TrelloList[] = [
  { id: 'list-todo', name: 'To do', closed: false, idBoard: 'board-1', pos: 1 },
  { id: 'list-doing', name: 'Doing (max 3)', closed: false, idBoard: 'board-1', pos: 2 }
];

const LABELS: TrelloLabel[] = [
  { id: 'label-bug', idBoard: 'board-1', name: 'bug', color: 'red' },
  { id: 'label-ready', idBoard: 'board-1', name: 'Ready', color: 'green' }
];

function card(overrides: Partial<TrelloCard> & { readonly id: string }): TrelloCard {
  return { name: overrides.id, desc: '', closed: false, idBoard: 'board-1', idList: 'list-todo', idMembers: [], idLabels: [], idChecklists: [], labels: [], pos: 1, due: null, dueComplete: false, start: null, url: `https://trello.com/c/${overrides.id}`, shortUrl: '', shortLink: `sl-${overrides.id}`, dateLastActivity: '2026-11-01T00:00:00.000Z', badges: { comments: 0 }, ...overrides };
}

function comment(id: string, text: string, overrides: Partial<TrelloAction<TrelloCommentCardActionData>> = {}): TrelloAction<TrelloCommentCardActionData> {
  return { id, idMemberCreator: 'member-human', type: 'commentCard', date: `2026-11-0${id.at(-1)}T00:00:00.000Z`, data: { text, card: { id: 'card-1' }, board: { id: 'board-1' } }, memberCreator: { id: 'member-human', username: 'human', fullName: 'A Human', initials: 'AH', avatarUrl: null }, ...overrides };
}

function boardRoutes(cards: TrelloCard[]) {
  return { 'GET /boards/board-1/lists': LISTS, 'GET /boards/board-1/labels': LABELS, 'GET /boards/board-1/cards': cards };
}

describe('fetchTrelloBoardSnapshot()', () => {
  it('captures lists, labels and sorted cards in three requests', async () => {
    const fake = fakeTrelloContext({ routes: boardRoutes([card({ id: 'card-b', idLabels: ['label-ready', 'label-bug'] }), card({ id: 'card-a' })]) });
    const snapshot = await fetchTrelloBoardSnapshot({ trelloContext: fake.trelloContext, boardId: 'board-1', now: () => new Date('2026-11-14T00:00:00.000Z') });

    expect(fake.requests).toHaveLength(3);
    expect(fake.requests.find((r) => r.path === '/boards/board-1/cards')?.query.get('filter')).toBe('visible');
    expect(snapshot.fetchedAt).toBe('2026-11-14T00:00:00.000Z');
    expect(snapshot.cards.map((c) => c.id)).toEqual(['card-a', 'card-b']);
    expect(snapshot.cards[1].idLabels).toEqual(['label-bug', 'label-ready']);
    expect(snapshot.cards[1].fingerprint).toBe(trelloCardFingerprint(card({ id: 'card-b', idLabels: ['label-bug', 'label-ready'] })));
  });
});

describe('diffTrelloBoardSnapshots()', () => {
  async function snapshotOf(cards: TrelloCard[], at: string): Promise<TrelloBoardSnapshot> {
    const fake = fakeTrelloContext({ routes: boardRoutes(cards) });
    return fetchTrelloBoardSnapshot({ trelloContext: fake.trelloContext, boardId: 'board-1', cardFilter: 'all', now: () => new Date(at) });
  }

  it('reports every card as added on a first run', async () => {
    const next = await snapshotOf([card({ id: 'card-a' })], '2026-11-14T00:00:00.000Z');
    const diff = diffTrelloBoardSnapshots(undefined, next);

    expect(diff.from).toBeNull();
    expect(diff.changes).toEqual([{ type: 'added', cardId: 'card-a', shortLink: 'sl-card-a', name: 'card-a', fromListId: 'list-todo', fromListName: 'To do' }]);
  });

  it('reports added, removed, closed, moved, relabeled, renamed and commented cards', async () => {
    const previous = await snapshotOf([card({ id: 'card-gone' }), card({ id: 'card-x', name: 'Old name', idLabels: ['label-bug'], badges: { comments: 1 } }), card({ id: 'card-y' })], '2026-11-13T00:00:00.000Z');
    const next = await snapshotOf([card({ id: 'card-new' }), card({ id: 'card-x', name: 'New name', idList: 'list-doing', idLabels: ['label-ready'], badges: { comments: 3 } }), card({ id: 'card-y', closed: true })], '2026-11-14T00:00:00.000Z');
    const diff = diffTrelloBoardSnapshots(previous, next);

    expect(diff.changes.map((c) => `${c.type}:${c.cardId}`)).toEqual(['removed:card-gone', 'added:card-new', 'moved:card-x', 'relabeled:card-x', 'renamed:card-x', 'commented:card-x', 'closed:card-y']);
    expect(diff.changes.find((c) => c.type === 'moved')).toMatchObject({ fromListName: 'To do', toListName: 'Doing (max 3)' });
    expect(diff.changes.find((c) => c.type === 'relabeled')).toMatchObject({ addedLabelIds: ['label-ready'], removedLabelIds: ['label-bug'] });
    expect(diff.changes.find((c) => c.type === 'renamed')).toMatchObject({ name: 'New name', previousName: 'Old name' });
    expect(diff.changes.find((c) => c.type === 'commented')?.newCommentCount).toBe(2);
  });

  it('reports nothing for an unchanged board', async () => {
    const cards = [card({ id: 'card-a' })];
    const diff = diffTrelloBoardSnapshots(await snapshotOf(cards, '2026-11-13T00:00:00.000Z'), await snapshotOf(cards, '2026-11-14T00:00:00.000Z'));
    expect(diff.changes).toEqual([]);
  });
});

describe('listTrelloBoardActivitySince()', () => {
  const actions = ['a5', 'a4', 'a3', 'a2', 'a1'].map((id) => ({ id, type: 'commentCard', date: '2026-11-01T00:00:00.000Z', idMemberCreator: 'm', data: {} }));

  it('walks back with the before cursor and returns the actions oldest first', async () => {
    const fake = fakeTrelloContext({
      routes: {
        'GET /boards/board-1/actions': (request: { readonly query: URLSearchParams }) => {
          const before = request.query.get('before');
          const start = before == null ? 0 : actions.findIndex((a) => a.id === before) + 1;
          return actions.slice(start, start + 2);
        }
      }
    });
    const activity = await listTrelloBoardActivitySince({ trelloContext: fake.trelloContext, boardId: 'board-1', since: 'a0', pageSize: 2 });

    expect(activity.actions.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    expect(activity.watermark).toBe('a5');
    expect(activity.truncated).toBe(false);
    expect(fake.requests.map((r) => r.query.get('before'))).toEqual([null, 'a4', 'a2']);
  });

  it('reports truncation at the page cap and keeps the watermark when nothing is new', async () => {
    const fake = fakeTrelloContext({ routes: { 'GET /boards/board-1/actions': actions.slice(0, 2) } });
    const truncated = await listTrelloBoardActivitySince({ trelloContext: fake.trelloContext, boardId: 'board-1', since: 'a0', pageSize: 2, maxPages: 1 });
    expect(truncated.truncated).toBe(true);

    const empty = await listTrelloBoardActivitySince({ trelloContext: fakeTrelloContext({ routes: { 'GET /boards/board-1/actions': [] } }).trelloContext, boardId: 'board-1', since: 'a5' });
    expect(empty).toEqual({ actions: [], watermark: 'a5', truncated: false });
  });
});

describe('renderTrelloCardMarkdown()', () => {
  const GOLDEN = [
    '# Fix the login page',
    '',
    '- **Card ID**: `card-1`',
    '- **List**: Doing',
    '- **Labels**: bug, Ready',
    '- **URL**: https://trello.com/c/card-1',
    '- **Last activity**: 2026-11-01T00:00:00.000Z',
    '- **Classification**: `ready`',
    '- **Snapshot at**: 2026-11-14T00:00:00.000Z',
    '',
    '## Agent state',
    '',
    '<!-- agent-state:begin -->',
    '_(nothing yet)_',
    '<!-- agent-state:end -->',
    '',
    '## Attachments',
    '',
    '- screenshot.png',
    '',
    '## Description',
    '',
    'The button does nothing.',
    '',
    '## Comments',
    '',
    '### 2026-11-01T00:00:00.000Z — A Human',
    '',
    'first',
    '',
    '### 2026-11-02T00:00:00.000Z — A Human',
    '',
    'second',
    '',
    ''
  ].join('\n');

  const input = {
    card: card({ id: 'card-1', name: 'Fix the login page', desc: '  The button does nothing.\n' }),
    listName: 'Doing',
    labelNames: ['bug', 'Ready'],
    comments: [comment('c2', 'second'), comment('c1', 'first')],
    headerFields: [{ label: 'Classification', value: '`ready`' }],
    snapshotAt: new Date('2026-11-14T00:00:00.000Z'),
    preservedBlocks: [{ name: 'agent-state', heading: 'Agent state', placeholder: '_(nothing yet)_' }],
    sections: [{ heading: 'Attachments', lines: ['- screenshot.png'] }]
  };

  it('matches the golden render', () => {
    expect(renderTrelloCardMarkdown(input)).toBe(GOLDEN);
  });

  it('renders the empty placeholders and omits the snapshot line without a time', () => {
    const markdown = renderTrelloCardMarkdown({ card: card({ id: 'card-2', name: 'Empty' }) });
    expect(markdown).toContain('- **List**: —\n- **Labels**: —');
    expect(markdown).not.toContain('Snapshot at');
    expect(markdown.endsWith('## Description\n\n_(no description)_\n\n## Comments\n\n_(no comments)_\n')).toBe(true);
  });

  it('carries a preserved block forward across a re-render', () => {
    const previous = GOLDEN.replace('_(nothing yet)_', '- **Branch**: feat/login');
    expect(readTrelloMarkdownPreservedBlocks(previous)).toEqual({ 'agent-state': '- **Branch**: feat/login' });
    expect(mergeTrelloMarkdownPreservedBlocks(renderTrelloCardMarkdown(input), previous)).toBe(previous);
  });
});

describe('findTrelloMentions()', () => {
  const bot = { memberIds: ['member-bot'] };

  it('finds whole-handle mentions, skips the bot and anything at or before the watermark', () => {
    const actions = [comment('c1', 'hey @bot look'), comment('c2', '@bottle is not a mention, nor is me@bot.com'), comment('c3', 'thanks @Bot', { idMemberCreator: 'member-bot' }), comment('c4', '@BOT again'), { ...comment('c5', '@bot'), type: 'updateCard' }];
    const all = findTrelloMentions({ actions, username: '@bot', exclude: bot });

    expect(all.mentions.map((m) => m.actionId)).toEqual(['c1', 'c4']);
    expect(all.mentions[0]).toMatchObject({ cardId: 'card-1', authorUsername: 'human', text: 'hey @bot look' });
    expect(all.newestMentionId).toBe('c4');
    expect(findTrelloMentions({ actions, username: 'bot', exclude: bot, afterActionId: 'c1' }).mentions.map((m) => m.actionId)).toEqual(['c4']);
    expect(findTrelloMentions({ actions, username: 'bot', afterActionId: 'c4' })).toEqual({ mentions: [], newestMentionId: 'c4' });
  });

  it('matches an author by member, app or sign-off', () => {
    expect(isTrelloActionAuthoredBy(comment('c1', 'x', { idMemberCreator: 'member-bot' }), bot)).toBe(true);
    expect(isTrelloActionAuthoredBy(comment('c1', 'x', { appCreator: { id: 'app-1' } }), { appCreatorIds: ['app-1'] })).toBe(true);
    expect(isTrelloActionAuthoredBy(comment('c1', 'done\n— bot'), { signoffPattern: /— bot$/ })).toBe(true);
    expect(isTrelloActionAuthoredBy(comment('c1', 'x'), bot)).toBe(false);
  });
});

describe('board names', () => {
  it('normalizes list names and matches lists by id or name', () => {
    expect(normalizeTrelloListName('  Up   Next (max 5) ')).toBe('up next');
    expect(matchTrelloList({ lists: LISTS, list: 'doing' })).toMatchObject({ ok: true, list: { id: 'list-doing' } });
    expect(matchTrelloList({ lists: LISTS, list: 'list-todo' })).toMatchObject({ ok: true, list: { id: 'list-todo' } });
    expect(matchTrelloList({ lists: [...LISTS, { ...LISTS[0], id: 'list-todo-2' }], list: 'To do' })).toMatchObject({ ok: false, code: 'ambiguous_list' });
  });

  it('resolves configured names and reports every missing one', async () => {
    const fake = fakeTrelloContext({ routes: boardRoutes([]) });
    const names = await resolveTrelloBoardNames({ trelloContext: fake.trelloContext, boardId: 'board-1', lists: ['To do', 'Done'], labels: ['ready', 'nope'] });

    expect(names.ok).toBe(false);
    expect(names.listIds).toEqual({ 'To do': 'list-todo' });
    expect(names.labelIds).toEqual({ ready: 'label-ready' });
    expect(names.missing.map((m) => `${m.kind}:${m.name}:${m.code}`)).toEqual(['list:Done:unknown_list', 'label:nope:unknown_label']);
  });
});

describe('updateTrelloCardLabels()', () => {
  it('adds and removes one label per call, skipping no-ops', async () => {
    const fake = fakeTrelloContext({ routes: { 'GET /cards/card-1': card({ id: 'card-1', idLabels: ['label-bug'] }), 'GET /boards/board-1/labels': LABELS, 'POST /cards/card-1/idLabels': ['label-bug', 'label-ready'], 'DELETE /cards/card-1/idLabels/label-bug': {} } });
    const result = await updateTrelloCardLabels({ trelloContext: fake.trelloContext, cardId: 'card-1', add: ['Ready', 'bug'], remove: ['label-bug'] });

    expect(result.ok).toBe(true);
    expect(result.added.map((l) => l.id)).toEqual(['label-ready']);
    expect(result.removed.map((l) => l.id)).toEqual(['label-bug']);
    expect(result.labelIds).toEqual(['label-ready']);
    expect(fake.requests.filter((r) => r.method !== 'GET').map((r) => `${r.method} ${r.path}`)).toEqual(['POST /cards/card-1/idLabels', 'DELETE /cards/card-1/idLabels/label-bug']);
    expect(fake.requests.find((r) => r.method !== 'GET' && r.method !== 'DELETE')?.query.get('value')).toBe('label-ready');
  });

  it('writes nothing when a reference does not resolve', async () => {
    const fake = fakeTrelloContext();
    const result = await updateTrelloCardLabels({ trelloContext: fake.trelloContext, cardId: 'card-1', currentLabelIds: [], boardLabels: LABELS, add: ['Ready', 'missing'] });

    expect(result.ok).toBe(false);
    expect(result.unresolved.map((u) => u.name)).toEqual(['missing']);
    expect(fake.requests).toHaveLength(0);
  });
});

describe('probeTrelloAuth()', () => {
  it('returns the member over header auth', async () => {
    const fake = fakeTrelloContext({ routes: { 'GET /members/me': { id: 'member-1', username: 'me', fullName: 'Me' } } });
    expect(await probeTrelloAuth({ trelloContext: fake.trelloContext })).toEqual({ ok: true, member: { id: 'member-1', username: 'me', fullName: 'Me' } });
    expect(fake.requests[0].url).not.toContain('token=');
    expect(fake.requests[0].headers.get('Authorization')).toContain('oauth_token=');
  });

  it('maps a 401 to TOKEN_REJECTED without throwing', async () => {
    const fake = fakeTrelloContext({ routes: { 'GET /members/me': new Response('invalid token', { status: 401 }) } });
    expect(await probeTrelloAuth({ trelloContext: fake.trelloContext })).toMatchObject({ ok: false, code: 'TOKEN_REJECTED', status: 401 });
  });
});
