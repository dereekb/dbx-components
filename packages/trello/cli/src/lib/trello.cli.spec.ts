import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR, buildErrorOutput, configureCliOutputWriter, sanitizeString } from '@dereekb/dbx-cli';
import { TrelloServerFetchResponseError } from '@dereekb/trello';
import { MS_IN_HOUR } from '@dereekb/util';
import { type FetchHandler } from '@dereekb/util/fetch';
import { runTrelloCli } from './cli';
import { TRELLO_CLI_CONFIG_DIR_ENV_VAR } from './config/cli.config';
import { createTrelloCliContextProvider } from './middleware/auth.middleware';
import { trelloCliRequestPath } from './commands/request.command';
import { parseTrelloCliApiUrl, parseTrelloCliBoardArg, parseTrelloCliCardArg } from './util/option';
import { configureTrelloCliOutput, isTrelloServerErrorLike, trelloCliErrorOutput } from './util/output';

// what runTrelloCli does at startup; the unit tests below rely on it too
configureTrelloCliOutput();

const MINTED_ACCESS_TOKEN = 'minted-trello-token';

interface InterceptedRequest {
  readonly method: string;
  readonly url: string;
  readonly path: string;
  readonly authorization: string | null;
}

type FakeRoute = unknown | ((request: InterceptedRequest) => unknown);

/**
 * A fetch handler standing in for Trello: answers from a `'<METHOD> <path>'` route table (path without `/1` and the
 * query string) and records each request. A route value that is a `Response` is sent as is; anything else as 200 JSON.
 *
 * @param routes - The route table.
 * @returns The handler and the recorded requests.
 */
function interceptTrello(routes: Record<string, FakeRoute>) {
  const requests: InterceptedRequest[] = [];
  const fetchHandler: FetchHandler = async (request: Request) => {
    const url = new URL(request.url);
    const recorded: InterceptedRequest = { method: request.method.toUpperCase(), url: request.url, path: url.pathname.replace(/^\/1/, ''), authorization: request.headers.get('Authorization') };
    requests.push(recorded);
    const route = routes[`${recorded.method} ${recorded.path}`];
    const value = typeof route === 'function' ? (route as (x: InterceptedRequest) => unknown)(recorded) : route;
    let response: Response;

    if (value === undefined) {
      response = new Response('not found', { status: 404 });
    } else if (value instanceof Response) {
      response = value;
    } else {
      response = new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return response;
  };

  return { fetchHandler, requests };
}

/**
 * Writes a fake token-source command that prints a Trello token bundle when run as a credential process, and logs each
 * run.
 *
 * @param dir - Where to write the script.
 * @returns The command and its run count.
 */
function fakeTokenSourceCommand(dir: string) {
  const runsPath = join(dir, 'runs.log');
  const scriptPath = join(dir, 'token-source.cjs');
  const bundle = { uid: 'user-1', providerType: 'trello', accessToken: MINTED_ACCESS_TOKEN, scopes: ['read', 'write'], expiresAt: new Date(Date.now() + MS_IN_HOUR).toISOString() };

  writeFileSync(
    scriptPath,
    String.raw`const fs = require('node:fs');
fs.appendFileSync(${JSON.stringify(runsPath)}, 'run\n');
if (process.env[${JSON.stringify(DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR)}] !== '1') {
  process.stdout.write(JSON.stringify({ ok: false, error: 'not run as a credential process', code: 'NOT_CREDENTIAL_PROCESS' }));
  process.exit(1);
}
process.stdout.write(JSON.stringify(${JSON.stringify(bundle)}));
`
  );

  return {
    command: `"${process.execPath}" "${scriptPath}"`,
    runs: (): number => {
      let result = 0;

      try {
        result = readFileSync(runsPath, 'utf8').split('\n').filter(Boolean).length;
      } catch {
        // no runs yet
      }

      return result;
    }
  };
}

const ME = { id: 'member-1', username: 'alice', fullName: 'Alice Example', initials: 'AE', avatarUrl: null };

describe('trello-cli', () => {
  let dir: string;
  let baseEnv: NodeJS.ProcessEnv;
  let lines: string[];
  let exitCodes: number[];

  async function run(args: string[], options: { readonly env?: NodeJS.ProcessEnv; readonly fetchHandler?: FetchHandler } = {}) {
    lines = [];
    exitCodes = [];
    const env = { ...baseEnv, ...options.env };
    await runTrelloCli({ argv: args, env, contextProvider: createTrelloCliContextProvider({ env, trelloFactoryConfig: options.fetchHandler ? { fetchHandler: options.fetchHandler } : undefined }) });
    const last = lines.at(-1);
    return { json: last ? (JSON.parse(last) as Record<string, any>) : undefined, exitCode: exitCodes[0] ?? 0, output: lines.join('\n') };
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'trello-cli-'));
    baseEnv = { [TRELLO_CLI_CONFIG_DIR_ENV_VAR]: join(dir, 'config'), TRELLO_API_KEY: '', TRELLO_API_TOKEN: '', TRELLO_CLI_BOARD: '', TRELLO_CLI_TOKEN_SOURCE: '', TRELLO_CLI_TOKEN_COMMAND: '' };

    // the commands that read paths themselves (auth login, config set, token-source) read process.env
    for (const [key, value] of Object.entries(baseEnv)) {
      vi.stubEnv(key, value as string);
    }

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

  describe('auth', () => {
    it('should fail a Trello command with NOT_CONFIGURED and exit code 4 when no credentials are configured', async () => {
      const trello = interceptTrello({});
      const result = await run(['board', 'list'], { fetchHandler: trello.fetchHandler });

      expect(result.exitCode).toBe(4);
      expect(result.json?.['code']).toBe('NOT_CONFIGURED');
      expect(result.json?.['suggestion']).toContain('auth login');
      expect(trello.requests).toHaveLength(0);
    });

    it('should send the key + token from the env as the OAuth header, never in the url', async () => {
      const trello = interceptTrello({ 'GET /members/me/boards': [{ id: 'board-1', name: 'Board' }] });
      const result = await run(['board', 'list'], { env: { TRELLO_API_KEY: 'key-1', TRELLO_API_TOKEN: 'token-1' }, fetchHandler: trello.fetchHandler });

      expect(result.exitCode).toBe(0);
      expect(result.json).toEqual({ ok: true, data: [{ id: 'board-1', name: 'Board' }] });
      expect(trello.requests[0].authorization).toBe('OAuth oauth_consumer_key="key-1", oauth_token="token-1"');
      expect(trello.requests[0].url).toContain('https://api.trello.com/1/members/me/boards?');
      expect(trello.requests[0].url).not.toContain('token-1');
    });

    it('should save a pair with auth login (mode 0600) and use it, and auth show should report it without the secret', async () => {
      const login = await run(['auth', 'login', '--key', 'saved-key', '--token', 'saved-token', '--no-verify']);
      const credentialsPath = join(dir, 'config', 'credentials.json');

      expect(login.json?.['ok']).toBe(true);
      expect(statSync(credentialsPath).mode & 0o777).toBe(0o600);

      const trello = interceptTrello({ 'GET /members/me': ME });
      const show = await run(['auth', 'show'], { fetchHandler: trello.fetchHandler });

      expect(show.exitCode).toBe(0);
      expect(show.json?.['data']).toMatchObject({ configured: true, mode: 'key-token', source: 'saved (auth login)', member: { id: 'member-1', username: 'alice' } });
      expect(show.output).not.toContain('saved-token');
      expect(trello.requests[0].authorization).toBe('OAuth oauth_consumer_key="saved-key", oauth_token="saved-token"');

      const logout = await run(['auth', 'logout']);
      expect(logout.json?.['data']).toMatchObject({ cleared: true });
    });

    it('should report auth show as not configured (ok, exit 0) when there are no credentials', async () => {
      const result = await run(['auth', 'show']);

      expect(result.exitCode).toBe(0);
      expect(result.json?.['data']).toMatchObject({ configured: false, mode: 'none' });
    });

    it('should send the token-source token as a bearer token, and clear it when Trello rejects it (401)', async () => {
      const source = fakeTokenSourceCommand(dir);
      const trello = interceptTrello({ 'GET /members/me/boards': () => new Response('invalid token', { status: 401 }) });
      const result = await run(['board', 'list'], { env: { TRELLO_CLI_TOKEN_COMMAND: source.command }, fetchHandler: trello.fetchHandler });

      expect(result.exitCode).toBe(1);
      expect(result.json?.['code']).toBe('TOKEN_REJECTED');
      expect(result.json?.['httpStatus']).toBe(401);
      // the first request, then the factory's one retry after resetting the token
      expect(trello.requests.map((x) => x.authorization)).toEqual([`Bearer ${MINTED_ACCESS_TOKEN}`, `Bearer ${MINTED_ACCESS_TOKEN}`]);
      // minted once, then again after the reset
      expect(source.runs()).toBe(2);

      // the token cache no longer holds a reusable token, so the next run mints again
      let tokens = '';

      try {
        tokens = readFileSync(join(dir, 'config', '.tokens.json'), 'utf8');
      } catch {
        // the reset removed the file
      }

      expect(tokens).not.toContain(MINTED_ACCESS_TOKEN);
    });

    it('should prefer the token source over key + token env vars', async () => {
      const source = fakeTokenSourceCommand(dir);
      const trello = interceptTrello({ 'GET /members/me': ME });
      const result = await run(['auth', 'show'], { env: { TRELLO_CLI_TOKEN_COMMAND: source.command, TRELLO_API_KEY: 'key-1', TRELLO_API_TOKEN: 'token-1' }, fetchHandler: trello.fetchHandler });

      expect(result.json?.['data']).toMatchObject({ mode: 'token-source' });
      expect(trello.requests[0].authorization).toBe(`Bearer ${MINTED_ACCESS_TOKEN}`);
    });

    describe('attachment downloads in token-source mode', () => {
      const CARD = '5f0000000000000000000c01';
      const ATTACHMENT = 'a0000000000000000000a001';
      const ATTACHMENT_ROUTE = `GET /cards/${CARD}/attachments/${ATTACHMENT}`;
      const DOWNLOAD_ROUTE = `GET /cards/${CARD}/attachments/${ATTACHMENT}/download/notes.txt`;
      const ATTACHMENT_JSON = { id: ATTACHMENT, name: 'notes.txt', fileName: 'notes.txt', isUpload: true, bytes: 5, mimeType: 'text/plain', url: 'https://trello.com/x' };

      // Trello refuses a bearer token on the download endpoint and accepts the key + token OAuth header
      function downloadRoute(x: InterceptedRequest) {
        return x.authorization?.startsWith('OAuth ') ? new Response('hello') : new Response('unauthorized permission requested', { status: 401 });
      }

      it('should download with the key + token pair and read the attachment with the bearer token', async () => {
        const source = fakeTokenSourceCommand(dir);
        const trello = interceptTrello({ [ATTACHMENT_ROUTE]: ATTACHMENT_JSON, [DOWNLOAD_ROUTE]: downloadRoute });
        const outDir = join(dir, 'out');
        const result = await run(['attachment', 'download', CARD, ATTACHMENT, '--out', `${outDir}/`], { env: { TRELLO_CLI_TOKEN_COMMAND: source.command, TRELLO_API_KEY: 'key-1', TRELLO_API_TOKEN: 'token-1' }, fetchHandler: trello.fetchHandler });

        expect(result.exitCode).toBe(0);
        expect(result.json?.['data']).toMatchObject({ bytes: 5, attachmentId: ATTACHMENT });
        expect(readFileSync(join(outDir, 'notes.txt'), 'utf8')).toBe('hello');
        expect(trello.requests.map((x) => [x.path, x.authorization?.split(' ')[0]])).toEqual([
          [`/cards/${CARD}/attachments/${ATTACHMENT}`, 'Bearer'],
          [`/cards/${CARD}/attachments/${ATTACHMENT}/download/notes.txt`, 'OAuth']
        ]);
      });

      it('should fail a bearer-only download with DOWNLOAD_NEEDS_KEY_TOKEN and keep the cached token', async () => {
        const source = fakeTokenSourceCommand(dir);
        const trello = interceptTrello({ [ATTACHMENT_ROUTE]: ATTACHMENT_JSON, [DOWNLOAD_ROUTE]: downloadRoute });
        const result = await run(['attachment', 'download', CARD, ATTACHMENT, '--out', join(dir, 'out.txt')], { env: { TRELLO_CLI_TOKEN_COMMAND: source.command }, fetchHandler: trello.fetchHandler });

        expect(result.exitCode).toBe(1);
        expect(result.json?.['code']).toBe('DOWNLOAD_NEEDS_KEY_TOKEN');
        expect(result.json?.['suggestion']).toContain('TRELLO_API_KEY');
        expect(readFileSync(join(dir, 'config', '.tokens.json'), 'utf8')).toContain(MINTED_ACCESS_TOKEN);
      });

      it('should report the download pair and its member in auth show', async () => {
        const source = fakeTokenSourceCommand(dir);
        const trello = interceptTrello({ 'GET /members/me': ME });
        const result = await run(['auth', 'show'], { env: { TRELLO_CLI_TOKEN_COMMAND: source.command, TRELLO_API_KEY: 'key-1', TRELLO_API_TOKEN: 'token-1' }, fetchHandler: trello.fetchHandler });

        expect(result.json?.['data']).toMatchObject({ mode: 'token-source', download: { source: 'env (TRELLO_API_KEY + TRELLO_API_TOKEN)', member: { id: ME.id } } });
        expect(result.json?.['data']['download']['warning']).toBeUndefined();
      });

      it('should say what to configure in auth show when there is no download pair', async () => {
        const source = fakeTokenSourceCommand(dir);
        const trello = interceptTrello({ 'GET /members/me': ME });
        const result = await run(['auth', 'show'], { env: { TRELLO_CLI_TOKEN_COMMAND: source.command }, fetchHandler: trello.fetchHandler });

        expect(result.json?.['data']['download']).toMatchObject({ source: null });
        expect(result.json?.['data']['download']['suggestion']).toContain('TRELLO_API_KEY');
      });
    });
  });

  describe('error mapping', () => {
    const keyEnv = { TRELLO_API_KEY: 'key-1', TRELLO_API_TOKEN: 'token-1' };

    it.each([
      [403, 'SCOPE_DENIED'],
      [404, 'NOT_FOUND'],
      [429, 'RATE_LIMITED'],
      [503, 'SERVICE_UNAVAILABLE'],
      [400, 'API_ERROR']
    ])('should map a %s to %s', async (status, code) => {
      const trello = interceptTrello({ 'GET /cards/AbCd1234': () => new Response(`failed with ${status}`, { status }) });
      const result = await run(['card', 'get', 'https://trello.com/c/AbCd1234/12-title'], { env: keyEnv, fetchHandler: trello.fetchHandler });

      expect(result.exitCode).toBe(1);
      expect(result.json).toMatchObject({ ok: false, code, httpStatus: status });
    });

    it('should map an error from a foreign copy of @dereekb/trello by its shape, not its class', () => {
      // a different copy of the library: same shape, a class this CLI's instanceof has never seen
      class ForeignTrelloServerError extends Error {
        constructor(
          message: string,
          readonly data: { readonly status: number; readonly bodyText: string; readonly bodyJson?: unknown }
        ) {
          super(message);
        }

        get status(): number {
          return this.data.status;
        }
      }

      const foreign = new ForeignTrelloServerError('unauthorized permission requested', { status: 403, bodyText: 'unauthorized permission requested' });

      expect(foreign).not.toBeInstanceOf(TrelloServerFetchResponseError);
      expect(isTrelloServerErrorLike(foreign)).toBe(true);
      expect(trelloCliErrorOutput(foreign)).toMatchObject({ code: 'SCOPE_DENIED', httpStatus: 403 });
      expect(buildErrorOutput(foreign)).toMatchObject({ code: 'SCOPE_DENIED' });
      expect(isTrelloServerErrorLike(new Error('x'))).toBe(false);
    });

    it('should carry a JSON error code as serverCode', () => {
      const error = { message: 'bad', status: 400, data: { status: 400, bodyText: '{"message":"bad","error":"INVALID_ID"}', bodyJson: { message: 'bad', error: 'INVALID_ID' } } };
      expect(trelloCliErrorOutput(error)).toMatchObject({ code: 'API_ERROR', serverCode: 'INVALID_ID' });
    });
  });

  describe('redaction', () => {
    it('should redact the OAuth header values and key= / token= query parameters', () => {
      const text = sanitizeString('Authorization: OAuth oauth_consumer_key="abc123", oauth_token="def456" GET https://api.trello.com/1/cards/x?key=abc123&token=def456 Bearer ghi789');

      expect(text).not.toContain('abc123');
      expect(text).not.toContain('def456');
      expect(text).not.toContain('ghi789');
      expect(text).toContain('[REDACTED]');
    });

    it('should redact a token echoed in a Trello error body', async () => {
      const trello = interceptTrello({ 'GET /cards/AbCd1234': () => new Response('invalid token=leaked-secret-value', { status: 401 }) });
      const result = await run(['card', 'get', 'AbCd1234'], { env: { TRELLO_API_KEY: 'key-1', TRELLO_API_TOKEN: 'token-1' }, fetchHandler: trello.fetchHandler });

      expect(result.json?.['code']).toBe('TOKEN_REJECTED');
      expect(result.output).not.toContain('leaked-secret-value');
    });
  });

  describe('request', () => {
    const keyEnv = { TRELLO_API_KEY: 'key-1', TRELLO_API_TOKEN: 'token-1' };

    it('should call a relative path on the api with the query merged', async () => {
      const trello = interceptTrello({ 'GET /members/me': ME });
      const result = await run(['request', 'get', '/members/me', '--query', '{"fields":"username"}'], { env: keyEnv, fetchHandler: trello.fetchHandler });

      expect(result.json).toEqual({ ok: true, data: ME });
      expect(trello.requests[0].url).toBe('https://api.trello.com/1/members/me?fields=username');
    });

    it('should accept an absolute url on the api host, and refuse any other host without sending a request', async () => {
      const trello = interceptTrello({ 'GET /members/me': ME });
      const ok = await run(['request', 'GET', 'https://api.trello.com/1/members/me'], { env: keyEnv, fetchHandler: trello.fetchHandler });
      expect(ok.json?.['ok']).toBe(true);

      const refused = await run(['request', 'GET', 'https://evil.example.com/1/members/me'], { env: keyEnv, fetchHandler: trello.fetchHandler });
      expect(refused.exitCode).toBe(1);
      expect(refused.json?.['code']).toBe('INVALID_ARGUMENT');
      expect(trello.requests).toHaveLength(1);
    });

    it('should resolve request paths against the api base only', () => {
      expect(trelloCliRequestPath({ path: 'members/me', apiUrl: 'https://api.trello.com/1' })).toBe('/members/me');
      expect(trelloCliRequestPath({ path: 'https://api.trello.com/1/cards/x?fields=name', apiUrl: 'https://api.trello.com/1' })).toBe('/cards/x?fields=name');
      expect(() => trelloCliRequestPath({ path: 'https://api.trello.com/2/cards/x', apiUrl: 'https://api.trello.com/1' })).toThrow();
      expect(() => trelloCliRequestPath({ path: 'http://api.trello.com/1/cards/x', apiUrl: 'https://api.trello.com/1' })).toThrow();
      expect(() => trelloCliRequestPath({ path: 'https://api.trello.com.evil.example/1/cards/x', apiUrl: 'https://api.trello.com/1' })).toThrow();
    });

    it('should only accept --api-url on the Trello api host or loopback', async () => {
      expect(parseTrelloCliApiUrl('http://127.0.0.1:1234/1/')).toBe('http://127.0.0.1:1234/1');
      expect(parseTrelloCliApiUrl('https://api.trello.com/1')).toBe('https://api.trello.com/1');
      expect(() => parseTrelloCliApiUrl('https://evil.example.com/1')).toThrow();

      const trello = interceptTrello({});
      const result = await run(['board', 'list', '--api-url', 'https://evil.example.com/1'], { env: keyEnv, fetchHandler: trello.fetchHandler });
      expect(result.json?.['code']).toBe('INVALID_ARGUMENT');
      expect(trello.requests).toHaveLength(0);
    });
  });

  describe('commands', () => {
    const keyEnv = { TRELLO_API_KEY: 'key-1', TRELLO_API_TOKEN: 'token-1' };

    it('should parse card and board arguments from links, shortLinks and ids', () => {
      expect(parseTrelloCliCardArg('https://trello.com/c/AbCd1234/12-title')).toBe('AbCd1234');
      expect(parseTrelloCliCardArg('AbCd1234')).toBe('AbCd1234');
      expect(() => parseTrelloCliCardArg('not a card')).toThrow();
      expect(parseTrelloCliBoardArg('https://trello.com/b/BoArD123/my-board')).toBe('BoArD123');
      expect(parseTrelloCliBoardArg('')).toBeUndefined();
    });

    it('should fail a board command with BOARD_REQUIRED when no board is set', async () => {
      const result = await run(['board', 'lists'], { env: keyEnv, fetchHandler: interceptTrello({}).fetchHandler });

      expect(result.exitCode).toBe(1);
      expect(result.json?.['code']).toBe('BOARD_REQUIRED');
    });

    it('should use the board from --board, then config default-board, then TRELLO_CLI_BOARD', async () => {
      const trello = interceptTrello({ 'GET /boards/EnvBoard/lists': [], 'GET /boards/CfgBoard/lists': [], 'GET /boards/FlagBoard/lists': [] });
      await run(['board', 'lists'], { env: { ...keyEnv, TRELLO_CLI_BOARD: 'EnvBoard' }, fetchHandler: trello.fetchHandler });
      await run(['config', 'set', 'default-board', 'https://trello.com/b/CfgBoard/x']);
      await run(['board', 'lists'], { env: { ...keyEnv, TRELLO_CLI_BOARD: 'EnvBoard' }, fetchHandler: trello.fetchHandler });
      await run(['board', 'lists', '--board', 'FlagBoard'], { env: { ...keyEnv, TRELLO_CLI_BOARD: 'EnvBoard' }, fetchHandler: trello.fetchHandler });

      expect(trello.requests.map((x) => x.path)).toEqual(['/boards/EnvBoard/lists', '/boards/CfgBoard/lists', '/boards/FlagBoard/lists']);
    });

    it("should move a card to a list matched by name on the card's board", async () => {
      const trello = interceptTrello({
        'GET /cards/AbCd1234': { id: 'card-1', idBoard: 'board-1' },
        'GET /boards/board-1/lists': [
          { id: 'list-1', name: 'To Do', closed: false, idBoard: 'board-1', pos: 1 },
          { id: 'list-2', name: 'In Progress (WIP)', closed: false, idBoard: 'board-1', pos: 2 }
        ],
        'PUT /cards/AbCd1234': { id: 'card-1', idList: 'list-2' }
      });
      const result = await run(['card', 'move', 'AbCd1234', '--list', 'in progress'], { env: keyEnv, fetchHandler: trello.fetchHandler });

      expect(result.json).toEqual({ ok: true, data: { id: 'card-1', idList: 'list-2' } });
      expect(trello.requests.at(-1)?.method).toBe('PUT');
    });

    it('should add and remove labels by name with one call each', async () => {
      const trello = interceptTrello({
        'GET /cards/AbCd1234': { id: 'card-1', idBoard: 'board-1', idLabels: ['label-old'] },
        'GET /boards/board-1/labels': [
          { id: 'label-old', name: 'In Progress', color: 'yellow', idBoard: 'board-1' },
          { id: 'label-new', name: 'In Review', color: 'green', idBoard: 'board-1' }
        ],
        'POST /cards/AbCd1234/idLabels': ['label-old', 'label-new'],
        'DELETE /cards/AbCd1234/idLabels/label-old': {}
      });
      const result = await run(['card', 'label', 'AbCd1234', '--add', 'in review', '--remove', 'in progress'], { env: keyEnv, fetchHandler: trello.fetchHandler });

      expect(result.json?.['data']).toMatchObject({ ok: true, labelIds: ['label-new'] });
      expect(trello.requests.filter((x) => x.method !== 'GET').map((x) => `${x.method} ${x.path}`)).toEqual(['POST /cards/AbCd1234/idLabels', 'DELETE /cards/AbCd1234/idLabels/label-old']);
    });

    it('should refuse a delete without --yes', async () => {
      const trello = interceptTrello({});
      const result = await run(['card', 'delete', 'AbCd1234'], { env: keyEnv, fetchHandler: trello.fetchHandler });

      expect(result.json?.['code']).toBe('CONFIRMATION_REQUIRED');
      expect(trello.requests).toHaveLength(0);
    });

    it('should list a card with its comments, attachments and checklists', async () => {
      const trello = interceptTrello({ 'GET /cards/AbCd1234': { id: 'card-1', name: 'A card' } });
      await run(['card', 'get', 'AbCd1234', '--all'], { env: keyEnv, fetchHandler: trello.fetchHandler });
      const query = new URL(trello.requests[0].url).searchParams;

      expect(query.get('actions')).toBe('commentCard');
      expect(query.get('attachments')).toBe('true');
      expect(query.get('checklists')).toBe('all');
      expect(query.get('members')).toBe('true');
    });
  });
});
