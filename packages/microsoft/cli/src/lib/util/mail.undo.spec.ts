import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError } from '@dereekb/dbx-cli';
import { microsoftGraphFactory } from '@dereekb/microsoft';
import { type FetchHandler } from '@dereekb/util/fetch';
import {
  type MsGraphCliUndoJournal,
  MSGRAPH_CLI_UNDO_UNWRITABLE_CODE,
  findMsGraphCliPendingUndoJournal,
  listMsGraphCliUndoJournals,
  msGraphCliUndoDir,
  msGraphCliUndoJournalFileName,
  msGraphCliUndoListRows,
  msGraphCliUndoOutput,
  openMsGraphCliUndoJournal,
  pruneMsGraphCliUndoJournals,
  readMsGraphCliUndoJournal,
  undoMsGraphCliJournal
} from './mail.undo';

function ok(ids: string[]) {
  return ids.map((id) => ({ id, status: 201, message: { id } }));
}

/**
 * A Graph that answers every `$batch` move with 201, recording each batch's item urls and bodies.
 */
function fakeGraph() {
  const batches: { url: string; body: unknown }[][] = [];
  const fetchHandler: FetchHandler = async (request) => {
    const body = (await request.json()) as { requests: { id: string; url: string; body: unknown }[] };
    batches.push(body.requests.map((x) => ({ url: x.url, body: x.body })));
    return new Response(JSON.stringify({ responses: body.requests.map((x) => ({ id: x.id, status: 201, body: { id: x.url.split('/')[4] } })) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token' });
  return { graphContext, batches };
}

function journalOf(input: Partial<MsGraphCliUndoJournal>): MsGraphCliUndoJournal {
  return { version: 1, kind: 'delete', createdAt: '2026-11-19T02:03:01.000Z', immutableIds: true, source: { id: 'INBOX', name: 'Inbox' }, destination: { given: 'deleteditems' }, ids: [], undone: [], complete: true, ...input };
}

function writeJournal(configDir: string, name: string, journal: MsGraphCliUndoJournal): string {
  const dir = msGraphCliUndoDir(configDir);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, JSON.stringify(journal));
  return file;
}

describe('undo journal', () => {
  let configDir: string;

  beforeEach(() => {
    configDir = join(mkdtempSync(join(tmpdir(), 'msgraph-cli-undo-')), 'config');
  });

  afterEach(() => {
    rmSync(join(configDir, '..'), { recursive: true, force: true });
  });

  it('names journals so they sort by time', () => {
    expect(msGraphCliUndoJournalFileName('delete', new Date('2026-11-19T02:03:01.123Z'))).toMatch(/^20261119T020301Z-delete-[0-9a-f]{8}\.json$/);
  });

  it('writes the header, appends each group, and finishes, all 0600 in a 0700 folder', async () => {
    const writer = await openMsGraphCliUndoJournal({ configDir, kind: 'move', now: new Date('2026-11-19T02:03:01Z') });

    expect(writer.written()).toBe(false);
    await writer.begin({ mailbox: 'billing@hellosubs.co', immutableIds: true, source: { id: 'INBOX', name: 'Inbox' }, destination: { given: 'archive', id: 'ARCHIVE' } });
    await writer.append([...ok(['a', 'b']), { id: 'c', status: 404 }]);
    await writer.append([{ id: 'd', status: 201, message: { id: 'd2' } }]);
    await writer.finish();

    expect(statSync(writer.file).mode & 0o777).toBe(0o600);
    expect(statSync(msGraphCliUndoDir(configDir)).mode & 0o777).toBe(0o700);
    expect(JSON.parse(readFileSync(writer.file, 'utf8'))).toEqual({
      version: 1,
      kind: 'move',
      createdAt: '2026-11-19T02:03:01.000Z',
      mailbox: 'billing@hellosubs.co',
      immutableIds: true,
      source: { id: 'INBOX', name: 'Inbox' },
      destination: { given: 'archive', id: 'ARCHIVE' },
      // only the ok ids, at their destination
      ids: ['a', 'b', 'd2'],
      undone: [],
      complete: true
    });
    // no temp file is left behind
    expect(readdirSync(msGraphCliUndoDir(configDir))).toEqual([writer.file.split('/').pop()]);
  });

  it('leaves a journal of the first group when a run is cut off after it', async () => {
    const writer = await openMsGraphCliUndoJournal({ configDir, kind: 'delete' });
    await writer.begin({ immutableIds: true, source: null, destination: { given: 'deleteditems' } });
    await writer.append(ok(['a', 'b']));

    expect(await readMsGraphCliUndoJournal(writer.file)).toMatchObject({ ids: ['a', 'b'], complete: false });
  });

  it('refuses before acting when the journal folder cannot be written', async () => {
    const blocker = join(configDir, '..', 'not-a-dir');
    writeFileSync(blocker, 'x');

    await expect(openMsGraphCliUndoJournal({ configDir, kind: 'delete', file: join(blocker, 'undo.json') })).rejects.toMatchObject({ code: MSGRAPH_CLI_UNDO_UNWRITABLE_CODE });
  });

  it('builds the undo command, with the token source', () => {
    expect(msGraphCliUndoOutput('/h/x.json', 'admin')).toEqual({ file: '/h/x.json', command: 'msgraph-cli mail undo /h/x.json --token-source admin' });
    expect(msGraphCliUndoOutput('/h/my undo.json').command).toBe("msgraph-cli mail undo '/h/my undo.json'");
  });

  it('keeps the newest 50 when pruning, and lists newest first', async () => {
    for (let i = 0; i < 53; i += 1) {
      writeJournal(configDir, `202611${String(i).padStart(2, '0')}T000000Z-move-0000000${i % 10}.json`, journalOf({ ids: [`m${i}`] }));
    }

    const pruned = await pruneMsGraphCliUndoJournals(configDir);
    expect(pruned.map((x) => x.split('/').pop()?.slice(0, 8))).toEqual(['20261102', '20261101', '20261100']);

    const listed = await listMsGraphCliUndoJournals(configDir);
    expect(listed).toHaveLength(50);
    expect(listed[0].journal.ids).toEqual(['m52']);
    expect(msGraphCliUndoListRows(listed)[0]).toMatchObject({ kind: 'delete', from: 'Inbox', to: 'deleteditems', count: 1, undone: 0 });
    expect(msGraphCliUndoListRows(listed)).toHaveLength(20);
  });

  it('picks the newest journal that still has ids to undo, of the --mailbox when given', async () => {
    writeJournal(configDir, '20261101T000000Z-delete-00000001.json', journalOf({ ids: ['old'], mailbox: 'billing@hellosubs.co' }));
    writeJournal(configDir, '20261102T000000Z-delete-00000002.json', journalOf({ ids: ['mine'] }));
    writeJournal(configDir, '20261103T000000Z-delete-00000003.json', journalOf({ ids: ['done'], undone: ['done'] }));

    expect((await findMsGraphCliPendingUndoJournal(configDir)).journal.ids).toEqual(['mine']);
    expect((await findMsGraphCliPendingUndoJournal(configDir, 'Billing@HelloSubs.co')).journal.ids).toEqual(['old']);
    await expect(findMsGraphCliPendingUndoJournal(configDir, 'other@hellosubs.co')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses a journal of an ids run without --to, and a different --mailbox', async () => {
    const { graphContext } = fakeGraph();
    const file = writeJournal(configDir, 'a.json', journalOf({ ids: ['a'], source: null, mailbox: 'billing@hellosubs.co' }));
    const journal = await readMsGraphCliUndoJournal(file);

    await expect(undoMsGraphCliJournal({ graphContext, file, journal, startedAt: Date.now() })).rejects.toBeInstanceOf(CliError);
    await expect(undoMsGraphCliJournal({ graphContext, file, journal, startedAt: Date.now() })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(undoMsGraphCliJournal({ graphContext, file, journal, to: 'inbox', mailbox: 'other@hellosubs.co', startedAt: Date.now() })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('continues a partial undo on re-run, then answers alreadyUndone', async () => {
    const { graphContext, batches } = fakeGraph();
    const ids = Array.from({ length: 30 }, (_, i) => `m${i}`);
    const file = writeJournal(configDir, 'a.json', journalOf({ ids, mailbox: 'billing@hellosubs.co' }));
    let clock = 0;
    // each read of the clock moves it 1 s; the 1 s budget stops the run after its first group of 20
    const now = () => (clock += 1000);

    const first = await undoMsGraphCliJournal({ graphContext, file, journal: await readMsGraphCliUndoJournal(file), maxSeconds: 1, startedAt: 0, now });
    expect(first).toMatchObject({ total: 20, ok: 20, remaining: 10, complete: false, restoredTo: { id: 'INBOX', name: 'Inbox' } });
    expect(batches[0][0]).toEqual({ url: '/users/billing%40hellosubs.co/messages/m0/move', body: { destinationId: 'INBOX' } });
    expect((await readMsGraphCliUndoJournal(file)).undone).toHaveLength(20);

    const second = await undoMsGraphCliJournal({ graphContext, file, journal: await readMsGraphCliUndoJournal(file), startedAt: Date.now() });
    expect(second).toMatchObject({ total: 10, ok: 10, remaining: 0, complete: true });
    expect(batches[1].map((x) => x.url.split('/')[4])).toEqual(ids.slice(20));
    expect(await readMsGraphCliUndoJournal(file)).toMatchObject({ undoneAt: expect.any(String) });

    const third = await undoMsGraphCliJournal({ graphContext, file, journal: await readMsGraphCliUndoJournal(file), startedAt: Date.now() });
    expect(third).toEqual({ total: 0, ok: 0, failed: 0, results: [], file, alreadyUndone: true });
    expect(batches).toHaveLength(2);
  });

  it('prints a sample of the moves with --dry-run and changes nothing', async () => {
    const { graphContext, batches } = fakeGraph();
    const file = writeJournal(configDir, 'a.json', journalOf({ ids: ['a', 'b', 'c', 'd'] }));

    const output = await undoMsGraphCliJournal({ graphContext, file, journal: await readMsGraphCliUndoJournal(file), dryRun: true, startedAt: Date.now() });

    expect(output).toMatchObject({ dryRun: true, toUndo: 4, restoredTo: { id: 'INBOX' } });
    expect((output as { requests: unknown[] }).requests).toHaveLength(3);
    expect(batches).toHaveLength(0);
  });

  it('refuses a file that is not a journal', async () => {
    const file = join(configDir, '..', 'x.json');
    writeFileSync(file, '{"hello":1}');

    await expect(readMsGraphCliUndoJournal(file)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(readMsGraphCliUndoJournal(join(configDir, 'missing.json'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
