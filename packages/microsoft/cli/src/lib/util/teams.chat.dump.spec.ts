import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { CliDownloadAbortedError, CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphChat, type MicrosoftGraphChatMessage, type MicrosoftGraphContext, type MicrosoftGraphDriveItem, microsoftGraphFactory, microsoftGraphShareIdForUrl } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { type FetchHandler } from '@dereekb/util/fetch';
import {
  type MsGraphCliTeamsChatDumpChatManifest,
  type MsGraphCliTeamsChatDumpConfig,
  type MsGraphCliTeamsChatDumpManifest,
  MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE,
  dumpMsGraphCliTeamsChats,
  msGraphCliTeamsChatDumpMessagePath,
  msGraphCliTeamsChatDumpSelectionKey,
  msGraphCliTeamsChatDumpWindowStart,
  msGraphCliTeamsChatKey,
  msGraphCliTeamsHostedContentExtension,
  msGraphCliTeamsReadPacer
} from './teams.chat.dump';
import { msGraphCliMailDumpHash8 } from './mail.dump';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const NOW = Date.parse('2026-11-13T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const CHAT_A = '19:chat-a-secret@thread.v2';
const CHAT_B = '19:chat-b-secret@thread.v2';
const CHAT_C = '19:chat-c-secret@thread.v2';
const HOSTED_ID = 'aWQ9aG9zdGVkLTE=';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function graphError(status: number, code: string): Response {
  return json({ error: { code, message: `fake ${code}` } }, status);
}

/**
 * A raw body sent in chunks; when `hang`, it sends one chunk and stays open until the request is aborted.
 */
function chunkedBody(request: Request, bytes: Uint8Array, hang = false): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.subarray(0, 4));

      if (hang) {
        request.signal.addEventListener('abort', () => controller.error(new DOMException('This operation was aborted', 'AbortError')));
      } else {
        controller.enqueue(bytes.subarray(4));
        controller.close();
      }
    }
  });
}

function iso(time: number): string {
  return new Date(time).toISOString();
}

function hostedUrl(chatId: string, messageId: string, hostedId: string): string {
  return `${GRAPH}/chats/${encodeURIComponent(chatId)}/messages/${messageId}/hostedContents/${encodeURIComponent(hostedId)}/$value`;
}

/**
 * A chat message created at `created`, unchanged since.
 */
function message(created: string, extra: Partial<MicrosoftGraphChatMessage> = {}): MicrosoftGraphChatMessage {
  const id = String(Date.parse(created));
  return { id, messageType: 'message', createdDateTime: created, lastModifiedDateTime: created, from: { user: { displayName: 'Ada Secret' } }, body: { contentType: 'html', content: `<p>secret body ${id}</p>` }, attachments: [], ...extra };
}

interface FakeRequest {
  readonly kind: 'chats' | 'chat' | 'messages' | 'hosted' | 'share' | 'content';
  readonly url: URL;
  readonly headers: Headers;
  readonly at: number;
}

interface FakeShare {
  readonly status?: number;
  readonly item?: MicrosoftGraphDriveItem;
}

/**
 * Stands in for Graph's chat list, get-chat, chat messages, hostedContents, /shares and drive content endpoints.
 *
 * The chat messages endpoint models the OBSERVED semantics, not the documented ones:
 * - models: TC6/TC7 — `$filter=lastModifiedDateTime gt X` returns the messages CREATED after X, in their current state;
 * - models: TC5/TC8 — results are ordered by createdDateTime desc, whatever `$orderby` says;
 * - models: TC9 — pages carry an `@odata.nextLink` with `$top`, `$orderby`, `$filter` and `$skiptoken`;
 * - models: TC10 — without `Prefer: include-unknown-enum-members` a system event reads as `unknownFutureValue`.
 *
 * @param clock - Returns the time a request is recorded at.
 * @returns The fake.
 */
function fakeGraph(clock: () => number = () => NOW) {
  const chats = new Map<string, { chat: MicrosoftGraphChat; messages: MicrosoftGraphChatMessage[] }>();
  const requests: FakeRequest[] = [];
  const listStatus = new Map<string, number>();
  const rejectTokens = new Set<string>();
  const hostedStatus = new Map<string, number>();
  const alsoReturn = new Set<string>();
  const shares = new Map<string, FakeShare>();
  const fake = { pageSize: 2, hangHosted: false, onRequest: undefined as Maybe<(kind: FakeRequest['kind'], url: URL) => void> };

  function addChat(input: { readonly id: string; readonly topic: string; readonly members: string[]; readonly messages?: MicrosoftGraphChatMessage[] }) {
    const { id, topic, members, messages = [] } = input;
    chats.set(id, { chat: { id, topic, chatType: members.length > 2 ? 'group' : 'oneOnOne', webUrl: `https://teams.microsoft.com/l/chat/${id}`, members: members.map((displayName) => ({ displayName, email: `${displayName.split(' ')[0].toLowerCase()}@example.com` })) }, messages });
  }

  function setMessage(chatId: string, value: MicrosoftGraphChatMessage) {
    const list = chats.get(chatId)?.messages ?? [];
    const index = list.findIndex((x) => x.id === value.id);

    if (index >= 0) {
      list[index] = value;
    } else {
      list.push(value);
    }
  }

  function readMessages(request: Request, url: URL, chatId: string): Response {
    const filter = url.searchParams.get('$filter');
    const token = url.searchParams.get('$skiptoken');
    const top = Math.min(Number(url.searchParams.get('$top') ?? 50), fake.pageSize);
    const status = listStatus.get(chatId);
    let response: Response;

    if (status) {
      response = graphError(status, status === 403 ? 'Forbidden' : 'NotFound');
    } else if (token && rejectTokens.has(token)) {
      // a stale token is rejected once; a new walk is handed new tokens
      rejectTokens.delete(token);
      response = graphError(400, 'BadRequest');
    } else {
      const after = filter ? Date.parse(/lastModifiedDateTime gt (\S+)/.exec(filter)?.[1] ?? '') : Number.NEGATIVE_INFINITY;
      const prefer = request.headers.get('Prefer') ?? '';
      const all = (chats.get(chatId)?.messages ?? [])
        .filter((x) => Date.parse(x.createdDateTime as string) > after || alsoReturn.has(x.id))
        .sort((a, b) => Date.parse(b.createdDateTime as string) - Date.parse(a.createdDateTime as string))
        .map((x) => (x.messageType === 'systemEventMessage' && !prefer.includes('include-unknown-enum-members') ? { ...x, messageType: 'unknownFutureValue' as const, eventDetail: undefined } : x));
      const start = token ? Number(token.slice(4)) : 0;
      const value = all.slice(start, start + top);
      const end = start + value.length;
      const next = new URL(`${GRAPH}/chats/${encodeURIComponent(chatId)}/messages`);
      next.searchParams.set('$top', String(url.searchParams.get('$top')));
      next.searchParams.set('$orderby', String(url.searchParams.get('$orderby')));

      if (filter) {
        next.searchParams.set('$filter', filter);
      }

      next.searchParams.set('$skiptoken', `tok-${end}`);
      response = json(end < all.length ? { value, '@odata.nextLink': next.toString() } : { value });
    }

    return response;
  }

  const fetchHandler: FetchHandler = async (request: Request) => {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/v1\.0/, '');
    const record = (kind: FakeRequest['kind']) => {
      requests.push({ kind, url, headers: request.headers, at: clock() });
      fake.onRequest?.(kind, url);
    };
    let response: Response;
    let match: Maybe<RegExpExecArray>;

    if (path === '/me/chats') {
      // models: chat-list — $expand=members, pages linked by @odata.nextLink (2 chats per page here)
      record('chats');
      const all = [...chats.values()].map((x) => x.chat);
      const start = Number(url.searchParams.get('$skiptoken') ?? 0);
      const value = all.slice(start, start + 2);
      response = json(start + 2 < all.length ? { value, '@odata.nextLink': `${GRAPH}/me/chats?$expand=members&$top=50&$skiptoken=${start + 2}` } : { value });
    } else if ((match = /^\/chats\/([^/]+)\/messages\/([^/]+)\/hostedContents\/([^/]+)\/\$value$/.exec(path))) {
      // models: TC14/P6 — the bytes with content-type image/png and no Content-Length
      record('hosted');
      const status = hostedStatus.get(decodeURIComponent(match[3]));
      response = status ? graphError(status, status === 404 ? 'NotFound' : 'ServiceUnavailable') : new Response(chunkedBody(request, PNG, fake.hangHosted), { status: 200, headers: { 'Content-Type': 'image/png' } });
    } else if ((match = /^\/chats\/([^/]+)\/messages$/.exec(path))) {
      record('messages');
      response = readMessages(request, url, decodeURIComponent(match[1]));
    } else if ((match = /^\/chats\/([^/]+)$/.exec(path))) {
      // models: chat-get — $expand=members
      record('chat');
      const chat = chats.get(decodeURIComponent(match[1]));
      response = chat ? json(chat.chat) : graphError(404, 'NotFound');
    } else if ((match = /^\/shares\/([^/]+)\/driveItem$/.exec(path))) {
      // models: TC15/P6 — a chat-file URL resolves to a file with parentReference.driveId
      record('share');
      const share = shares.get(decodeURIComponent(match[1]));
      response = share?.status ? graphError(share.status, share.status === 403 ? 'accessDenied' : 'itemNotFound') : share?.item ? json(share.item) : graphError(404, 'itemNotFound');
    } else if ((match = /^\/drives\/([^/]+)\/items\/([^/]+)\/content$/.exec(path))) {
      // models: driveitem-get-content — the file bytes, with a Content-Length
      record('content');
      const bytes = new TextEncoder().encode(`file ${decodeURIComponent(match[2])}`);
      response = new Response(chunkedBody(request, bytes), { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length) } });
    } else {
      response = graphError(400, 'BadRequest');
    }

    return response;
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token' });

  return { graphContext, chats, requests, listStatus, rejectTokens, hostedStatus, alsoReturn, shares, fake, addChat, setMessage, ofKind: (kind: FakeRequest['kind']) => requests.filter((x) => x.kind === kind) };
}

/**
 * Chat A: five messages, one of them with an inline image (m4).
 *
 * @param graph - The fake.
 * @returns The messages, oldest first.
 */
function seedChatA(graph: ReturnType<typeof fakeGraph>) {
  const m1 = message('2026-11-01T10:00:00.000Z');
  const m2 = message('2026-11-03T10:00:00.000Z');
  const m3 = message('2026-11-07T10:00:00.000Z');
  const m4id = String(Date.parse('2026-11-08T10:00:00.000Z'));
  const m4 = message('2026-11-08T10:00:00.000Z', { body: { contentType: 'html', content: `<p>secret body ${m4id}</p><p><img src="${hostedUrl(CHAT_A, m4id, HOSTED_ID)}" alt="image"></p>` } });
  const m5 = message('2026-11-10T10:00:00.000Z');
  graph.addChat({ id: CHAT_A, topic: 'Secret Topic A', members: ['Ada Secret', 'Grace Secret'], messages: [m1, m2, m3, m4, m5] });
  return [m1, m2, m3, m4, m5];
}

describe('teams chat dump', () => {
  let dir: string;
  const noWait = async () => undefined;

  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'msgraph-teams-dump-')), 'dump');
  });

  afterEach(() => {
    rmSync(join(dir, '..'), { recursive: true, force: true });
  });

  function config(graphContext: MicrosoftGraphContext, overrides: Partial<MsGraphCliTeamsChatDumpConfig> = {}): MsGraphCliTeamsChatDumpConfig {
    return { graphContext, dir, chatId: CHAT_A, markdown: true, hostedContents: true, attachments: false, prune: false, maxMessages: 5000, wait: noWait, now: () => new Date(NOW), readInterval: 0, ...overrides };
  }

  function chatDir(chatId = CHAT_A): string {
    return join(dir, 'chats', msGraphCliTeamsChatKey(chatId));
  }

  function readTop(): MsGraphCliTeamsChatDumpManifest {
    return JSON.parse(readFileSync(join(dir, MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE), 'utf8')) as MsGraphCliTeamsChatDumpManifest;
  }

  function readChat(chatId = CHAT_A): MsGraphCliTeamsChatDumpChatManifest {
    return JSON.parse(readFileSync(join(chatDir(chatId), MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE), 'utf8')) as MsGraphCliTeamsChatDumpChatManifest;
  }

  function messageFile(m: MicrosoftGraphChatMessage, ext: string, chatId = CHAT_A): string {
    return join(chatDir(chatId), `${msGraphCliTeamsChatDumpMessagePath(m)}.${ext}`);
  }

  /**
   * Every path under a directory, relative to it.
   */
  function walkTree(root: string): string[] {
    const result: string[] = [];

    function walk(folder: string) {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        result.push(relative(root, path) + (entry.isDirectory() ? '/' : ''));

        if (entry.isDirectory()) {
          walk(path);
        }
      }
    }

    walk(root);
    return result;
  }

  function jsonFiles(chatId = CHAT_A): string[] {
    return walkTree(chatDir(chatId)).filter((x) => x.startsWith('messages/') && x.endsWith('.json'));
  }

  describe('helpers', () => {
    it('keys the selection by a stable hash and refuses ambiguous selections (D1)', () => {
      expect(msGraphCliTeamsChatDumpSelectionKey({ withNames: ['Grace', 'ada'] })).toBe(msGraphCliTeamsChatDumpSelectionKey({ withNames: ['ADA', ' grace '] }));
      expect(msGraphCliTeamsChatDumpSelectionKey({ withNames: ['ada'] })).not.toBe(msGraphCliTeamsChatDumpSelectionKey({ withNames: ['ada'], chatType: 'group' }));
      expect(msGraphCliTeamsChatDumpSelectionKey({ chatId: CHAT_A })).not.toContain('chat');

      for (const selection of [{}, { allChats: true, topic: 'x' }, { chatId: CHAT_A, allChats: true }, { chatId: CHAT_A, withNames: ['ada'] }, { withNames: [' '] }]) {
        expect(() => msGraphCliTeamsChatDumpSelectionKey(selection)).toThrow(CliError);
      }
    });

    it('starts the window at min(mark - 10 min, now - lookback), raised to since (D2/D14)', () => {
      const now = new Date(NOW);
      expect(msGraphCliTeamsChatDumpWindowStart({ lookbackDays: 7, now })).toBeUndefined();
      expect(msGraphCliTeamsChatDumpWindowStart({ since: new Date('2026-11-05T00:00:00.000Z'), lookbackDays: 7, now })?.toISOString()).toBe('2026-11-04T23:59:59.999Z');
      expect(msGraphCliTeamsChatDumpWindowStart({ mark: '2026-11-12T00:00:00.000Z', lookbackDays: 7, now })?.toISOString()).toBe(iso(NOW - 7 * DAY));
      expect(msGraphCliTeamsChatDumpWindowStart({ mark: '2026-11-12T00:00:00.000Z', lookbackDays: 0, now })?.toISOString()).toBe('2026-11-11T23:50:00.000Z');
      expect(msGraphCliTeamsChatDumpWindowStart({ mark: '2026-11-12T00:00:00.000Z', since: new Date('2026-11-10T00:00:00.000Z'), lookbackDays: 7, now })?.toISOString()).toBe('2026-11-09T23:59:59.999Z');
    });

    it('paces reads at least the interval apart, in call order', async () => {
      let clock = 0;
      const waits: number[] = [];
      const pace = msGraphCliTeamsReadPacer({ interval: 1000, now: () => clock, wait: async (ms) => void waits.push(ms) });

      // three callers at once take the slots 0, 1000 and 2000
      await Promise.all([pace(), pace(), pace()]);
      expect(waits).toEqual([1000, 2000]);

      // a read after the last slot has passed does not wait
      clock = 5000;
      await pace();
      expect(waits).toEqual([1000, 2000]);
      clock = 5500;
      await pace();
      expect(waits).toEqual([1000, 2000, 500]);
    });

    it('names inline images by their type', () => {
      expect(msGraphCliTeamsHostedContentExtension('image/png')).toBe('png');
      expect(msGraphCliTeamsHostedContentExtension('image/jpeg; charset=binary')).toBe('jpg');
      expect(msGraphCliTeamsHostedContentExtension('application/octet-stream')).toBe('bin');
      expect(msGraphCliTeamsHostedContentExtension(undefined)).toBe('bin');
    });
  });

  it('1. writes each message of one chat with private modes, both manifests and chat.json', async () => {
    const graph = fakeGraph();
    const [m1, , , m4] = seedChatA(graph);
    const result = await dumpMsGraphCliTeamsChats(config(graph.graphContext));

    expect(result).toEqual({ dir, chats: 1, written: 5, skipped: 0, removed: 0, failed: 0, files: 1, unsupported: 0, bytes: expect.any(Number), complete: true });
    expect(readFileSync(messageFile(m1, 'md'), 'utf8')).toContain(`secret body ${m1.id}`);
    expect(JSON.parse(readFileSync(messageFile(m4, 'json'), 'utf8')).id).toBe(m4.id);
    expect(existsSync(join(chatDir(), 'chat.json'))).toBe(true);
    expect(jsonFiles()).toHaveLength(5);
    expect(Object.keys(readChat().messages)).toHaveLength(5);
    expect(readChat().walk).toBeUndefined();
    expect(readTop().chats[msGraphCliTeamsChatKey(CHAT_A)].mark).toBe(readChat().mark);

    // models: TC1/TC10 — ordered by lastModifiedDateTime desc, system events included, no $filter on a first full read
    const first = graph.ofKind('messages')[0];
    expect(first.url.searchParams.get('$orderby')).toBe('lastModifiedDateTime desc');
    expect(first.url.searchParams.has('$filter')).toBe(false);
    expect(first.headers.get('Prefer')).toBe('include-unknown-enum-members');
    expect(graph.ofKind('messages')).toHaveLength(3);

    const tree = walkTree(dir);
    expect(tree.some((x) => x.endsWith('.part'))).toBe(false);

    for (const path of tree) {
      expect(statSync(join(dir, path)).mode & 0o777).toBe(path.endsWith('/') ? 0o700 : 0o600);
    }

    expect(statSync(dir).mode & 0o777).toBe(0o700);
  });

  it('2. never prints or stores ids, names, topics, bodies or URLs in the result, progress or top-level manifest', async () => {
    const graph = fakeGraph();
    const messages = seedChatA(graph);
    const lines: string[] = [];
    const result = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { allChats: true, chatId: undefined, progress: (x) => lines.push(x) }));
    const printed = [JSON.stringify(result), ...lines, readFileSync(join(dir, MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE), 'utf8')].join('\n');

    expect(lines.length).toBeGreaterThan(0);

    for (const secret of [CHAT_A, 'chat-a-secret', 'Secret Topic A', 'Ada Secret', 'Grace Secret', 'secret body', 'https://', ...messages.map((x) => x.id)]) {
      expect(printed).not.toContain(secret);
    }
  });

  it('3. re-reads only the lookback window on a re-run, and writes nothing unchanged', async () => {
    const graph = fakeGraph();
    seedChatA(graph);
    await dumpMsGraphCliTeamsChats(config(graph.graphContext));
    const before = graph.requests.length;
    const result = await dumpMsGraphCliTeamsChats(config(graph.graphContext));
    const rerun = graph.requests.slice(before);

    // mark = m5 (Nov 10); min(mark - 10 min, now - 7 d) = Nov 6 12:00
    expect(rerun.find((x) => x.kind === 'messages')?.url.searchParams.get('$filter')).toBe(`lastModifiedDateTime gt ${iso(NOW - 7 * DAY)}`);
    expect(result).toMatchObject({ written: 0, skipped: 3, complete: true });
    expect(rerun.filter((x) => x.kind === 'hosted' || x.kind === 'share')).toHaveLength(0);
  });

  it('4. rewrites an edited message inside the lookback in place; --lookback 0 misses it (TC7)', async () => {
    const graph = fakeGraph();
    const [, , m3] = seedChatA(graph);
    await dumpMsGraphCliTeamsChats(config(graph.graphContext));
    const path = messageFile(m3, 'json');

    // models: TC3/TC7 — the edit moves lastModifiedDateTime, but `gt <mark>` only returns messages created after it
    graph.setMessage(CHAT_A, { ...m3, lastModifiedDateTime: '2026-11-12T09:00:00.000Z', lastEditedDateTime: '2026-11-12T09:00:00.000Z', body: { contentType: 'html', content: '<p>edited secret</p>' } });

    const missed = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { lookbackDays: 0 }));
    expect(missed.written).toBe(0);
    expect(readFileSync(path, 'utf8')).not.toContain('edited secret');

    const caught = await dumpMsGraphCliTeamsChats(config(graph.graphContext));
    expect(caught.written).toBe(1);
    expect(readFileSync(path, 'utf8')).toContain('edited secret');
    expect(readFileSync(messageFile(m3, 'md'), 'utf8')).toContain('(edited 2026-11-12T09:00:00.000Z)');
    expect(jsonFiles()).toHaveLength(5);
  });

  describe('5. soft deletes', () => {
    function softDelete(graph: ReturnType<typeof fakeGraph>, m: MicrosoftGraphChatMessage) {
      // models: TC4 — a soft-deleted message stays in the list, body emptied, no attachments, lastModifiedDateTime moved
      graph.setMessage(CHAT_A, { ...m, deletedDateTime: '2026-11-12T08:00:00.000Z', lastModifiedDateTime: '2026-11-12T08:00:00.000Z', body: { contentType: 'html', content: '' }, attachments: [] });
    }

    it('keeps the files, marks the .md and records the removal', async () => {
      const graph = fakeGraph();
      const [, , , m4] = seedChatA(graph);
      await dumpMsGraphCliTeamsChats(config(graph.graphContext));
      softDelete(graph, m4);
      const result = await dumpMsGraphCliTeamsChats(config(graph.graphContext));
      const chat = readChat();

      expect(result).toMatchObject({ removed: 1, written: 0 });
      expect(readFileSync(messageFile(m4, 'json'), 'utf8')).toContain(`secret body ${m4.id}`);
      const md = readFileSync(messageFile(m4, 'md'), 'utf8');
      expect(md).toContain('Deleted: 2026-11-12T08:00:00.000Z');
      expect(md).toContain(`secret body ${m4.id}`);
      expect(md).toMatch(/!\[image\]\([^)]+\/hosted\/[0-9a-f]{8}\.png\)/);
      expect(chat.messages[m4.id].deletedDateTime).toBe('2026-11-12T08:00:00.000Z');
      expect(chat.messages[m4.id].file).toBeDefined();
      expect(chat.removed).toEqual([{ id: m4.id, reason: 'softDeleted', at: iso(NOW), pruned: false }]);

      // a re-run records it once
      expect((await dumpMsGraphCliTeamsChats(config(graph.graphContext))).removed).toBe(0);
    });

    it('--prune deletes the files; an undo writes it again', async () => {
      const graph = fakeGraph();
      const [, , , m4] = seedChatA(graph);
      await dumpMsGraphCliTeamsChats(config(graph.graphContext));
      softDelete(graph, m4);
      await dumpMsGraphCliTeamsChats(config(graph.graphContext, { prune: true }));

      expect(existsSync(messageFile(m4, 'json'))).toBe(false);
      expect(existsSync(messageFile(m4, 'md'))).toBe(false);
      expect(existsSync(join(chatDir(), msGraphCliTeamsChatDumpMessagePath(m4)))).toBe(false);
      expect(readChat().messages[m4.id]).toEqual({ lastModifiedDateTime: '2026-11-12T08:00:00.000Z', deletedDateTime: '2026-11-12T08:00:00.000Z' });
      expect(readChat().removed[0].pruned).toBe(true);

      // models: chatmessage-undosoftdelete — the content comes back with a new lastModifiedDateTime
      graph.setMessage(CHAT_A, { ...m4, lastModifiedDateTime: '2026-11-12T09:00:00.000Z' });
      const undo = await dumpMsGraphCliTeamsChats(config(graph.graphContext));
      expect(undo.written).toBe(1);
      expect(existsSync(messageFile(m4, 'json'))).toBe(true);
      expect(readChat().messages[m4.id].deletedDateTime).toBeUndefined();
    });

    it('records a message first seen deleted, without files', async () => {
      const graph = fakeGraph();
      seedChatA(graph);
      const m6 = message('2026-11-11T10:00:00.000Z', { deletedDateTime: '2026-11-11T11:00:00.000Z', lastModifiedDateTime: '2026-11-11T11:00:00.000Z', body: { contentType: 'html', content: '' } });
      graph.setMessage(CHAT_A, m6);
      const result = await dumpMsGraphCliTeamsChats(config(graph.graphContext));

      expect(result).toMatchObject({ written: 5, removed: 1 });
      expect(readChat().messages[m6.id]).toEqual({ lastModifiedDateTime: '2026-11-11T11:00:00.000Z', deletedDateTime: '2026-11-11T11:00:00.000Z' });
      expect(existsSync(messageFile(m6, 'json'))).toBe(false);
    });
  });

  it('6. sets the mark to min(newest seen, walk start), so a message created during the walk is read next run', async () => {
    const graph = fakeGraph();
    const [, , , , m5] = seedChatA(graph);
    const late = message(iso(NOW + 60_000));
    let pages = 0;

    // models: TC6 — a message posted while the walk pages is behind the cursor (created desc), so this walk misses it
    graph.fake.onRequest = (kind) => {
      if (kind === 'messages' && (pages += 1) === 2) {
        graph.setMessage(CHAT_A, late);
      }
    };

    const first = await dumpMsGraphCliTeamsChats(config(graph.graphContext));
    expect(first.written).toBe(5);
    expect(readChat().mark).toBe(m5.lastModifiedDateTime);

    const next = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { lookbackDays: 0 }));
    expect(next.written).toBe(1);
    expect(existsSync(messageFile(late, 'json'))).toBe(true);
    // the newest seen (the late message) is after the walk's start, so the mark is the start
    expect(readChat().mark).toBe(iso(NOW));
  });

  describe('7. budgets', () => {
    it('--max-messages stops inside the walk at the page start; the re-run finishes without duplicates', async () => {
      const graph = fakeGraph();
      seedChatA(graph);
      const partial = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { maxMessages: 3 }));
      const chat = readChat();

      expect(partial).toMatchObject({ written: 3, complete: false });
      expect(chat.mark).toBeUndefined();
      expect(chat.walk?.skipToken).toBe('tok-2');
      expect(readTop().chats[msGraphCliTeamsChatKey(CHAT_A)].mark).toBeUndefined();

      const rest = await dumpMsGraphCliTeamsChats(config(graph.graphContext));
      expect(rest).toMatchObject({ written: 2, skipped: 1, complete: true });
      expect(graph.ofKind('messages').at(-2)?.url.searchParams.get('$skiptoken')).toBe('tok-2');
      expect(readChat().mark).toBeDefined();
      expect(readChat().walk).toBeUndefined();
      expect(jsonFiles()).toHaveLength(5);
    });

    it('--max-bytes defers the rest of the run the same way', async () => {
      const graph = fakeGraph();
      seedChatA(graph);
      const partial = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { maxBytes: 1, concurrency: 1 }));

      expect(partial).toMatchObject({ written: 1, complete: false });
      expect(readChat().walk).toBeDefined();
      expect(readChat().mark).toBeUndefined();

      const rest = await dumpMsGraphCliTeamsChats(config(graph.graphContext));
      expect(rest).toMatchObject({ written: 4, complete: true });
      expect(jsonFiles()).toHaveLength(5);
    });
  });

  it('8. restarts the walk once from page 1 when a stored skip token is rejected (D3)', async () => {
    const graph = fakeGraph();
    seedChatA(graph);
    await dumpMsGraphCliTeamsChats(config(graph.graphContext, { maxMessages: 2 }));
    expect(readChat().walk?.skipToken).toBe('tok-2');

    graph.rejectTokens.add('tok-2');
    const before = graph.requests.length;
    const result = await dumpMsGraphCliTeamsChats(config(graph.graphContext));
    const pages = graph.requests.slice(before).filter((x) => x.kind === 'messages');

    expect(pages[0].url.searchParams.get('$skiptoken')).toBe('tok-2');
    expect(pages[1].url.searchParams.has('$skiptoken')).toBe(false);
    expect(pages[1].url.searchParams.get('$filter')).toBe(pages[0].url.searchParams.get('$filter'));
    expect(result).toMatchObject({ written: 3, skipped: 2, failed: 0, complete: true });
    expect(jsonFiles()).toHaveLength(5);
  });

  describe('9. inline images', () => {
    it('downloads through the builder with ConsistencyLevel: eventual and links it; a rewrite does not fetch it again', async () => {
      const graph = fakeGraph();
      const [, , , m4] = seedChatA(graph);
      await dumpMsGraphCliTeamsChats(config(graph.graphContext));
      const hosted = graph.ofKind('hosted');
      const name = `${msGraphCliMailDumpHash8(HOSTED_ID)}.png`;
      const stem = msGraphCliTeamsChatDumpMessagePath(m4).split('/').at(-1);

      expect(hosted).toHaveLength(1);
      expect(hosted[0].headers.get('ConsistencyLevel')).toBe('eventual');
      expect(hosted[0].url.pathname).toBe(`/v1.0/chats/${encodeURIComponent(CHAT_A)}/messages/${m4.id}/hostedContents/${encodeURIComponent(HOSTED_ID)}/$value`);
      expect(readFileSync(join(chatDir(), msGraphCliTeamsChatDumpMessagePath(m4), 'hosted', name))).toEqual(Buffer.from(PNG));
      expect(readFileSync(messageFile(m4, 'md'), 'utf8')).toContain(`![image](${stem}/hosted/${name})`);

      graph.setMessage(CHAT_A, { ...m4, lastModifiedDateTime: '2026-11-12T00:00:00.000Z' });
      const rewrite = await dumpMsGraphCliTeamsChats(config(graph.graphContext));
      expect(rewrite.written).toBe(1);
      expect(graph.ofKind('hosted')).toHaveLength(1);
    });

    it('records a 404 as missing and retries it next run', async () => {
      const graph = fakeGraph();
      const [, , , m4] = seedChatA(graph);
      graph.hostedStatus.set(HOSTED_ID, 404);
      const result = await dumpMsGraphCliTeamsChats(config(graph.graphContext));

      expect(result).toMatchObject({ written: 5, failed: 1, files: 0, failedCodes: { NOT_FOUND: 1 } });
      expect(readChat().messages[m4.id].missing).toBe(1);
      expect(readFileSync(messageFile(m4, 'md'), 'utf8')).toContain('[image: not downloaded]');

      graph.hostedStatus.delete(HOSTED_ID);
      const retry = await dumpMsGraphCliTeamsChats(config(graph.graphContext));
      expect(retry).toMatchObject({ written: 1, files: 1, failed: 0 });
      expect(readChat().messages[m4.id].missing).toBeUndefined();
    });

    it('--no-hosted-contents reads no image', async () => {
      const graph = fakeGraph();
      seedChatA(graph);
      await dumpMsGraphCliTeamsChats(config(graph.graphContext, { hostedContents: false }));
      expect(graph.ofKind('hosted')).toHaveLength(0);
    });
  });

  it('10. --attachments resolves reference files through /shares and skips folders, 403s and other types', async () => {
    const graph = fakeGraph();
    const fileUrl = 'https://contoso-my.sharepoint.com/personal/ada_contoso_com/Documents/Microsoft Teams Chat Files/secret report.pdf';
    const folderUrl = 'https://contoso.sharepoint.com/sites/Team/Shared Documents/Folder';
    const deniedUrl = 'https://contoso.sharepoint.com/sites/Other/Shared Documents/x.pdf';
    const m = message('2026-11-09T10:00:00.000Z', {
      attachments: [
        { id: 'att-1', contentType: 'reference', contentUrl: fileUrl, name: 'secret report.pdf' },
        { id: 'att-2', contentType: 'reference', contentUrl: folderUrl, name: 'Folder' },
        { id: 'att-3', contentType: 'reference', contentUrl: deniedUrl, name: 'x.pdf' },
        // models: TC11/TC12 — quoted replies and cards carry their content inline: nothing to download
        { id: 'q-1', contentType: 'messageReference', content: '{}' },
        { id: 'c-1', contentType: 'application/vnd.microsoft.card.adaptive', content: '{}' }
      ]
    });
    graph.addChat({ id: CHAT_A, topic: 'Secret Topic A', members: ['Ada Secret', 'Grace Secret'], messages: [m] });
    graph.shares.set(microsoftGraphShareIdForUrl(fileUrl), { item: { id: 'item-1', name: 'secret report.pdf', size: 12, file: {}, parentReference: { driveId: 'drive-1' } } });
    graph.shares.set(microsoftGraphShareIdForUrl(folderUrl), { item: { id: 'item-2', name: 'Folder', folder: { childCount: 1 }, parentReference: { driveId: 'drive-1' } } });
    graph.shares.set(microsoftGraphShareIdForUrl(deniedUrl), { status: 403 });

    const result = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { attachments: true }));
    const share = graph.ofKind('share');
    const attachment = join(chatDir(), msGraphCliTeamsChatDumpMessagePath(m), 'attachments', `${msGraphCliMailDumpHash8('att-1')}_secret report.pdf`);

    expect(result).toMatchObject({ written: 1, files: 1, unsupported: 1, failed: 1, failedCodes: { SCOPE_DENIED: 1 } });
    expect(share).toHaveLength(3);
    expect(share[0].url.pathname).toBe(`/v1.0/shares/${microsoftGraphShareIdForUrl(fileUrl)}/driveItem`);
    expect(share[0].url.searchParams.get('$select')).toContain('parentReference');
    expect(graph.ofKind('content').map((x) => x.url.pathname)).toEqual(['/v1.0/drives/drive-1/items/item-1/content']);
    expect(readFileSync(attachment, 'utf8')).toBe('file item-1');
    expect(readChat().messages[m.id].missing).toBe(1);
    const md = readFileSync(messageFile(m, 'md'), 'utf8');
    expect(md).toContain(`- Attachment: secret report.pdf → `);
    expect(md).toContain('- Attachment: x.pdf [not downloaded]');
  });

  it('11. stops on an outage that outlasts its retries with the cursor at the page start; the re-run finishes', async () => {
    const graph = fakeGraph();
    const [, , , m4, m5] = seedChatA(graph);
    // models: C-b — an outage answers 503 on every retry
    graph.hostedStatus.set(HOSTED_ID, 503);

    await expect(dumpMsGraphCliTeamsChats(config(graph.graphContext))).rejects.toBeDefined();
    const chat = readChat();
    expect(chat.walk).toBeDefined();
    expect(chat.walk?.skipToken).toBeUndefined();
    expect(chat.messages[m5.id]).toBeDefined();
    expect(chat.messages[m4.id]).toBeUndefined();
    expect(chat.mark).toBeUndefined();
    expect(existsSync(join(dir, MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE))).toBe(true);

    graph.hostedStatus.delete(HOSTED_ID);
    const rest = await dumpMsGraphCliTeamsChats(config(graph.graphContext));
    expect(rest).toMatchObject({ written: 4, complete: true });
    expect(jsonFiles()).toHaveLength(5);
  });

  it('12. an abort mid-page throws ABORTED with the manifests saved and no .part left', async () => {
    const graph = fakeGraph();
    seedChatA(graph);
    const controller = new AbortController();
    graph.fake.hangHosted = true;
    graph.fake.onRequest = (kind) => {
      if (kind === 'hosted') {
        setTimeout(() => controller.abort(), 10);
      }
    };

    await expect(dumpMsGraphCliTeamsChats(config(graph.graphContext, { signal: controller.signal }))).rejects.toBeInstanceOf(CliDownloadAbortedError);
    expect(readChat().walk).toBeDefined();
    expect(existsSync(join(dir, MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE))).toBe(true);
    expect(walkTree(dir).some((x) => x.endsWith('.part'))).toBe(false);
  });

  describe('13. several chats', () => {
    function seedChats(graph: ReturnType<typeof fakeGraph>) {
      seedChatA(graph);
      graph.addChat({ id: CHAT_B, topic: 'Secret Topic B', members: ['Ada Secret', 'Linus Secret'], messages: [message('2026-11-09T10:00:00.000Z')] });
      graph.addChat({ id: CHAT_C, topic: 'Secret Topic C', members: ['Ada Secret', 'Grace Secret', 'Linus Secret'], messages: [message('2026-11-09T11:00:00.000Z')] });
    }

    it('--all-chats walks every chat in key order and picks up a new chat next run', async () => {
      const graph = fakeGraph();
      seedChatA(graph);
      graph.addChat({ id: CHAT_B, topic: 'Secret Topic B', members: ['Ada Secret', 'Linus Secret'], messages: [message('2026-11-09T10:00:00.000Z')] });
      const lines: string[] = [];
      const result = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { chatId: undefined, allChats: true, progress: (x) => lines.push(x) }));
      const order = [...new Set(graph.ofKind('messages').map((x) => decodeURIComponent(x.url.pathname.split('/')[3])))];

      expect(result).toMatchObject({ chats: 2, written: 6, complete: true });
      expect(order).toEqual([CHAT_A, CHAT_B].sort((a, b) => msGraphCliTeamsChatKey(a).localeCompare(msGraphCliTeamsChatKey(b))));
      expect(lines[0]).toBe('chat dump: 2 chats (2 new)');

      graph.addChat({ id: CHAT_C, topic: 'Secret Topic C', members: ['Ada Secret'], messages: [message('2026-11-09T11:00:00.000Z')] });
      lines.length = 0;
      const next = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { chatId: undefined, allChats: true, progress: (x) => lines.push(x) }));
      expect(lines[0]).toBe('chat dump: 3 chats (1 new)');
      expect(next).toMatchObject({ chats: 3, written: 1 });
      expect(Object.keys(readTop().chats)).toHaveLength(3);
    });

    it('--with keeps only the matching chats and never reads the others', async () => {
      const graph = fakeGraph();
      seedChats(graph);
      const result = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { chatId: undefined, withNames: ['grace'] }));
      const read = new Set(graph.ofKind('messages').map((x) => decodeURIComponent(x.url.pathname.split('/')[3])));

      expect(result).toMatchObject({ chats: 2, written: 6 });
      expect(read).toEqual(new Set([CHAT_A, CHAT_C]));
      expect(existsSync(chatDir(CHAT_B))).toBe(false);
    });

    it('records a chat that cannot be read and goes on with the others', async () => {
      const graph = fakeGraph();
      seedChats(graph);
      graph.listStatus.set(CHAT_B, 403);
      const result = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { chatId: undefined, allChats: true }));

      expect(result).toMatchObject({ chats: 3, written: 6, failed: 1, complete: false, failedCodes: { SCOPE_DENIED: 1 } });
      expect(readTop().chats[msGraphCliTeamsChatKey(CHAT_B)].failed?.code).toBe('SCOPE_DENIED');

      graph.listStatus.delete(CHAT_B);
      const next = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { chatId: undefined, allChats: true }));
      expect(next).toMatchObject({ written: 1, complete: true });
      expect(readTop().chats[msGraphCliTeamsChatKey(CHAT_B)].failed).toBeUndefined();
    });
  });

  describe('14. identity', () => {
    it('refuses another selection or --since, and inherits the stored --since', async () => {
      const graph = fakeGraph();
      seedChatA(graph);
      const since = new Date('2026-11-05T00:00:00.000Z');
      await dumpMsGraphCliTeamsChats(config(graph.graphContext, { since }));

      await expect(dumpMsGraphCliTeamsChats(config(graph.graphContext, { since, chatId: undefined, allChats: true }))).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
      await expect(dumpMsGraphCliTeamsChats(config(graph.graphContext, { since: new Date('2026-11-06T00:00:00.000Z') }))).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

      const inherited = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { lookbackDays: 3650 }));
      expect(inherited.written).toBe(0);
      expect(graph.ofKind('messages').at(-1)?.url.searchParams.get('$filter')).toBe('lastModifiedDateTime gt 2026-11-04T23:59:59.999Z');
      expect(readTop().since).toBe(since.toISOString());
    });

    it('refuses a non-empty foreign directory and a mail dump directory', async () => {
      const graph = fakeGraph();
      seedChatA(graph);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'notes.txt'), 'x');
      await expect(dumpMsGraphCliTeamsChats(config(graph.graphContext))).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

      rmSync(join(dir, 'notes.txt'));
      writeFileSync(join(dir, MSGRAPH_CLI_TEAMS_CHAT_DUMP_MANIFEST_FILE), JSON.stringify({ version: 1, mailbox: 'me', folder: 'inbox', immutableIds: true, counts: {}, messages: {}, removed: [] }));
      await expect(dumpMsGraphCliTeamsChats(config(graph.graphContext))).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    });
  });

  it('15. skips a message created before --since that a re-walk returns', async () => {
    const graph = fakeGraph();
    const [, m2] = seedChatA(graph);
    const since = new Date('2026-11-05T00:00:00.000Z');
    const first = await dumpMsGraphCliTeamsChats(config(graph.graphContext, { since }));
    expect(first.written).toBe(3);

    // models: TC7 — a change to an older message is sometimes returned anyway (reactions 5/60)
    graph.setMessage(CHAT_A, { ...m2, lastModifiedDateTime: '2026-11-12T00:00:00.000Z' });
    graph.alsoReturn.add(m2.id);
    const next = await dumpMsGraphCliTeamsChats(config(graph.graphContext));

    expect(next).toMatchObject({ written: 0, skipped: 4 });
    expect(existsSync(messageFile(m2, 'json'))).toBe(false);
  });

  it('16. paces Teams reads 1 per second and leaves SharePoint calls unpaced', async () => {
    let clock = NOW;
    const graph = fakeGraph(() => clock);
    const fileUrl = 'https://contoso-my.sharepoint.com/personal/ada/Documents/a.pdf';
    seedChatA(graph);
    graph.setMessage(CHAT_A, message('2026-11-09T10:00:00.000Z', { attachments: [{ id: 'att-1', contentType: 'reference', contentUrl: fileUrl, name: 'a.pdf' }] }));
    graph.shares.set(microsoftGraphShareIdForUrl(fileUrl), { item: { id: 'item-1', file: {}, parentReference: { driveId: 'drive-1' } } });

    await dumpMsGraphCliTeamsChats(
      config(graph.graphContext, {
        chatId: undefined,
        allChats: true,
        attachments: true,
        concurrency: 1,
        readInterval: 1000,
        now: () => new Date(clock),
        wait: async (ms) => void (clock += ms)
      })
    );

    // models: TC16 — 1 rps per chat and per user for Teams reads
    const teams = graph.requests.filter((x) => x.kind === 'chats' || x.kind === 'chat' || x.kind === 'messages' || x.kind === 'hosted');
    expect(teams.map((x) => x.kind)).toContain('hosted');
    teams.slice(1).forEach((x, i) => expect(x.at - teams[i].at).toBeGreaterThanOrEqual(1000));
    expect(graph.ofKind('share')).toHaveLength(1);
    expect(graph.ofKind('content')).toHaveLength(1);
    // only the Teams reads waited
    expect(clock - NOW).toBe((teams.length - 1) * 1000);
  });

  it('17. renders a system event as _<event>_', async () => {
    const graph = fakeGraph();
    // models: TC10 — read with Prefer: include-unknown-enum-members, a system event is systemEventMessage + eventDetail
    const event = message('2026-11-09T10:00:00.000Z', { messageType: 'systemEventMessage', from: undefined, body: { contentType: 'html', content: '<systemEventMessage/>' }, eventDetail: { '@odata.type': '#microsoft.graph.membersAddedEventMessageDetail' } });
    graph.addChat({ id: CHAT_A, topic: 'Secret Topic A', members: ['Ada Secret', 'Grace Secret'], messages: [event] });
    await dumpMsGraphCliTeamsChats(config(graph.graphContext));

    expect(readFileSync(messageFile(event, 'md'), 'utf8')).toContain('_membersAdded_');
    expect(JSON.parse(readFileSync(messageFile(event, 'json'), 'utf8')).messageType).toBe('systemEventMessage');
  });
});
