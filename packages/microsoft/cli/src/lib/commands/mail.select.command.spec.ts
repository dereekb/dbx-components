import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR } from '@dereekb/dbx-cli';
import { MS_IN_HOUR } from '@dereekb/util';
import { MSGRAPH_CLI_CONFIG_DIR_ENV_VAR } from '../config/cli.config';
import { createMsGraphCliAuthMiddleware } from '../middleware/auth.middleware';
import { configureMsGraphCliOutput } from '../util/output';
import { MAIL_LIST_COMMAND } from './mail.command';
import { MAIL_DELETE_COMMAND, MAIL_MOVE_COMMAND } from './mail.write.command';

// what the entry point does at startup
configureMsGraphCliOutput();

/**
 * Writes a token-source command that prints a Microsoft token bundle when run as a credential process.
 *
 * @param dir - Where to write the script.
 * @returns The command.
 */
function fakeTokenSourceCommand(dir: string): string {
  const scriptPath = join(dir, 'token-source.cjs');
  const bundle = { uid: 'user-1', providerType: 'microsoft', accessToken: 'minted-graph-token', scopes: ['User.Read', 'Mail.ReadWrite', 'Mail.ReadWrite.Shared'], expiresAt: new Date(Date.now() + MS_IN_HOUR).toISOString() };
  writeFileSync(
    scriptPath,
    `if (process.env[${JSON.stringify(DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR)}] !== '1') {
  process.stdout.write(JSON.stringify({ ok: false, error: 'not run as a credential process', code: 'NOT_CREDENTIAL_PROCESS' }));
  process.exit(1);
}
process.stdout.write(JSON.stringify(${JSON.stringify(bundle)}));
`
  );

  return `"${process.execPath}" "${scriptPath}"`;
}

interface RecordedCall {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly body: any;
}

/**
 * Graph's answers for a selection: folders by name or id, the listing pages, and `$batch` writes.
 */
interface FakeMailbox {
  /**
   * Folder GETs, by the name or id in the path.
   */
  readonly folders: Record<string, { readonly id: string; readonly displayName?: string }>;
  /**
   * The listing pages, in order; each answers one listing GET.
   */
  readonly pages: { readonly value: { readonly id: string; readonly parentFolderId?: string }[]; readonly '@odata.count'?: number; readonly '@odata.nextLink'?: string }[];
}

const GRAPH = 'https://graph.microsoft.com/v1.0';
const SHARED = '/users/billing%40hellosubs.co';

function messages(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}` }));
}

describe('mail delete / mail move selection', () => {
  let dir: string;
  let tokenCommand: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'msgraph-cli-select-'));
    tokenCommand = fakeTokenSourceCommand(dir);
    vi.stubEnv(MSGRAPH_CLI_CONFIG_DIR_ENV_VAR, join(dir, 'config'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  async function connect(mailbox: FakeMailbox): Promise<RecordedCall[]> {
    const calls: RecordedCall[] = [];
    let page = 0;

    await createMsGraphCliAuthMiddleware({
      skipCommands: new Set(),
      env: { [MSGRAPH_CLI_CONFIG_DIR_ENV_VAR]: join(dir, 'config'), MSGRAPH_CLI_TOKEN_COMMAND: tokenCommand },
      graphFactoryConfig: {
        fetchHandler: async (request: Request) => {
          const url = new URL(request.url);
          const path = url.pathname.replace(/^\/v1\.0/, '');
          const text = request.method === 'GET' ? '' : await request.text();
          const body = text ? JSON.parse(text) : undefined;
          calls.push({ method: request.method, path, query: url.searchParams, body });
          let answer: unknown;
          let status = 200;

          if (path === '/$batch') {
            answer = { responses: body.requests.map((x: { id: string; url: string }) => ({ id: x.id, status: 201, body: { id: x.url.split('/')[4] } })) };
          } else if (path.endsWith('/messages')) {
            answer = mailbox.pages[page] ?? { value: [] };
            page += 1;
          } else if (request.method === 'GET' && path.includes('/mailFolders/')) {
            const folder = mailbox.folders[decodeURIComponent(path.split('/mailFolders/')[1])];
            answer = folder ?? { error: { code: 'ErrorItemNotFound', message: 'The specified object was not found in the store.' } };
            status = folder ? 200 : 404;
          } else {
            // a single message write: the moved message
            answer = { id: path.split('/')[path.split('/').length - 2] };
            status = 201;
          }

          return new Response(JSON.stringify(answer), { status, headers: { 'Content-Type': 'application/json' } });
        }
      }
    })({ _: ['mail'], $0: 'msgraph-cli' });

    return calls;
  }

  function run(command: { handler: unknown }, argv: Record<string, unknown>): Promise<void> {
    return (command.handler as (argv: unknown) => Promise<void>)({ _: ['mail'], $0: 'msgraph-cli', ...argv });
  }

  function printed(log: { mock: { calls: unknown[][] } }) {
    return JSON.parse(log.mock.calls[0][0] as string);
  }

  const FOLDERS = {
    inbox: { id: 'INBOX', displayName: 'Inbox' },
    deleteditems: { id: 'DELETED', displayName: 'Deleted Items' },
    archive: { id: 'ARCHIVE', displayName: 'Archive' },
    AAMkCustom: { id: 'CUSTOM', displayName: 'Vendors' },
    AAMkDI: { id: 'DELETED', displayName: 'Deleted Items' }
  };

  it('deletes by filter in a shared mailbox in one command: pre-flight, listing, then $batch moves to deleteditems', async () => {
    const calls = await connect({ folders: FOLDERS, pages: [{ '@odata.count': 3, value: messages('m', 3) }] });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await run(MAIL_DELETE_COMMAND, { mailbox: 'billing@hellosubs.co', from: 'noreply@bill.com', yes: true });

    expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual([`GET ${SHARED}/mailFolders/inbox`, `GET ${SHARED}/mailFolders/deleteditems`, `GET ${SHARED}/mailFolders/inbox/messages`, 'POST /$batch']);
    const listing = calls[2].query;
    expect(listing.get('$filter')).toBe("receivedDateTime ge 1900-01-01T00:00:00Z and from/emailAddress/address eq 'noreply@bill.com'");
    expect(listing.get('$select')).toBe('id');
    expect(listing.get('$top')).toBe('1000');
    expect(listing.get('$count')).toBe('true');
    expect(listing.get('$orderby')).toBe('receivedDateTime desc');
    // never every folder (/messages), never Deleted Items' messages
    expect(calls.some((x) => x.path === `${SHARED}/messages` || x.path.includes('deleteditems/messages'))).toBe(false);
    expect(calls[3].body.requests.map((x: { method: string; url: string; body: unknown }) => [x.method, x.url, x.body])).toEqual(['m0', 'm1', 'm2'].map((id) => ['POST', `${SHARED}/messages/${id}/move`, { destinationId: 'deleteditems' }]));
    expect(printed(log).data).toEqual({
      total: 3,
      ok: 3,
      failed: 0,
      results: ['m0', 'm1', 'm2'].map((id) => ({ id, ok: true, status: 201, newId: id })),
      matched: 3,
      complete: true,
      folder: { id: 'INBOX', name: 'Inbox' }
    });
  });

  it('collects every listing page before the first write', async () => {
    const calls = await connect({ folders: FOLDERS, pages: [{ '@odata.count': 4, value: messages('a', 2), '@odata.nextLink': `${GRAPH}/me/mailFolders/inbox/messages?$skip=2` }, { value: messages('b', 2) }] });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await run(MAIL_DELETE_COMMAND, { from: 'x@example.com', yes: true });

    expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['GET /me/mailFolders/inbox', 'GET /me/mailFolders/deleteditems', 'GET /me/mailFolders/inbox/messages', 'GET /me/mailFolders/inbox/messages', 'POST /$batch']);
    expect(calls[3].query.get('$skip')).toBe('2');
    expect(printed(log).data).toMatchObject({ total: 4, matched: 4, complete: true });
  });

  it('acts on at most --max-messages and reports the rest as remaining', async () => {
    const calls = await connect({ folders: FOLDERS, pages: [{ '@odata.count': 5, value: messages('m', 2), '@odata.nextLink': `${GRAPH}/me/mailFolders/inbox/messages?$skip=2` }] });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await run(MAIL_DELETE_COMMAND, { from: 'x@example.com', maxMessages: 2, yes: true });

    expect(calls.filter((x) => x.path.endsWith('/messages'))).toHaveLength(1);
    expect(calls.find((x) => x.path === '/$batch')?.body.requests).toHaveLength(2);
    expect(printed(log).data).toMatchObject({ total: 2, ok: 2, matched: 5, complete: false, stopped: 'max-messages', remaining: 3 });
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['ids with --from', { ids: ['a'], from: 'x@example.com', yes: true }, 'INVALID_ARGUMENT'],
    ['ids with --max-messages', { ids: ['a'], maxMessages: 5, yes: true }, 'INVALID_ARGUMENT'],
    ['--search with --from', { search: 'invoice', from: 'x@example.com', yes: true }, 'INVALID_ARGUMENT'],
    ['an empty --search', { search: ' ', yes: true }, 'INVALID_ARGUMENT'],
    ['--folder alone', { folder: 'inbox', yes: true }, 'INVALID_ARGUMENT'],
    ['--whole-folder without --folder', { wholeFolder: true, yes: true }, 'INVALID_ARGUMENT'],
    ['a soft delete from deleteditems', { folder: 'deleteditems', from: 'x@example.com', yes: true }, 'INVALID_ARGUMENT'],
    ['a selected --hard delete from inbox', { folder: 'inbox', from: 'x@example.com', hard: true, yes: true }, 'INVALID_ARGUMENT'],
    ['a selected delete without --yes', { from: 'x@example.com' }, 'CONFIRMATION_REQUIRED'],
    ['nothing at all', { yes: true }, 'INVALID_ARGUMENT']
  ])('refuses %s before any Graph call', async (_, argv, code) => {
    const calls = await connect({ folders: FOLDERS, pages: [] });
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await run(MAIL_DELETE_COMMAND, argv);

    expect(exit).toHaveBeenCalledWith(1);
    expect(printed(log).code).toBe(code);
    expect(calls).toHaveLength(0);
  });

  it('refuses a move to its own source folder before any Graph call', async () => {
    const calls = await connect({ folders: FOLDERS, pages: [] });
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await run(MAIL_MOVE_COMMAND, { folder: 'inbox', from: 'x@example.com', to: 'Inbox' });

    expect(exit).toHaveBeenCalledWith(1);
    expect(printed(log).code).toBe('INVALID_ARGUMENT');
    expect(calls).toHaveLength(0);
  });

  it('refuses a soft delete from Deleted Items passed by id, after the pre-flight and before any listing', async () => {
    const calls = await connect({ folders: FOLDERS, pages: [{ value: messages('m', 1) }] });
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await run(MAIL_DELETE_COMMAND, { folder: 'AAMkDI', from: 'x@example.com', yes: true });

    expect(exit).toHaveBeenCalledWith(1);
    expect(printed(log).code).toBe('INVALID_ARGUMENT');
    expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['GET /me/mailFolders/AAMkDI', 'GET /me/mailFolders/deleteditems']);
  });

  it('fails with NOT_FOUND on a missing folder before any listing', async () => {
    const calls = await connect({ folders: FOLDERS, pages: [] });
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await run(MAIL_MOVE_COMMAND, { folder: 'inbox', from: 'x@example.com', to: 'Vendros' });

    expect(exit).toHaveBeenCalledWith(1);
    expect(printed(log).code).toBe('NOT_FOUND');
    expect(calls.some((x) => x.path.endsWith('/messages'))).toBe(false);
  });

  it('selects by --search in the inbox and reports complete: false with no remaining from 250 hits', async () => {
    const hits = Array.from({ length: 250 }, (_, i) => ({ id: `s${i}`, parentFolderId: 'INBOX' }));
    const calls = await connect({
      folders: FOLDERS,
      pages: [{ value: hits.slice(0, 100), '@odata.nextLink': `${GRAPH}/me/mailFolders/inbox/messages?$skiptoken=1` }, { value: hits.slice(100, 200), '@odata.nextLink': `${GRAPH}/me/mailFolders/inbox/messages?$skiptoken=2` }, { value: hits.slice(200) }]
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await run(MAIL_DELETE_COMMAND, { search: 'from:ramp.com', yes: true });

    const listing = calls.find((x) => x.path === '/me/mailFolders/inbox/messages');
    expect(listing?.query.get('$search')).toBe('"from:ramp.com"');
    expect(listing?.query.has('$filter')).toBe(false);
    expect(listing?.query.has('$count')).toBe(false);
    const data = printed(log).data;
    expect(data).toMatchObject({ total: 250, ok: 250, matched: 250, complete: false, stopped: 'search-cap' });
    expect(data.remaining).toBeUndefined();
  });

  it('runs only the reads on --dry-run (no --yes needed) and prints the counts with a sample of the writes', async () => {
    const calls = await connect({ folders: FOLDERS, pages: [{ '@odata.count': 5, value: messages('m', 5) }] });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await run(MAIL_DELETE_COMMAND, { mailbox: 'billing@hellosubs.co', from: 'noreply@bill.com', dryRun: true });

    expect(calls.every((x) => x.method === 'GET')).toBe(true);
    const data = printed(log).data;
    expect(data).toMatchObject({ dryRun: true, matched: 5, toAct: 5, complete: true, folder: { id: 'INBOX', name: 'Inbox' } });
    expect(data.requests).toHaveLength(4);
    expect(data.requests[0].method).toBe('GET');
    expect(data.requests[0].url).toContain(`${SHARED}/mailFolders/inbox/messages?`);
    expect(data.requests[1]).toMatchObject({ method: 'POST', url: `${SHARED}/messages/m0/move`, body: { destinationId: 'deleteditems' } });
    expect(data.note).toContain('only the first 3 of 5');
  });

  it('moves by filter between folders, with the destination in each request and the output', async () => {
    const calls = await connect({ folders: FOLDERS, pages: [{ '@odata.count': 2, value: messages('m', 2) }] });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await run(MAIL_MOVE_COMMAND, { folder: 'AAMkCustom', from: 'x@y.com', to: 'archive' });

    expect(calls.slice(0, 3).map((x) => x.path)).toEqual(['/me/mailFolders/AAMkCustom', '/me/mailFolders/archive', '/me/mailFolders/AAMkCustom/messages']);
    expect(calls[3].body.requests.map((x: { body: unknown }) => x.body)).toEqual([{ destinationId: 'archive' }, { destinationId: 'archive' }]);
    expect(printed(log).data).toMatchObject({ total: 2, ok: 2, matched: 2, complete: true, folder: { id: 'CUSTOM', name: 'Vendors' }, to: { id: 'ARCHIVE', name: 'Archive' } });
  });

  it('purges a selection from Deleted Items with --hard', async () => {
    const calls = await connect({ folders: FOLDERS, pages: [{ '@odata.count': 2, value: messages('m', 2) }] });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await run(MAIL_DELETE_COMMAND, { folder: 'deleteditems', from: 'x@y.com', hard: true, yes: true });

    expect(calls[2].path).toBe('/me/mailFolders/deleteditems/messages');
    expect(calls[3].body.requests.map((x: { url: string }) => x.url)).toEqual(['/me/messages/m0/permanentDelete', '/me/messages/m1/permanentDelete']);
  });

  it('filters mail list by --category', async () => {
    const calls = await connect({ folders: FOLDERS, pages: [{ value: [] }] });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await run(MAIL_LIST_COMMAND, { folder: 'drafts', category: 'msgraph-cli: delete' });

    expect(calls[0].query.get('$filter')).toBe("receivedDateTime ge 1900-01-01T00:00:00Z and categories/any(c:c eq 'msgraph-cli: delete')");
  });
});
