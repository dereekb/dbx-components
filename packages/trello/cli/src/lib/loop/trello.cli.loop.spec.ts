import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configureCliOutputWriter } from '@dereekb/dbx-cli';
import { type FakeTrelloContext, type FakeTrelloRequest, fakeTrelloContext } from '@dereekb/trello';
import { runTrelloCli } from '../cli';
import { TRELLO_CLI_CONFIG_DIR_ENV_VAR } from '../config/cli.config';
import { createTrelloCliContext } from '../context/cli.context';
import { trelloCardAttachmentFileName } from './trello.cli.loop.fs';

const BOARD_ID = 'board-1';
const CARD_ID = '5f0000000000000000000c01';
const ME = { id: 'member-alice', username: 'alice', fullName: 'Alice Example' };
const BOB = { id: 'member-bob', username: 'bob', fullName: 'Bob Example' };
const LISTS = [
  { id: 'list-a', name: 'To Do', closed: false },
  { id: 'list-b', name: 'Doing (WIP)', closed: false }
];
const LABELS = [{ id: 'label-1', name: 'Bug', color: 'red' }];
const ATTACHMENT_FILE_ID = 'a0000000000000000000a001';
const ATTACHMENT_LINK_ID = 'a0000000000000000000a002';
const ORPHAN_ATTACHMENT_ID = 'a0000000000000000000a0ff';

interface FakeCard {
  readonly id: string;
  readonly shortLink: string;
  readonly name: string;
  readonly desc: string;
  readonly idList: string;
  readonly idLabels: string[];
  readonly closed: boolean;
  readonly dateLastActivity: string;
  readonly url: string;
  readonly badges: { readonly comments: number };
}

/**
 * A comment action as Trello returns it.
 *
 * @param id - The action id (ids sort by time, as Trello's do).
 * @param author - Who wrote it.
 * @param text - The comment text.
 * @returns The action.
 */
function comment(id: string, author: typeof ME, text: string) {
  return { id, idMemberCreator: author.id, memberCreator: author, type: 'commentCard', date: `2026-11-0${id.at(-1)}T10:00:00.000Z`, data: { text, card: { id: CARD_ID } } };
}

/**
 * Answers a `since` query the way Trello does: only actions newer than the cursor, newest first.
 *
 * @param actions - Every action, oldest first.
 * @param request - The request.
 * @returns The page.
 */
function actionsSince(actions: readonly { readonly id: string }[], request: FakeTrelloRequest) {
  const since = request.query.get('since');
  return actions.filter((x) => since == null || x.id > since).toReversed();
}

describe('trello-cli loop commands', () => {
  let dir: string;
  let configDir: string;
  let lines: string[];
  let exitCodes: number[];
  let cards: FakeCard[];
  let boardActions: ReturnType<typeof comment>[];
  let cardActions: ReturnType<typeof comment>[];
  let attachments: unknown[];
  let downloads: string[];
  let fake: FakeTrelloContext;

  async function run(args: string[]) {
    lines = [];
    exitCodes = [];
    await runTrelloCli({
      argv: args,
      env: { [TRELLO_CLI_CONFIG_DIR_ENV_VAR]: configDir },
      loadExternalPlugins: false,
      contextProvider: async (request) => createTrelloCliContext({ trelloContext: fake.trelloContext, auth: { mode: 'host', source: 'spec' }, board: BOARD_ID, configDir, stateName: request.pluginName, log: () => undefined })
    });
    const last = lines.at(-1);
    // --raw prints markdown, not an envelope
    const json = last?.startsWith('{') ? (JSON.parse(last) as Record<string, any>) : undefined;
    return { json, exitCode: exitCodes[0] ?? 0, lines };
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'trello-cli-loop-'));
    configDir = join(dir, 'config');
    cards = [
      { id: '5f0000000000000000000c01', shortLink: 'AbCd1234', name: 'First card', desc: 'The first description', idList: 'list-a', idLabels: ['label-1'], closed: false, dateLastActivity: '2026-11-01T10:00:00.000Z', url: 'https://trello.com/c/AbCd1234/1-first-card', badges: { comments: 0 } },
      { id: '5f0000000000000000000c02', shortLink: 'EfGh5678', name: 'Second card', desc: '', idList: 'list-a', idLabels: [], closed: false, dateLastActivity: '2026-11-01T11:00:00.000Z', url: 'https://trello.com/c/EfGh5678/2-second-card', badges: { comments: 0 } }
    ];
    boardActions = [comment('ac0000000000000000000001', BOB, 'hey @alice can you look?'), comment('ac0000000000000000000002', ME, 'replying to @alice thread'), comment('ac0000000000000000000003', BOB, 'no mention here')];
    cardActions = [...boardActions];
    attachments = [];
    downloads = [];
    fake = fakeTrelloContext({
      routes: {
        'GET /boards/board-1/lists': LISTS,
        'GET /boards/board-1/labels': LABELS,
        'GET /boards/board-1/cards': () => cards,
        'GET /boards/board-1/actions': (request: FakeTrelloRequest) => actionsSince(boardActions, request),
        'GET /members/me': ME,
        [`GET /cards/${CARD_ID}`]: () => ({ ...cards[0], list: LISTS[0], labels: LABELS }),
        [`GET /cards/${CARD_ID}/actions`]: () => cardActions.toReversed(),
        [`GET /cards/${CARD_ID}/attachments`]: () => attachments,
        [`GET /cards/${CARD_ID}/attachments/*/download/*`]: (request: FakeTrelloRequest) => {
          downloads.push(request.path);
          return new Response('hello');
        }
      }
    });

    vi.stubEnv(TRELLO_CLI_CONFIG_DIR_ENV_VAR, configDir);
    configureCliOutputWriter((line) => lines.push(line));
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      exitCodes.push(code ?? 0);
    }) as never);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    configureCliOutputWriter(undefined);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  describe('board changes', () => {
    it('should report every card as added on the first --save run and nothing on the second', async () => {
      const first = await run(['board', 'changes', '--save']);

      expect(first.exitCode).toBe(0);
      expect(first.json?.['data']).toMatchObject({ boardId: BOARD_ID, baseline: 'none', saved: true });
      expect(first.json?.['data']['changes'].map((x: { type: string }) => x.type)).toEqual(['added', 'added']);
      expect(existsSync(join(configDir, 'state', 'core', 'boards', `${BOARD_ID}.json`))).toBe(true);

      const second = await run(['board', 'changes', '--save']);

      expect(second.exitCode).toBe(0);
      expect(second.json?.['data']).toMatchObject({ baseline: 'saved', changes: [] });
    });

    it('should print one change per line with --ndjson, and keep the baseline without --save', async () => {
      await run(['board', 'changes', '--save']);
      cards[0] = { ...cards[0], idList: 'list-b', dateLastActivity: '2026-11-02T10:00:00.000Z' };

      const ndjson = await run(['board', 'changes', '--ndjson']);
      const changes = ndjson.lines.map((line) => JSON.parse(line) as Record<string, unknown>);

      expect(changes).toEqual([expect.objectContaining({ type: 'moved', cardId: cards[0].id, fromListName: 'To Do', toListName: 'Doing (WIP)' })]);

      const again = await run(['board', 'changes']);

      expect(again.json?.['data']['changes']).toHaveLength(1);
    });

    it('should save a snapshot with board snapshot --save that board changes then compares against', async () => {
      const snapshot = await run(['board', 'snapshot', '--save']);

      expect(snapshot.json?.['data']['cards']).toHaveLength(2);
      expect(snapshot.json?.['meta']['saved']).toContain(join('state', 'core', 'boards'));

      const changes = await run(['board', 'changes']);

      expect(changes.json?.['data']).toMatchObject({ baseline: 'saved', changes: [] });
    });
  });

  describe('board activity', () => {
    it('should store the watermark with --save and return only newer actions next time', async () => {
      const first = await run(['board', 'activity', '--save']);

      expect(first.json?.['data']['actions']).toHaveLength(3);
      expect(first.json?.['data']['watermark']).toBe('ac0000000000000000000003');

      const second = await run(['board', 'activity', '--save']);

      expect(second.json?.['data']).toMatchObject({ since: 'ac0000000000000000000003', actions: [] });

      const explicit = await run(['board', 'activity', '--since', 'ac0000000000000000000001']);

      expect(explicit.json?.['data']['actions'].map((x: { id: string }) => x.id)).toEqual(['ac0000000000000000000002', 'ac0000000000000000000003']);
    });
  });

  describe('mentions', () => {
    it("should find the authenticated member's mentions on the board, skipping their own comments unless --include-self", async () => {
      const mentions = await run(['board', 'mentions']);

      expect(mentions.json?.['data']).toMatchObject({ username: 'alice', newestMentionId: 'ac0000000000000000000001' });
      expect(mentions.json?.['data']['mentions']).toHaveLength(1);

      const withSelf = await run(['board', 'mentions', '--include-self']);

      expect(withSelf.json?.['data']['mentions']).toHaveLength(2);
    });

    it('should only report new mentions with --save', async () => {
      const first = await run(['board', 'mentions', '--save']);

      expect(first.json?.['data']['mentions']).toHaveLength(1);

      const second = await run(['board', 'mentions', '--save']);

      expect(second.json?.['data']['mentions']).toHaveLength(0);

      boardActions.push(comment('ac0000000000000000000004', BOB, '@alice ping again'));
      const third = await run(['board', 'mentions', '--save']);

      expect(third.json?.['data']['mentions'].map((x: { actionId: string }) => x.actionId)).toEqual(['ac0000000000000000000004']);
    });

    it('should find mentions of another member on one card, after a cursor', async () => {
      cardActions.push(comment('ac0000000000000000000005', ME, 'thanks @bob'), comment('ac0000000000000000000006', ME, '@bob one more'));

      const result = await run(['card', 'mentions', CARD_ID, '--username', '@bob', '--include-self', '--after', 'ac0000000000000000000005']);

      expect(result.json?.['data']).toMatchObject({ cardId: CARD_ID, username: 'bob', newestMentionId: 'ac0000000000000000000006' });
      expect(result.json?.['data']['mentions']).toHaveLength(1);
    });
  });

  describe('board resolve', () => {
    it('should resolve list and label names case-insensitively, ignoring a trailing (…)', async () => {
      const result = await run(['board', 'resolve', '--list', 'to do,DOING', '--label', 'bug']);

      expect(result.exitCode).toBe(0);
      expect(result.json?.['data']).toEqual({ boardId: BOARD_ID, listIds: { 'to do': 'list-a', DOING: 'list-b' }, labelIds: { bug: 'label-1' } });
    });

    it('should fail with INVALID_ARGUMENT and the missing names', async () => {
      const result = await run(['board', 'resolve', '--list', 'Done']);

      expect(result.exitCode).toBe(1);
      expect(result.json).toMatchObject({ ok: false, code: 'INVALID_ARGUMENT' });
      expect(result.json?.['data']['missing']).toEqual([expect.objectContaining({ kind: 'list', name: 'Done', code: 'unknown_list' })]);
    });
  });

  describe('card render', () => {
    it('should keep the notes block across re-renders and only rewrite a changed file', async () => {
      const out = join(dir, 'cards', 'AbCd1234', 'card.md');
      const first = await run(['card', 'render', CARD_ID, '--out', out]);

      expect(first.json?.['data']).toMatchObject({ cardId: CARD_ID, path: out, changed: true });
      expect(readFileSync(out, 'utf8')).toContain('<!-- notes:begin -->');
      expect(readFileSync(out, 'utf8')).toContain('hey @alice can you look?');

      writeFileSync(out, readFileSync(out, 'utf8').replace(/(<!-- notes:begin -->\n)[\s\S]*?(\n<!-- notes:end -->)/, '$1my own notes$2'));
      cards[0] = { ...cards[0], desc: 'An updated description' };

      const second = await run(['card', 'render', CARD_ID, '--out', out]);
      const written = readFileSync(out, 'utf8');

      expect(second.json?.['data']['changed']).toBe(true);
      expect(written).toContain('my own notes');
      expect(written).toContain('An updated description');

      const third = await run(['card', 'render', CARD_ID, '--out', out]);

      expect(third.json?.['data']['changed']).toBe(false);
    });

    it('should print the markdown itself with --raw', async () => {
      const result = await run(['card', 'render', CARD_ID, '--raw']);

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0]).toMatch(/^# First card\n/);
      expect(result.lines[0]).toContain('- **List**: To Do');
      expect(result.lines[0]).toContain('- **Labels**: Bug');
    });

    it('should mirror the attachments next to --out and link them from an Attachments section', async () => {
      attachments = [{ id: ATTACHMENT_FILE_ID, name: 'notes.txt', fileName: 'notes.txt', isUpload: true, bytes: 5, url: 'https://trello.com/1/cards/x/attachments/y/download/notes.txt' }];
      const out = join(dir, 'cards', 'AbCd1234', 'card.md');
      const result = await run(['card', 'render', CARD_ID, '--out', out, '--attachments']);
      const file = trelloCardAttachmentFileName({ id: ATTACHMENT_FILE_ID, name: 'notes.txt', fileName: 'notes.txt' });

      expect(result.json?.['data']['attachments']['entries']).toEqual([expect.objectContaining({ status: 'downloaded', file })]);
      expect(readFileSync(join(dir, 'cards', 'AbCd1234', 'attachments', file), 'utf8')).toBe('hello');
      expect(readFileSync(out, 'utf8')).toContain(`- [notes.txt](attachments/${file})`);
    });

    it('should refuse --attachments without --out or --attachments-dir', async () => {
      const result = await run(['card', 'render', CARD_ID, '--attachments']);

      expect(result.exitCode).toBe(1);
      expect(result.json?.['code']).toBe('INVALID_ARGUMENT');
    });
  });

  describe('card attachments sync', () => {
    it('should download new files, keep cached ones, report links, and remove orphans', async () => {
      const syncDir = join(dir, 'files');
      const orphan = `${ORPHAN_ATTACHMENT_ID}__old.txt`;
      mkdirSync(syncDir, { recursive: true });
      writeFileSync(join(syncDir, orphan), 'stale');
      writeFileSync(join(syncDir, 'keep.md'), 'not a synced file');
      attachments = [
        { id: ATTACHMENT_FILE_ID, name: 'notes.txt', fileName: 'notes.txt', isUpload: true, bytes: 5, url: 'https://trello.com/download' },
        { id: ATTACHMENT_LINK_ID, name: 'Spec', fileName: '', isUpload: false, bytes: null, url: 'https://example.com/spec' }
      ];

      const first = await run(['card', 'attachments', 'sync', CARD_ID, '--dir', syncDir]);

      expect(first.exitCode).toBe(0);
      expect(first.json?.['data']['entries'].map((x: { status: string }) => x.status)).toEqual(['downloaded', 'link']);
      expect(first.json?.['data']['removed']).toEqual([orphan]);
      expect(readdirSync(syncDir).sort()).toEqual([trelloCardAttachmentFileName({ id: ATTACHMENT_FILE_ID, name: 'notes.txt', fileName: 'notes.txt' }), 'keep.md'].sort());
      expect(downloads).toHaveLength(1);

      const second = await run(['card', 'attachments', 'sync', CARD_ID, '--dir', syncDir]);

      expect(second.json?.['data']['entries'].map((x: { status: string }) => x.status)).toEqual(['cached', 'link']);
      expect(downloads).toHaveLength(1);
    });
  });

  describe('card ref', () => {
    it('should parse a card reference and list every shortLink without credentials', async () => {
      const result = await run(['card', 'ref', 'see', 'https://trello.com/c/AbCd1234/1-x', 'and', 'https://trello.com/c/ZyXw9876']);

      expect(result.exitCode).toBe(0);
      expect(result.json?.['data']).toEqual({ ref: 'AbCd1234', shortLinks: ['AbCd1234', 'ZyXw9876'] });
      expect(fake.requests).toHaveLength(0);
    });
  });
});
