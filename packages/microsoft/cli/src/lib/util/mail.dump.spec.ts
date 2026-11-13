import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphContext, microsoftGraphFactory } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { type FetchHandler } from '@dereekb/util/fetch';
import { type MsGraphCliMailDumpConfig, type MsGraphCliMailDumpManifest, MSGRAPH_CLI_MAIL_DUMP_MANIFEST_FILE, dumpMsGraphCliMail, msGraphCliMailDumpHash8, msGraphCliMailDumpMailboxKey, msGraphCliMailDumpMarkdown, msGraphCliMailDumpMessagePath, sanitizeMsGraphCliFileName } from './mail.dump';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const DELTA_PATH = '/me/mailFolders/inbox/messages/delta';

interface FakeMessage {
  readonly id: string;
  changeKey: string;
  readonly receivedDateTime: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

interface FakeAttachment {
  readonly id: string;
  readonly name: string;
  readonly bytes: Uint8Array;
}

/**
 * A raw body sent in 64 KiB chunks; when `hang`, it sends the first chunk and then stays open until the request is aborted.
 */
function chunkedBody(request: Request, bytes: Uint8Array, hang = false): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (hang) {
        controller.enqueue(bytes.subarray(0, 1024));
        request.signal.addEventListener('abort', () => controller.error(new DOMException('This operation was aborted', 'AbortError')));
      } else {
        for (let i = 0; i < bytes.length; i += 64 * 1024) {
          controller.enqueue(bytes.subarray(i, i + 64 * 1024));
        }

        controller.close();
      }
    }
  });
}

/**
 * Stands in for Graph's message delta, `$batch` and `$value` endpoints.
 *
 * models: delta-query-messages — a round's pages carry @odata.nextLink, the last one @odata.deltaLink; a
 * later round from the deltaLink returns only changes, a removed message as `{ id, @removed: { reason } }`.
 */
function fakeGraph() {
  const messages = new Map<string, FakeMessage>([
    ['m1', { id: 'm1', changeKey: 'k1', receivedDateTime: '2026-11-01T10:00:00Z' }],
    ['m2', { id: 'm2', changeKey: 'k2', receivedDateTime: '2026-11-02T11:30:00Z' }],
    ['m3', { id: 'm3', changeKey: 'k3', receivedDateTime: '2026-11-03T12:00:00Z' }]
  ]);
  const deltaRequests: { url: URL; prefer: string | null }[] = [];
  /**
   * What the next round from the deltaLink answers.
   */
  let changes: unknown[] = [];
  let failNextPage = false;
  let attachment: Maybe<FakeAttachment>;
  let hangValue = false;

  const summary = (m: FakeMessage) => ({ id: m.id, changeKey: m.changeKey, receivedDateTime: m.receivedDateTime });

  const fetchHandler: FetchHandler = async (request: Request) => {
    const url = new URL(request.url);
    let response: Response;

    if (url.pathname.endsWith('/$batch')) {
      const body = (await request.json()) as { requests: { id: string; url: string }[] };
      // models: json-batching — per-item status, matched back by id
      const responses = body.requests.map((x) => {
        const id = /messages\/([^/?]+)/.exec(x.url)?.[1] ?? '';
        const m = messages.get(decodeURIComponent(id));
        return m
          ? { id: x.id, status: 200, body: { ...summary(m), subject: `Private ${m.id}`, from: { emailAddress: { address: 'ada@example.com' } }, body: { contentType: 'text', content: `secret body ${m.id}` }, hasAttachments: attachment != null } }
          : { id: x.id, status: 404, body: { error: { code: 'ErrorItemNotFound', message: 'Not found.' } } };
      });
      response = json({ responses });
    } else if (attachment && url.pathname.endsWith('/attachments')) {
      // models: https://learn.microsoft.com/en-us/graph/api/message-list-attachments — fileAttachment entries with size, no contentBytes under $select
      response = json({ value: [{ '@odata.type': '#microsoft.graph.fileAttachment', id: attachment.id, name: attachment.name, contentType: 'application/octet-stream', size: attachment.bytes.length, isInline: false }] });
    } else if (attachment && url.pathname.endsWith(`/attachments/${encodeURIComponent(attachment.id)}/$value`)) {
      // models: attachment-get example 6 — the raw file bytes, with a Content-Length
      response = new Response(chunkedBody(request, attachment.bytes, hangValue), { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(attachment.bytes.length) } });
    } else if (url.pathname.endsWith('/$value')) {
      // models: M-h (outlook-get-mime-message)
      response = hangValue ? new Response(chunkedBody(request, new TextEncoder().encode('Subject: private\r\n\r\n'), true), { status: 200, headers: { 'Content-Type': 'text/plain' } }) : new Response('Subject: private\r\n\r\nsecret', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    } else if (url.pathname.startsWith(`/v1.0${DELTA_PATH}`)) {
      deltaRequests.push({ url, prefer: request.headers.get('Prefer') });
      const top = Number(/odata\.maxpagesize=(\d+)/.exec(request.headers.get('Prefer') ?? '')?.[1] ?? 50);

      if (failNextPage) {
        failNextPage = false;
        // models: C-b — an outage answers UnknownError
        response = json({ error: { code: 'UnknownError', message: '' } }, 503);
      } else if (url.searchParams.has('$deltatoken')) {
        response = json({ value: changes, '@odata.deltaLink': `${GRAPH}${DELTA_PATH}?$deltatoken=d2` });
      } else {
        const start = Number(url.searchParams.get('$skiptoken') ?? 0);
        const all = [...messages.values()];
        const value = all.slice(start, start + Math.min(top, 2)).map(summary);
        const end = start + value.length;
        response = json(end < all.length ? { value, '@odata.nextLink': `${GRAPH}${DELTA_PATH}?$skiptoken=${end}` } : { value, '@odata.deltaLink': `${GRAPH}${DELTA_PATH}?$deltatoken=d1` });
      }
    } else {
      response = json({ error: { code: 'BadRequest', message: `unexpected ${url.pathname}` } }, 400);
    }

    return response;
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token' });

  return {
    graphContext,
    messages,
    deltaRequests,
    setChanges: (value: unknown[]) => {
      changes = value;
    },
    failNextPage: () => {
      failNextPage = true;
    },
    setAttachment: (value: Maybe<FakeAttachment>) => {
      attachment = value;
    },
    hangValue: (value: boolean) => {
      hangValue = value;
    }
  };
}

describe('mail dump', () => {
  let dir: string;

  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'msgraph-dump-')), 'dump');
  });

  afterEach(() => {
    rmSync(join(dir, '..'), { recursive: true, force: true });
  });

  function config(graphContext: MicrosoftGraphContext, overrides: Partial<MsGraphCliMailDumpConfig> = {}): MsGraphCliMailDumpConfig {
    return { graphContext, dir, folder: 'inbox', bodyFormat: 'text', markdown: true, eml: false, attachments: false, prune: false, maxMessages: 500, immutableIds: true, ...overrides };
  }

  function readManifest(): MsGraphCliMailDumpManifest {
    return JSON.parse(readFileSync(join(dir, MSGRAPH_CLI_MAIL_DUMP_MANIFEST_FILE), 'utf8')) as MsGraphCliMailDumpManifest;
  }

  describe('file names', () => {
    it('names a message by its received instant and an id hash, never its subject', () => {
      expect(msGraphCliMailDumpMessagePath({ id: 'AAMk/x', receivedDateTime: '2026-11-02T11:30:00Z' })).toBe(`messages/2026/11/2026-11-02T11-30-00Z_${msGraphCliMailDumpHash8('AAMk/x')}`);
      expect(msGraphCliMailDumpMessagePath({ id: 'a' })).toBe(`messages/undated/${msGraphCliMailDumpHash8('a')}`);
    });

    it('sanitizes and caps an attachment name, keeping its extension', () => {
      expect(sanitizeMsGraphCliFileName('../../etc/passwd')).toBe('etc_passwd');
      expect(sanitizeMsGraphCliFileName('...hidden.txt')).toBe('hidden.txt');
      expect(sanitizeMsGraphCliFileName('')).toBe('attachment');
      const long = sanitizeMsGraphCliFileName(`${'a'.repeat(200)}.pdf`, 20);
      expect(long).toBe(`${'a'.repeat(16)}.pdf`);
    });

    it('hashes a shared mailbox address in the manifest', () => {
      expect(msGraphCliMailDumpMailboxKey(undefined)).toBe('me');
      expect(msGraphCliMailDumpMailboxKey('Shared@Example.com')).toBe(msGraphCliMailDumpMailboxKey('shared@example.com'));
      expect(msGraphCliMailDumpMailboxKey('shared@example.com')).not.toContain('shared');
    });

    it('renders Markdown with the subject, addressing and body', () => {
      const md = msGraphCliMailDumpMarkdown({ id: 'm1', subject: 'Hi', from: { emailAddress: { name: 'Ada', address: 'ada@example.com' } }, body: { contentType: 'html', content: '<p>x</p>' } });
      expect(md).toContain('# Hi');
      expect(md).toContain('- From: Ada <ada@example.com>');
      expect(md).toContain('```html\n<p>x</p>\n```');
    });
  });

  it('walks a delta round, writes each message and stores the deltaLink, printing only counts', async () => {
    const graph = fakeGraph();
    const result = await dumpMsGraphCliMail(config(graph.graphContext, { since: new Date('2026-10-01T00:00:00Z'), eml: true }));

    expect(result).toEqual({ dir, written: 3, skipped: 0, removed: 0, failed: 0, bytes: expect.any(Number), complete: true });
    expect(Object.keys(result).sort()).toEqual(['bytes', 'complete', 'dir', 'failed', 'removed', 'skipped', 'written']);
    expect(JSON.stringify(result)).not.toContain('secret');

    const first = graph.deltaRequests[0];
    expect(first.url.searchParams.get('$filter')).toBe('receivedDateTime ge 2026-10-01T00:00:00Z');
    expect(first.prefer).toContain('IdType="ImmutableId"');
    expect(first.prefer).toContain('odata.maxpagesize=50');
    expect(graph.deltaRequests).toHaveLength(2);

    const manifest = readManifest();
    expect(manifest.deltaLink).toBe(`${GRAPH}${DELTA_PATH}?$deltatoken=d1`);
    expect(manifest.nextLink).toBeUndefined();
    expect(manifest.mailbox).toBe('me');
    expect(manifest.counts.written).toBe(3);

    const base = join(dir, msGraphCliMailDumpMessagePath(graph.messages.get('m2')!));
    expect(JSON.parse(readFileSync(`${base}.json`, 'utf8')).body.content).toBe('secret body m2');
    expect(readFileSync(`${base}.md`, 'utf8')).toContain('# Private m2');
    expect(readFileSync(`${base}.eml`, 'utf8')).toContain('Subject: private');
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(statSync(`${base}.json`).mode & 0o777).toBe(0o600);
  });

  it('resumes from the deltaLink, skips an unchanged changeKey, rewrites a changed one and records a removal', async () => {
    const graph = fakeGraph();
    await dumpMsGraphCliMail(config(graph.graphContext));
    graph.messages.get('m2')!.changeKey = 'k2b';
    graph.setChanges([
      { id: 'm1', changeKey: 'k1', receivedDateTime: '2026-11-01T10:00:00Z' },
      { id: 'm2', changeKey: 'k2b', receivedDateTime: '2026-11-02T11:30:00Z' },
      { id: 'm3', '@removed': { reason: 'deleted' } }
    ]);

    const result = await dumpMsGraphCliMail(config(graph.graphContext));

    expect(graph.deltaRequests[2].url.searchParams.get('$deltatoken')).toBe('d1');
    expect(result).toMatchObject({ written: 1, skipped: 1, removed: 1, complete: true });
    const manifest = readManifest();
    expect(manifest.messages['m2'].changeKey).toBe('k2b');
    expect(manifest.removed).toEqual([expect.objectContaining({ id: 'm3', reason: 'deleted', pruned: false })]);
    expect(manifest.deltaLink).toContain('$deltatoken=d2');
    expect(manifest.counts).toMatchObject({ written: 4, skipped: 1, removed: 1 });
    // without --prune the removed message's files stay
    expect(existsSync(join(dir, `${msGraphCliMailDumpMessagePath(graph.messages.get('m3')!)}.json`))).toBe(true);
  });

  it('deletes a removed message’s files with --prune', async () => {
    const graph = fakeGraph();
    await dumpMsGraphCliMail(config(graph.graphContext));
    graph.setChanges([{ id: 'm3', '@removed': { reason: 'changed' } }]);

    await dumpMsGraphCliMail(config(graph.graphContext, { prune: true }));

    const base = join(dir, msGraphCliMailDumpMessagePath(graph.messages.get('m3')!));
    expect(existsSync(`${base}.json`)).toBe(false);
    expect(existsSync(`${base}.md`)).toBe(false);
    expect(readManifest().messages['m3']).toBeUndefined();
  });

  it('stops at --max-messages with a nextLink and continues on the next run', async () => {
    const graph = fakeGraph();
    const first = await dumpMsGraphCliMail(config(graph.graphContext, { maxMessages: 2 }));

    expect(first).toMatchObject({ written: 2, complete: false });
    expect(graph.deltaRequests[0].prefer).toContain('odata.maxpagesize=2');
    expect(readManifest().nextLink).toContain('$skiptoken=2');

    const second = await dumpMsGraphCliMail(config(graph.graphContext));
    expect(graph.deltaRequests[1].url.searchParams.get('$skiptoken')).toBe('2');
    expect(second).toMatchObject({ written: 1, complete: true });
    expect(readManifest().deltaLink).toContain('$deltatoken=d1');
  });

  it('saves a resumable manifest before rethrowing an outage', async () => {
    const graph = fakeGraph();
    await dumpMsGraphCliMail(config(graph.graphContext, { maxMessages: 2 }));
    graph.failNextPage();

    await expect(dumpMsGraphCliMail(config(graph.graphContext))).rejects.toBeDefined();

    const manifest = readManifest();
    expect(manifest.nextLink).toContain('$skiptoken=2');
    expect(manifest.counts.written).toBe(2);
    const resumed = await dumpMsGraphCliMail(config(graph.graphContext));
    expect(resumed).toMatchObject({ written: 1, complete: true });
  });

  it('streams a large attachment to a 0600 file with identical bytes and leaves no .part file', async () => {
    const graph = fakeGraph();
    const bytes = new Uint8Array(3 * 1024 * 1024 + 17).map((_, i) => (i * 31) % 251);
    graph.setAttachment({ id: 'att/1', name: 'report.pdf', bytes });
    graph.messages.delete('m2');
    graph.messages.delete('m3');

    const result = await dumpMsGraphCliMail(config(graph.graphContext, { attachments: true }));

    const folder = join(dir, `${msGraphCliMailDumpMessagePath({ id: 'm1', receivedDateTime: '2026-11-01T10:00:00Z' })}`, 'attachments');
    const files = readdirSync(folder);
    expect(files).toEqual([`${msGraphCliMailDumpHash8('att/1')}_report.pdf`]);
    const written = join(folder, files[0]);
    expect(Buffer.compare(readFileSync(written), Buffer.from(bytes))).toBe(0);
    expect(statSync(written).mode & 0o777).toBe(0o600);
    expect(result.bytes).toBeGreaterThan(bytes.length);
  });

  it('rethrows a stalled .eml download after saving the manifest with the previous cursor, leaving no .part file', async () => {
    const graph = fakeGraph();
    await dumpMsGraphCliMail(config(graph.graphContext, { maxMessages: 2 }));
    graph.hangValue(true);

    const error = await dumpMsGraphCliMail(config(graph.graphContext, { eml: true, idleTimeout: 50 })).catch((e: unknown) => e);
    expect((error as Error).name).toBe('MsGraphCliDownloadStalledError');

    const manifest = readManifest();
    expect(manifest.nextLink).toContain('$skiptoken=2');
    expect(manifest.counts.written).toBe(2);
    const messageDir = join(dir, msGraphCliMailDumpMessagePath({ id: 'm3', receivedDateTime: '2026-11-03T12:00:00Z' }), '..');
    expect(readdirSync(messageDir).filter((x) => x.endsWith('.part'))).toEqual([]);
  });

  it('refuses a directory dumped from another folder', async () => {
    const graph = fakeGraph();
    await dumpMsGraphCliMail(config(graph.graphContext));

    const error = await dumpMsGraphCliMail(config(graph.graphContext, { folder: 'sentitems' })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).code).toBe('INVALID_ARGUMENT');
  });
});
