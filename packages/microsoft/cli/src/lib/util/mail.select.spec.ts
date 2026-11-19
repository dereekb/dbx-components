import { describe, expect, it } from 'vitest';
import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphMessageWriteResult, microsoftGraphFactory } from '@dereekb/microsoft';
import { type FetchHandler } from '@dereekb/util/fetch';
import {
  type MsGraphCliMailSelection,
  MSGRAPH_CLI_MAIL_SEARCH_MAY_TRUNCATE_AT,
  checkMsGraphCliMailSelectionFolders,
  collectMsGraphCliMailSelection,
  msGraphCliMailSelectionSummary,
  msGraphCliMailSelectionWriteOutput,
  msGraphCliMailTargetMode,
  msGraphCliRunDeadline,
  msGraphCliSelectionMaxRetryAfterSeconds,
  readMsGraphCliMailSelection
} from './mail.select';
import { runMsGraphCliMessageWrites } from './mail.write';

function fakeGraph(answer: (url: URL) => unknown) {
  const urls: URL[] = [];
  const fetchHandler: FetchHandler = async (request) => {
    const url = new URL(request.url);
    urls.push(url);
    return new Response(JSON.stringify(answer(url)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token' });
  return { graphContext, urls };
}

function ids(prefix: string, count: number): { id: string }[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}` }));
}

function invalidArgument(run: () => unknown): CliError {
  let error: unknown;

  try {
    run();
  } catch (e) {
    error = e;
  }

  expect(error).toBeInstanceOf(CliError);
  expect((error as CliError).code).toBe('INVALID_ARGUMENT');
  return error as CliError;
}

describe('msGraphCliMailTargetMode()', () => {
  const mode = (hasIds: boolean, selection: MsGraphCliMailSelection) => msGraphCliMailTargetMode({ hasIds, selection });

  it('returns ids for ids with no selection', () => {
    expect(mode(true, {})).toBe('ids');
  });

  it('returns list for any list filter, and for --whole-folder with an explicit --folder', () => {
    expect(mode(false, { from: 'a@example.com' })).toBe('list');
    expect(mode(false, { since: new Date('2026-01-01') })).toBe('list');
    expect(mode(false, { category: 'x' })).toBe('list');
    expect(mode(false, { unread: true, folder: 'archive' })).toBe('list');
    expect(mode(false, { folder: 'AAMk', wholeFolder: true })).toBe('list');
  });

  it('returns search for --search alone or with --folder', () => {
    expect(mode(false, { search: 'from:ramp.com', folder: 'inbox' })).toBe('search');
  });

  it.each<[string, { readonly hasIds: boolean; readonly selection: MsGraphCliMailSelection; readonly message: string }]>([
    ['ids with a filter', { hasIds: true, selection: { from: 'a@example.com' }, message: 'not both' }],
    ['ids with --folder', { hasIds: true, selection: { folder: 'inbox' }, message: 'not both' }],
    ['ids with --max-messages', { hasIds: true, selection: { maxMessages: 5 }, message: 'not both' }],
    ['ids with --max-seconds', { hasIds: true, selection: { maxSeconds: 5 }, message: 'not both' }],
    ['a blank --search', { hasIds: false, selection: { search: '  ' }, message: 'needs a query' }],
    ['--search with a filter', { hasIds: false, selection: { search: 'x', from: 'a@example.com' }, message: 'cannot combine' }],
    ['--search with --category', { hasIds: false, selection: { search: 'x', category: 'c' }, message: 'cannot combine' }],
    ['--search with --whole-folder', { hasIds: false, selection: { search: 'x', folder: 'inbox', wholeFolder: true }, message: '--whole-folder' }],
    ['--whole-folder without --folder', { hasIds: false, selection: { wholeFolder: true }, message: 'explicit --folder' }],
    ['--whole-folder with a filter', { hasIds: false, selection: { wholeFolder: true, folder: 'inbox', from: 'a@example.com' }, message: 'explicit --folder' }],
    ['--folder alone', { hasIds: false, selection: { folder: 'inbox' }, message: '--folder alone' }],
    ['nothing at all', { hasIds: false, selection: {}, message: 'No ids given' }]
  ])('refuses %s', (_, { hasIds, selection, message }) => {
    expect(invalidArgument(() => mode(hasIds, selection)).message).toContain(message);
  });

  it('suggests the one-command selection when nothing is given', () => {
    expect(invalidArgument(() => mode(false, {})).suggestion).toContain('--folder inbox --from');
  });
});

describe('readMsGraphCliMailSelection()', () => {
  it('parses dates, trims the category and leaves unset options undefined', () => {
    const selection = readMsGraphCliMailSelection({ since: '2026-01-01', category: '  msgraph-cli: delete ', maxMessages: 10 });
    expect(selection.since?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(selection.category).toBe('msgraph-cli: delete');
    expect(selection.maxMessages).toBe(10);
    expect(selection.maxSeconds).toBeUndefined();
    expect(selection.unread).toBeUndefined();
  });

  it('refuses a blank category and bad budget numbers', () => {
    invalidArgument(() => readMsGraphCliMailSelection({ category: ' ' }));
    invalidArgument(() => readMsGraphCliMailSelection({ maxMessages: 0 }));
    invalidArgument(() => readMsGraphCliMailSelection({ maxMessages: 1.5 }));
    invalidArgument(() => readMsGraphCliMailSelection({ maxSeconds: -1 }));
    expect(readMsGraphCliMailSelection({ maxSeconds: 0 }).maxSeconds).toBe(0);
  });
});

describe('checkMsGraphCliMailSelectionFolders()', () => {
  it('never lets a soft delete select from Deleted Items', () => {
    expect(invalidArgument(() => checkMsGraphCliMailSelectionFolders({ command: 'delete', folder: 'DeletedItems' })).message).toContain('Deleted Items');
  });

  it('only lets a selected --hard delete select from Deleted Items', () => {
    invalidArgument(() => checkMsGraphCliMailSelectionFolders({ command: 'delete', hard: true }));
    invalidArgument(() => checkMsGraphCliMailSelectionFolders({ command: 'delete', hard: true, folder: 'inbox' }));
    checkMsGraphCliMailSelectionFolders({ command: 'delete', hard: true, folder: 'deleteditems' });
    // an id is checked after the pre-flight
    checkMsGraphCliMailSelectionFolders({ command: 'delete', hard: true, folder: 'AAMkDI' });
  });

  it('refuses a move to its own source folder, including the default inbox', () => {
    invalidArgument(() => checkMsGraphCliMailSelectionFolders({ command: 'move', to: 'Inbox' }));
    invalidArgument(() => checkMsGraphCliMailSelectionFolders({ command: 'move', folder: 'archive', to: 'archive' }));
    checkMsGraphCliMailSelectionFolders({ command: 'move', folder: 'inbox', to: 'archive' });
  });
});

describe('collectMsGraphCliMailSelection()', () => {
  const base = { mailbox: 'billing@hellosubs.co', immutableIds: true };

  it('follows every page before returning and takes matched from @odata.count', async () => {
    const graph = fakeGraph((url) => (url.searchParams.get('$skip') ? { value: ids('b', 2) } : { '@odata.count': 5, value: ids('a', 3), '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users/billing%40hellosubs.co/mailFolders/inbox/messages?$skip=3' }));
    const collected = await collectMsGraphCliMailSelection({ ...base, graphContext: graph.graphContext, mode: 'list', selection: { from: 'noreply@bill.com' }, maxMessages: 1000 });

    expect(graph.urls).toHaveLength(2);
    expect(graph.urls[0].pathname).toBe('/v1.0/users/billing%40hellosubs.co/mailFolders/inbox/messages');
    expect(graph.urls[0].searchParams.get('$count')).toBe('true');
    expect(graph.urls[0].searchParams.get('$top')).toBe('1000');
    expect(collected).toMatchObject({ ids: ['a0', 'a1', 'a2', 'b0', 'b1'], matched: 5, counted: true, stale: 0 });
    expect(collected.stopped).toBeUndefined();
  });

  it('stops at maxMessages when more remain', async () => {
    const graph = fakeGraph(() => ({ '@odata.count': 5, value: ids('a', 2), '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$skip=2' }));
    const collected = await collectMsGraphCliMailSelection({ ...base, graphContext: graph.graphContext, mode: 'list', selection: { from: 'x@y.com' }, maxMessages: 2 });

    expect(graph.urls).toHaveLength(1);
    expect(graph.urls[0].searchParams.get('$top')).toBe('2');
    expect(collected).toMatchObject({ ids: ['a0', 'a1'], matched: 5, stopped: 'max-messages' });
  });

  it('reads the first page even when the deadline has passed, then stops', async () => {
    const graph = fakeGraph(() => ({ value: ids('a', 2), '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$skip=2' }));
    const collected = await collectMsGraphCliMailSelection({ ...base, graphContext: graph.graphContext, mode: 'list', selection: { from: 'x@y.com' }, maxMessages: 10, shouldStop: () => true });

    expect(graph.urls).toHaveLength(1);
    expect(collected).toMatchObject({ ids: ['a0', 'a1'], matched: 2, counted: false, stopped: 'max-seconds' });
  });

  it('reports search-cap from 250 hits and drops hits that left the source folder', async () => {
    const hits = [...Array.from({ length: MSGRAPH_CLI_MAIL_SEARCH_MAY_TRUNCATE_AT - 1 }, (_, i) => ({ id: `s${i}`, parentFolderId: 'INBOX' })), { id: 'moved', parentFolderId: 'ARCHIVE' }];
    let page = 0;
    const graph = fakeGraph(() => {
      const value = hits.slice(page * 100, page * 100 + 100);
      page += 1;
      return { value, ...(page * 100 < hits.length ? { '@odata.nextLink': `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$skiptoken=${page}` } : {}) };
    });
    const collected = await collectMsGraphCliMailSelection({ ...base, mailbox: undefined, graphContext: graph.graphContext, mode: 'search', selection: { search: 'from:ramp.com' }, maxMessages: 1000, sourceFolderId: 'INBOX' });

    expect(graph.urls[0].searchParams.get('$search')).toBe('"from:ramp.com"');
    expect(graph.urls[0].searchParams.has('$filter')).toBe(false);
    expect(graph.urls[0].searchParams.has('$count')).toBe(false);
    expect(collected.ids).toHaveLength(249);
    expect(collected).toMatchObject({ stale: 1, counted: false, stopped: 'search-cap' });
  });
});

describe('msGraphCliRunDeadline()', () => {
  it('stops once the budget is spent and caps Retry-After waits to the time left', () => {
    let now = 1000;
    const deadline = msGraphCliRunDeadline({ maxSeconds: 90, startedAt: 1000, now: () => now });

    expect(deadline.shouldStop()).toBe(false);
    expect(msGraphCliSelectionMaxRetryAfterSeconds(deadline)).toBe(60);
    now += 85_500;
    expect(msGraphCliSelectionMaxRetryAfterSeconds(deadline)).toBe(4);
    now += 4500;
    expect(deadline.shouldStop()).toBe(true);
    expect(msGraphCliSelectionMaxRetryAfterSeconds(deadline)).toBe(1);
  });

  it('never stops with a budget of 0', () => {
    const deadline = msGraphCliRunDeadline({ maxSeconds: 0, startedAt: 0, now: () => 1e12 });
    expect(deadline.shouldStop()).toBe(false);
    expect(msGraphCliSelectionMaxRetryAfterSeconds(deadline)).toBeUndefined();
  });
});

describe('msGraphCliMailSelectionWriteOutput()', () => {
  const folders = { source: { id: 'INBOX', displayName: 'Inbox' }, target: { id: 'ARCHIVE', displayName: 'Archive' } };
  const results: MicrosoftGraphMessageWriteResult[] = [
    { id: 'a', status: 201 },
    { id: 'b', status: 404, error: { code: 'ErrorItemNotFound' } }
  ];

  it('is complete when every collected message was attempted and the selection ended', () => {
    const summary = msGraphCliMailSelectionSummary({ collected: { matched: 2, counted: true, stale: 0 }, folders, command: 'delete', attempted: 2, collectedCount: 2 });
    expect(msGraphCliMailSelectionWriteOutput(results, summary, 50)).toEqual({
      total: 2,
      ok: 1,
      failed: 1,
      results: [
        { id: 'a', ok: true, status: 201 },
        { id: 'b', ok: false, status: 404, code: 'ErrorItemNotFound' }
      ],
      matched: 2,
      complete: true,
      folder: { id: 'INBOX', name: 'Inbox' }
    });
  });

  it('reports max-seconds and remaining when the writes were cut short, and the destination of a move', () => {
    const summary = msGraphCliMailSelectionSummary({ collected: { matched: 450, counted: true, stale: 2 }, folders, command: 'move', attempted: 200, collectedCount: 450 });
    expect(summary).toEqual({ matched: 450, complete: false, stopped: 'max-seconds', remaining: 250, folder: { id: 'INBOX', name: 'Inbox' }, to: { id: 'ARCHIVE', name: 'Archive' }, stale: 2 });
  });

  it('gives no remaining when Graph did not count the selection', () => {
    const summary = msGraphCliMailSelectionSummary({ collected: { matched: 250, counted: false, stopped: 'search-cap', stale: 0 }, folders, command: 'delete', attempted: 250, collectedCount: 250 });
    expect(summary.complete).toBe(false);
    expect(summary.stopped).toBe('search-cap');
    expect(summary.remaining).toBeUndefined();
  });
});

describe('runMsGraphCliMessageWrites() with groups of 20', () => {
  const send = async (group: string[]) => group.map((id) => ({ id, status: 201 }));
  const all = Array.from({ length: 230 }, (_, i) => `id${i}`);

  it('prints progress only when crossing a multiple of 100, plus the end', async () => {
    const lines: string[] = [];
    const results = await runMsGraphCliMessageWrites({ ids: all, label: 'mail delete', groupSize: 20, send, progress: (x) => lines.push(x) });

    expect(results).toHaveLength(230);
    expect(lines).toEqual(['mail delete: 100/230 done, 0 failed', 'mail delete: 200/230 done, 0 failed', 'mail delete: 230/230 done, 0 failed']);
  });

  it('always sends the first group, then stops when shouldStop says so', async () => {
    const groups: string[][] = [];
    const lines: string[] = [];
    const results = await runMsGraphCliMessageWrites({
      ids: all,
      label: 'mail move',
      groupSize: 20,
      send: (group) => {
        groups.push(group);
        return send(group);
      },
      shouldStop: () => true,
      progress: (x) => lines.push(x)
    });

    expect(groups).toHaveLength(1);
    expect(results).toHaveLength(20);
    expect(lines).toEqual(['mail move: 20/230 done, 0 failed']);
  });

  it('calls afterGroup with each group before sending the next', async () => {
    const events: string[] = [];
    await runMsGraphCliMessageWrites({
      ids: all.slice(0, 45),
      label: 'mail move',
      groupSize: 20,
      send: (group) => {
        events.push(`send ${group.length}`);
        return send(group);
      },
      afterGroup: async (results) => {
        events.push(`after ${results.length}`);
      }
    });

    expect(events).toEqual(['send 20', 'after 20', 'send 20', 'after 20', 'send 5', 'after 5']);
  });
});

describe('collectMsGraphCliMailSelection() for mail tag / mail untag', () => {
  it('reads categories, skips messages already tagged without counting them toward the cap, and keeps paging', async () => {
    let page = 0;
    const { graphContext, urls } = fakeGraph(() => {
      page += 1;
      return page === 1
        ? {
            '@odata.count': 4,
            value: [
              { id: 'a', categories: ['Tag'] },
              { id: 'b', categories: [] }
            ],
            '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$skip=2'
          }
        : { value: [{ id: 'c', categories: ['tag'] }, { id: 'd' }] };
    });

    const collected = await collectMsGraphCliMailSelection({ graphContext, mode: 'list', selection: { from: 'x@example.com' }, immutableIds: true, maxMessages: 2, categories: { name: 'tag', mode: 'tag' } });

    expect(urls).toHaveLength(2);
    expect(urls[0].searchParams.get('$select')).toBe('id,categories');
    expect(urls[0].searchParams.get('$top')).toBe('1000');
    expect(collected.ids).toEqual(['b', 'd']);
    expect(collected.items).toEqual([
      { id: 'b', categories: [] },
      { id: 'd', categories: [] }
    ]);
    expect(collected.alreadyTagged).toBe(2);
    expect(collected.stopped).toBeUndefined();
    // the count includes the skipped messages, so the remaining count is unknown
    expect(collected.counted).toBe(false);
  });

  it('lists every folder for an untag with no --folder, with no $count', async () => {
    const { graphContext, urls } = fakeGraph(() => ({ value: [{ id: 'a', categories: ['tag'] }] }));

    await collectMsGraphCliMailSelection({ graphContext, mode: 'list', selection: { category: 'tag' }, immutableIds: true, maxMessages: 10, allFolders: true, categories: { name: 'tag', mode: 'untag' } });

    expect(urls[0].pathname).toBe('/v1.0/me/messages');
    expect(urls[0].searchParams.has('$count')).toBe(false);
  });
});

describe('msGraphCliMailTargetMode() for mail tag / mail untag', () => {
  it('selects by the category alone for an untag, and refuses --search there', () => {
    expect(msGraphCliMailTargetMode({ hasIds: false, selection: {}, command: 'untag' })).toBe('list');
    expect(msGraphCliMailTargetMode({ hasIds: true, selection: {}, command: 'untag' })).toBe('ids');
    invalidArgument(() => msGraphCliMailTargetMode({ hasIds: false, selection: { search: 'x' }, command: 'untag' }));
    invalidArgument(() => msGraphCliMailTargetMode({ hasIds: true, selection: { folder: 'inbox' }, command: 'untag' }));
  });

  it('applies the delete/move rules to a tag (its category is not a filter)', () => {
    invalidArgument(() => msGraphCliMailTargetMode({ hasIds: false, selection: { folder: 'inbox' }, command: 'tag' }));
    invalidArgument(() => msGraphCliMailTargetMode({ hasIds: false, selection: {}, command: 'tag' }));
    expect(msGraphCliMailTargetMode({ hasIds: false, selection: { from: 'a@example.com' }, command: 'tag' })).toBe('list');
  });
});
