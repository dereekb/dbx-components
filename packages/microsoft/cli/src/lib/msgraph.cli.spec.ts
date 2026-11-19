import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError, DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR, buildErrorOutput, configureOutputOptions, sanitizeString } from '@dereekb/dbx-cli';
import { microsoftGraphRequest } from '@dereekb/microsoft';
import { MS_IN_HOUR } from '@dereekb/util';
import { type FetchHandler } from '@dereekb/util/fetch';
import { MSGRAPH_CLI_CONFIG_DIR_ENV_VAR, msGraphCliConfigStore, msGraphCliPaths } from './config/cli.config';
import { createMsGraphCliAuthMiddleware, msGraphCommandHandler, resolveMsGraphCliContext } from './middleware/auth.middleware';
import { configureMsGraphCliOutput, msGraphCliErrorOutput, msGraphCliScopeDeniedSuggestion, outputMsGraphCliResult } from './util/output';
import { REQUEST_COMMAND, msGraphCliContentTypeForFile, parseMsGraphCliHeaderOptions } from './commands/request.command';
import { MAIL_GET_COMMAND, MAIL_GET_MANY_COMMAND, MAIL_LIST_COMMAND, MAIL_SEARCH_COMMAND } from './commands/mail.command';
import { parseMsGraphCliDateOption, parseMsGraphCliIdsFileContent } from './util/option';
import { MAIL_DELETE_COMMAND, MAIL_DRAFT_CREATE_COMMAND, MAIL_DRAFT_UPDATE_COMMAND, MAIL_REPLY_COMMAND, MAIL_SEND_COMMAND } from './commands/mail.write.command';
import { msGraphCliConfigSetUpdate } from './commands/config.command';
import { MAIL_MAILBOXES_CHECK_COMMAND } from './commands/mail.mailboxes.command';
import { CALENDAR_CREATE_COMMAND, CALENDAR_DELETE_COMMAND } from './commands/calendar.command';
import { FILES_DELETE_COMMAND, FILES_MOVE_COMMAND, FILES_UPLOAD_COMMAND } from './commands/files.command';
import { MAIL_AUTO_REPLY_OFF_COMMAND, MAIL_AUTO_REPLY_RESTORE_COMMAND } from './commands/mail.auto.reply.command';
import { TEAMS_CHANNEL_EDIT_COMMAND, TEAMS_CHAT_EDIT_COMMAND, TEAMS_CHAT_SEARCH_COMMAND, isMsGraphCliTeamsChatArchiveSearch } from './commands/teams.command';

// what the entry point does at startup
configureMsGraphCliOutput();

const MINTED_ACCESS_TOKEN = 'minted-graph-token';

/**
 * Writes a fake token-source command that prints a Microsoft token bundle when run as a credential
 * process (like `<app-cli> external-token microsoft`), and logs the arguments of each run.
 *
 * @param dir - Where to write the script.
 * @param options - The app settings the bundle carries, or a refusal instead of a bundle.
 * @param options.settings - The bundle's `settings` (the app's unpacked connection data).
 * @param options.fail - Print a refusal envelope and exit 1 instead.
 * @param options.scopes - The bundle's scopes, instead of User.Read Mail.Read Calendars.Read.
 * @returns The command and its run log.
 */
function fakeTokenSourceCommand(dir: string, options?: { readonly settings?: Record<string, unknown>; readonly fail?: boolean; readonly scopes?: string[] }) {
  const runsPath = join(dir, 'runs.ndjson');
  const scriptPath = join(dir, `token-source${options ? '-custom' : ''}.cjs`);
  const bundle = { uid: 'user-1', providerType: 'microsoft', accessToken: MINTED_ACCESS_TOKEN, scopes: options?.scopes ?? ['User.Read', 'Mail.Read', 'Calendars.Read'], expiresAt: new Date(Date.now() + MS_IN_HOUR).toISOString(), ...(options?.settings ? { settings: options.settings } : {}) };

  writeFileSync(
    scriptPath,
    String.raw`const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(runsPath)}, JSON.stringify(args) + '\n');
if (${options?.fail ? 'true' : 'false'} || process.env[${JSON.stringify(DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR)}] !== '1') {
  process.stdout.write(JSON.stringify({ ok: false, error: 'not run as a credential process', code: 'NOT_CREDENTIAL_PROCESS' }));
  process.exit(1);
}
const bundle = ${JSON.stringify(bundle)};
process.stdout.write(JSON.stringify(bundle));
`
  );

  return {
    command: `"${process.execPath}" "${scriptPath}"`,
    runs: (): string[][] => {
      let result: string[][] = [];

      try {
        result = readFileSync(runsPath, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as string[]);
      } catch {
        // no runs yet
      }

      return result;
    }
  };
}

interface InterceptedRequest {
  readonly url: string;
  readonly authorization: string | null;
}

/**
 * A fetch handler standing in for Graph: records each request and answers with the given status and body.
 *
 * @param answer - The status and body to answer with.
 * @returns The handler and the recorded requests.
 */
function interceptGraph(answer: { readonly status: number; readonly body: unknown; readonly headers?: Record<string, string> }) {
  const requests: InterceptedRequest[] = [];
  const fetchHandler: FetchHandler = async (request: Request) => {
    requests.push({ url: request.url, authorization: request.headers.get('Authorization') });
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'Content-Type': 'application/json', ...answer.headers } });
  };

  return { fetchHandler, requests };
}

describe('msgraph-cli', () => {
  let dir: string;
  let env: NodeJS.ProcessEnv;
  let source: ReturnType<typeof fakeTokenSourceCommand>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'msgraph-cli-'));
    source = fakeTokenSourceCommand(dir);
    env = { [MSGRAPH_CLI_CONFIG_DIR_ENV_VAR]: join(dir, 'config') };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  describe('resolveMsGraphCliContext()', () => {
    it('should throw NOT_CONFIGURED when no token source is configured', async () => {
      const error = await resolveMsGraphCliContext({}, { env }).catch((e) => e);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).code).toBe('NOT_CONFIGURED');
      expect((error as CliError).suggestion).toContain('auth token-source set');
    });

    it('should call Graph with the token minted by the saved token source', async () => {
      await msGraphCliConfigStore(msGraphCliPaths(env)).updateConfigFile({ tokenSource: { command: source.command } });
      const graph = interceptGraph({ status: 200, body: { id: 'me', displayName: 'Test User' } });
      const context = await resolveMsGraphCliContext({}, { env, graphFactoryConfig: { fetchHandler: graph.fetchHandler } });

      const result = await microsoftGraphRequest(context.graphContext)({ method: 'GET', path: '/me' });

      expect(result).toEqual({ id: 'me', displayName: 'Test User' });
      expect(context.active.origin).toBe('config');
      expect(graph.requests).toHaveLength(1);
      expect(graph.requests[0].url).toBe('https://graph.microsoft.com/v1.0/me');
      expect(graph.requests[0].authorization).toBe(`Bearer ${MINTED_ACCESS_TOKEN}`);
      expect(source.runs()).toEqual([[]]);
    });
  });

  describe('msGraphCommandHandler()', () => {
    it('should clear the cached token when Graph rejects it (401) and print TOKEN_REJECTED', async () => {
      const graph = interceptGraph({ status: 401, body: { error: { code: 'InvalidAuthenticationToken', message: 'Access token has expired.' } } });
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await createMsGraphCliAuthMiddleware({ skipCommands: new Set(), env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command }, graphFactoryConfig: { fetchHandler: graph.fetchHandler } })({ _: ['request'], $0: 'msgraph-cli' });

      let tokenSourceRef: { resetToken(): Promise<void> } | undefined;
      const handler = msGraphCommandHandler(async (_argv, context) => {
        tokenSourceRef = context.tokenSource;
        await microsoftGraphRequest(context.graphContext)({ method: 'GET', path: '/me' });
      });

      await handler({ _: ['request'], $0: 'msgraph-cli' });

      expect(exit).toHaveBeenCalledWith(1);
      const printed = JSON.parse(log.mock.calls[0][0] as string);
      expect(printed.code).toBe('TOKEN_REJECTED');
      expect(printed.serverCode).toBe('InvalidAuthenticationToken');
      expect(tokenSourceRef).toBeDefined();

      // the cached token was cleared, so the next load runs the command again
      const tokens = JSON.parse(readFileSync(msGraphCliPaths(env).tokenCachePath, 'utf8')) as Record<string, unknown>;
      expect(Object.keys(tokens)).toHaveLength(0);
      expect(source.runs()).toHaveLength(1);
    });
  });

  describe('msGraphCliErrorOutput()', () => {
    it('should map a 403 to SCOPE_DENIED with a hint to use a source granted the scope', async () => {
      const graph = interceptGraph({ status: 403, body: { error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } } });
      const context = await resolveMsGraphCliContext({}, { env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command }, graphFactoryConfig: { fetchHandler: graph.fetchHandler } });
      const error = await microsoftGraphRequest(context.graphContext)({ method: 'GET', path: '/me/messages' }).catch((e) => e);

      const output = msGraphCliErrorOutput(error);
      expect(output?.code).toBe('SCOPE_DENIED');
      expect(output?.serverCode).toBe('ErrorAccessDenied');
      expect(output?.suggestion).toContain('auth show');
      // msgraph-cli has no --scopes; the suggestion must not send the user looking for one
      expect(output?.suggestion).not.toContain('--scopes');
      expect(buildErrorOutput(error).code).toBe('SCOPE_DENIED');
    });

    it('should retry a 429 three times, then map it to RATE_LIMITED with the Graph code as serverCode', async () => {
      // models: B10 (a Graph 429 carries TooManyRequests and Retry-After); 0 s keeps the retries instant
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const graph = interceptGraph({ status: 429, body: { error: { code: 'TooManyRequests', message: 'Too many requests.' } }, headers: { 'Retry-After': '0' } });
      const context = await resolveMsGraphCliContext({}, { env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command }, graphFactoryConfig: { fetchHandler: graph.fetchHandler } });
      const error = await microsoftGraphRequest(context.graphContext)({ method: 'GET', path: '/me/messages' }).catch((e) => e);

      expect(graph.requests).toHaveLength(1 + 3);
      expect(stderr.mock.calls.map((x) => String(x[0]))).toContain('msgraph-cli: throttled by Microsoft Graph (429); waiting 0 s\n');
      const output = msGraphCliErrorOutput(error);
      expect(output?.code).toBe('RATE_LIMITED');
      expect(output?.serverCode).toBe('TooManyRequests');
      expect(output?.suggestion).toContain('retry');
    });

    it('should name the required scopes and say when every one needs admin consent', async () => {
      // models: the D6 403 shape (channel messages read with a Read + Write token): "API requires one of '…'"
      const graph = interceptGraph({ status: 403, body: { error: { code: 'Forbidden', message: "Missing scope permissions on the request. API requires one of 'ChannelMessage.Read.All, Group.Read.All, Group.ReadWrite.All'. Scopes on the request 'Chat.ReadWrite, User.Read'" } } });
      const context = await resolveMsGraphCliContext({}, { env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command }, graphFactoryConfig: { fetchHandler: graph.fetchHandler } });
      const error = await microsoftGraphRequest(context.graphContext)({ method: 'GET', path: '/teams/t/channels/c/messages' }).catch((e) => e);

      const output = msGraphCliErrorOutput(error);
      expect(output?.code).toBe('SCOPE_DENIED');
      expect(output?.httpStatus).toBe(403);
      expect(output?.suggestion).toContain('ChannelMessage.Read.All');
      expect(output?.suggestion).toContain('admin consent');
      expect(output?.suggestion).not.toContain('Read + Write preset rather than Read');
    });

    it('should suggest a Read + Write source when a required scope is user-consentable', () => {
      const suggestion = msGraphCliScopeDeniedSuggestion("Missing scope permissions on the request. API requires one of 'ChannelMessage.Send, Group.ReadWrite.All'.");
      expect(suggestion).toContain('ChannelMessage.Send');
      expect(suggestion).toContain('Read + Write');
      expect(suggestion).not.toContain('admin consent');
    });

    it('should map itemNotFound and ErrorItemNotFound to NOT_FOUND', async () => {
      // models: live F10 (GET after permanentDelete → 404 itemNotFound) and docs-mail ErrorItemNotFound
      for (const code of ['itemNotFound', 'ErrorItemNotFound']) {
        const graph = interceptGraph({ status: 404, body: { error: { code, message: 'The resource could not be found.' } } });
        const context = await resolveMsGraphCliContext({}, { env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command }, graphFactoryConfig: { fetchHandler: graph.fetchHandler } });
        const error = await microsoftGraphRequest(context.graphContext)({ method: 'GET', path: '/me/drive/items/gone' }).catch((e) => e);

        const output = msGraphCliErrorOutput(error);
        expect(output?.code).toBe('NOT_FOUND');
        expect(output?.serverCode).toBe(code);
        expect(output?.httpStatus).toBe(404);
      }
    });

    it('should map UnknownError and a bare 5xx to SERVICE_UNAVAILABLE with the HTTP status', async () => {
      // models: live C-b outage probes 2026-11-12 — Exchange answered UnknownError; a bare 500 carried no Graph body
      const unknown = interceptGraph({ status: 400, body: { error: { code: 'UnknownError', message: '' } } });
      const unknownContext = await resolveMsGraphCliContext({}, { env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command }, graphFactoryConfig: { fetchHandler: unknown.fetchHandler } });
      const unknownOutput = msGraphCliErrorOutput(await microsoftGraphRequest(unknownContext.graphContext)({ method: 'GET', path: '/me/messages' }).catch((e) => e));
      expect(unknownOutput?.code).toBe('SERVICE_UNAVAILABLE');
      expect(unknownOutput?.httpStatus).toBe(400);
      expect(unknownOutput?.suggestion).toContain('status.cloud.microsoft');

      const bare = interceptGraph({ status: 500, body: 'Internal Server Error' });
      const bareContext = await resolveMsGraphCliContext({}, { env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command }, graphFactoryConfig: { fetchHandler: bare.fetchHandler } });
      const bareOutput = msGraphCliErrorOutput(await microsoftGraphRequest(bareContext.graphContext)({ method: 'GET', path: '/me/messages' }).catch((e) => e));
      expect(bareOutput?.code).toBe('SERVICE_UNAVAILABLE');
      expect(bareOutput?.httpStatus).toBe(500);
    });

    it('should map an abort to TIMEOUT', () => {
      // models: live C-c — the 30 s client timeout rejected with "This operation was aborted"
      const abort = new Error('This operation was aborted');
      abort.name = 'AbortError';
      expect(msGraphCliErrorOutput(abort)?.code).toBe('TIMEOUT');
    });

    it('should leave non-Graph errors to the default mapping', () => {
      expect(msGraphCliErrorOutput(new Error('boom'))).toBeUndefined();
    });
  });

  describe('outputMsGraphCliResult()', () => {
    afterEach(() => {
      configureOutputOptions({});
    });

    it('should apply --pick to each item of a collection page and keep the page fields', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      configureOutputOptions({ pick: 'id' });

      outputMsGraphCliResult({ '@odata.context': 'c', value: [{ id: '1', subject: 's' }], '@odata.nextLink': 'n' });

      const printed = JSON.parse(log.mock.calls[0][0] as string);
      expect(printed).toEqual({ ok: true, data: { '@odata.context': 'c', value: [{ id: '1' }], '@odata.nextLink': 'n' } });
    });
  });

  describe('request command', () => {
    it('should parse repeatable --header options', () => {
      expect(parseMsGraphCliHeaderOptions(['Prefer: IdType="ImmutableId"', 'ConsistencyLevel:eventual'])).toEqual({ Prefer: 'IdType="ImmutableId"', ConsistencyLevel: 'eventual' });
      expect(parseMsGraphCliHeaderOptions(undefined)).toBeUndefined();
      expect(() => parseMsGraphCliHeaderOptions(['no-colon'])).toThrow(CliError);
    });

    it('should pick a --body-file Content-Type from the extension', () => {
      expect(msGraphCliContentTypeForFile('a.json')).toBe('application/json');
      expect(msGraphCliContentTypeForFile('notes.TXT')).toBe('text/plain');
      expect(msGraphCliContentTypeForFile('sheet.xlsx')).toBe('application/octet-stream');
    });

    it('should write --raw-out bytes to the file and print only the path and size', async () => {
      // models: API:driveitem-get-content — the followed 302 answers the file bytes
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const requests: Request[] = [];
      const fetchHandler: FetchHandler = async (request: Request) => {
        requests.push(request);
        return new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
      };
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      await createMsGraphCliAuthMiddleware({ skipCommands: new Set(), env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command }, graphFactoryConfig: { fetchHandler } })({ _: ['request'], $0: 'msgraph-cli' });

      const out = join(dir, 'download.bin');
      await (REQUEST_COMMAND.handler as (argv: unknown) => Promise<void>)({ _: ['request'], $0: 'msgraph-cli', method: 'GET', path: '/me/drive/items/f1/content', rawOut: out, header: ['prefer: IdType="ImmutableId"'] });

      expect(Array.from(readFileSync(out))).toEqual([1, 2, 3, 4]);
      expect(requests[0].headers.get('Prefer')).toBe('IdType="ImmutableId"');
      const printed = JSON.parse(log.mock.calls[0][0] as string);
      expect(printed).toEqual({ ok: true, data: { status: 200, file: out, bytes: 4, contentType: 'application/octet-stream' } });
    });

    it('should print the status and headers of a 202 with --include-headers', async () => {
      // models: API:driveitem-copy — 202 with the monitor URL in Location (live F6)
      const fetchHandler: FetchHandler = async () => new Response(null, { status: 202, headers: { Location: 'https://api.onedrive.com/monitor/abc' } });
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      await createMsGraphCliAuthMiddleware({ skipCommands: new Set(), env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command }, graphFactoryConfig: { fetchHandler } })({ _: ['request'], $0: 'msgraph-cli' });

      await (REQUEST_COMMAND.handler as (argv: unknown) => Promise<void>)({ _: ['request'], $0: 'msgraph-cli', method: 'POST', path: '/me/drive/items/f1/copy', body: '{"name":"copy.txt"}', includeHeaders: true });

      const printed = JSON.parse(log.mock.calls[0][0] as string);
      expect(printed.data.status).toBe(202);
      expect(printed.data.headers.location).toBe('https://api.onedrive.com/monitor/abc');
      expect(printed.data.bytes).toBe(0);
    });
  });

  describe('mail command', () => {
    async function connect(fetchHandler: FetchHandler) {
      await createMsGraphCliAuthMiddleware({ skipCommands: new Set(), env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command }, graphFactoryConfig: { fetchHandler } })({ _: ['mail'], $0: 'msgraph-cli' });
    }

    function runCommand(command: { handler: unknown }, argv: Record<string, unknown>): Promise<void> {
      return (command.handler as (argv: unknown) => Promise<void>)({ _: ['mail'], $0: 'msgraph-cli', ...argv });
    }

    it('should parse date options and ids files', () => {
      expect(parseMsGraphCliDateOption('since', '2026-11-01')?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
      expect(parseMsGraphCliDateOption('since', undefined)).toBeUndefined();
      expect(() => parseMsGraphCliDateOption('since', 'last week')).toThrow(CliError);
      expect(parseMsGraphCliIdsFileContent('a\nb, c\n\n')).toEqual(['a', 'b', 'c']);
      expect(parseMsGraphCliIdsFileContent('["a","b"]')).toEqual(['a', 'b']);
    });

    it('should read the saved JSON output of mail list / mail search as an ids file', () => {
      // mail list --all-pages --pick id > ids.json: one array under data
      expect(parseMsGraphCliIdsFileContent(JSON.stringify({ ok: true, data: [{ id: 'a' }, { id: 'b' }] }))).toEqual(['a', 'b']);
      // mail list without --all-pages: a Graph page under data
      expect(parseMsGraphCliIdsFileContent(JSON.stringify({ ok: true, data: { '@odata.context': 'x', value: [{ id: 'a', subject: 's' }] } }))).toEqual(['a']);
      expect(parseMsGraphCliIdsFileContent(JSON.stringify([{ id: 'a' }, 'b']))).toEqual(['a', 'b']);
      expect(() => parseMsGraphCliIdsFileContent(JSON.stringify({ ok: true, data: { id: 'a' } }))).toThrow(CliError);
      expect(() => parseMsGraphCliIdsFileContent(JSON.stringify([{ subject: 'no id' }]))).toThrow(CliError);
      expect(() => parseMsGraphCliIdsFileContent('{ not json')).toThrow(CliError);
    });

    it('should stop mail list --all-pages at --max-pages and print one array', async () => {
      // models: T-c / M-k — each page carries @odata.nextLink until the last
      const urls: string[] = [];
      await connect(async (request: Request) => {
        urls.push(request.url);
        return new Response(JSON.stringify({ value: [{ id: `m${urls.length}`, subject: 's' }], '@odata.nextLink': `https://graph.microsoft.com/v1.0/me/messages?$skiptoken=p${urls.length}` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCommand(MAIL_LIST_COMMAND, { since: '2026-11-01', from: 'ada@example.com', allPages: true, maxPages: 2, mutableIds: false });

      expect(urls).toHaveLength(2);
      const first = new URL(urls[0]);
      expect(first.searchParams.get('$filter')).toBe("receivedDateTime ge 2026-11-01T00:00:00Z and from/emailAddress/address eq 'ada@example.com'");
      const printed = JSON.parse(log.mock.calls[0][0] as string);
      expect(printed.data.map((x: { id: string }) => x.id)).toEqual(['m1', 'm2']);
    });

    it('should refuse mail search with --since and point at mail list', async () => {
      await connect(interceptGraph({ status: 200, body: { value: [] } }).fetchHandler);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCommand(MAIL_SEARCH_COMMAND, { query: 'invoice', since: '2026-11-01' });

      expect(exit).toHaveBeenCalledWith(1);
      const printed = JSON.parse(log.mock.calls[0][0] as string);
      expect(printed.code).toBe('INVALID_ARGUMENT');
      expect(printed.suggestion).toContain('mail list');
    });

    it('should write mail get --mime to --out and print only the path and size', async () => {
      // models: M-h (outlook-get-mime-message) — $value answers the MIME text
      const mime = 'Subject: private\r\n\r\nsecret body';
      const urls: string[] = [];
      await connect(async (request: Request) => {
        urls.push(request.url);
        return new Response(mime, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      });
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const out = join(dir, 'message.eml');

      await runCommand(MAIL_GET_COMMAND, { id: 'm1', mime: true, out, mailbox: 'shared@example.com' });

      expect(new URL(urls[0]).pathname).toBe('/v1.0/users/shared%40example.com/messages/m1/$value');
      expect(readFileSync(out, 'utf8')).toBe(mime);
      const printedText = log.mock.calls[0][0] as string;
      expect(printedText).not.toContain('secret');
      expect(JSON.parse(printedText).data).toEqual({ id: 'm1', file: out, bytes: mime.length, contentType: 'text/plain' });
    });

    it('should print mail get-many messages in id order with per-id errors', async () => {
      const idsFile = join(dir, 'ids.txt');
      writeFileSync(idsFile, 'b\n');
      await connect(async (request: Request) => {
        const body = (await request.json()) as { requests: { id: string }[] };
        // models: json-batching — per-item status; responses in any order
        const responses = [
          { id: '1', status: 404, body: { error: { code: 'ErrorItemNotFound', message: 'Not found.' } } },
          { id: '0', status: 200, body: { id: 'a', subject: 'A' } }
        ];
        expect(body.requests).toHaveLength(2);
        return new Response(JSON.stringify({ responses }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCommand(MAIL_GET_MANY_COMMAND, { ids: ['a'], idsFile });

      const printed = JSON.parse(log.mock.calls[0][0] as string);
      expect(printed.data).toEqual([
        { id: 'a', subject: 'A' },
        { id: 'b', error: { status: 404, code: 'ErrorItemNotFound', message: 'Not found.' } }
      ]);
    });
  });

  describe('mail write commands', () => {
    beforeEach(() => {
      // a move or delete writes an undo journal to <configDir>/undo; keep it out of the real ~/.msgraph-cli
      vi.stubEnv(MSGRAPH_CLI_CONFIG_DIR_ENV_VAR, join(dir, 'config'));
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    async function connect(fetchHandler: FetchHandler) {
      await createMsGraphCliAuthMiddleware({ skipCommands: new Set(), env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command }, graphFactoryConfig: { fetchHandler } })({ _: ['mail'], $0: 'msgraph-cli' });
    }

    function runCommand(command: { handler: unknown }, argv: Record<string, unknown>): Promise<void> {
      return (command.handler as (argv: unknown) => Promise<void>)({ _: ['mail'], $0: 'msgraph-cli', signature: false, ...argv });
    }

    function printed(log: { mock: { calls: unknown[][] } }) {
      return JSON.parse(log.mock.calls[0][0] as string);
    }

    it('should refuse mail send without --yes and call no Graph endpoint', async () => {
      const graph = interceptGraph({ status: 202, body: null });
      await connect(graph.fetchHandler);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCommand(MAIL_SEND_COMMAND, { to: ['ada@example.com'], subject: 'Hi', body: 'x' });

      expect(exit).toHaveBeenCalledWith(1);
      expect(printed(log).code).toBe('CONFIRMATION_REQUIRED');
      expect(graph.requests).toHaveLength(0);
    });

    it('should print the sendMail call with recipients redacted on --dry-run and send nothing', async () => {
      const graph = interceptGraph({ status: 202, body: null });
      await connect(graph.fetchHandler);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCommand(MAIL_SEND_COMMAND, { to: ['ada@example.com', 'bob@example.com'], subject: 'Hi', body: 'x', mailbox: 'shared@example.com', dryRun: true, save: false });

      const text = log.mock.calls[0][0] as string;
      expect(text).not.toContain('ada@example.com');
      const data = JSON.parse(text).data;
      expect(data.dryRun).toBe(true);
      expect(data.requests[0].url).toBe('/users/shared%40example.com/sendMail');
      expect(data.requests[0].body.message.toRecipients).toBe('[2 recipients]');
      expect(data.requests[0].body.saveToSentItems).toBe(false);
      expect(graph.requests).toHaveLength(0);
    });

    it('should send with --yes and print only the recipient count', async () => {
      // models: M-c (user-sendmail) — 202 with no body
      const graph = interceptGraph({ status: 202, body: null });
      await connect(graph.fetchHandler);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCommand(MAIL_SEND_COMMAND, { to: ['ada@example.com'], cc: ['bob@example.com'], subject: 'Hi', body: 'x', yes: true });

      expect(new URL(graph.requests[0].url).pathname).toBe('/v1.0/me/sendMail');
      expect(printed(log).data).toEqual({ sent: true, recipients: 2 });
    });

    describe('server signature defaults', () => {
      async function connectWith(tokenSource: { readonly command: string }, fetchHandler: FetchHandler) {
        vi.stubEnv(MSGRAPH_CLI_CONFIG_DIR_ENV_VAR, join(dir, 'config'));
        await createMsGraphCliAuthMiddleware({ skipCommands: new Set(), env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: tokenSource.command }, graphFactoryConfig: { fetchHandler } })({ _: ['mail'], $0: 'msgraph-cli' });
      }

      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it('should append the signature the token bundle carries, with no local config', async () => {
        const custom = fakeTokenSourceCommand(dir, { settings: { mail_signature: { me: { text: 'Server signature' }, 'Support@Example.com': { html: '<p>Support</p>' } } } });
        const graph = interceptGraph({ status: 202, body: null });
        await connectWith(custom, graph.fetchHandler);
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await runCommand(MAIL_SEND_COMMAND, { to: ['ada@example.com'], subject: 'Hi', body: 'x', signature: true, dryRun: true });
        await runCommand(MAIL_SEND_COMMAND, { to: ['ada@example.com'], subject: 'Hi', body: 'x', html: true, mailbox: 'support@example.com', signature: true, dryRun: true });
        await runCommand(MAIL_SEND_COMMAND, { to: ['ada@example.com'], subject: 'Hi', body: 'x', mailbox: 'billing@example.com', signature: true, dryRun: true });

        expect(JSON.parse(log.mock.calls[0][0] as string).data.requests[0].body.message.body).toEqual({ contentType: 'text', content: 'x\n\nServer signature' });
        expect(JSON.parse(log.mock.calls[1][0] as string).data.requests[0].body.message.body.content).toContain('<p>Support</p>');
        // a shared mailbox without its own item never falls back to me
        expect(JSON.parse(log.mock.calls[2][0] as string).data.requests[0].body.message.body).toEqual({ contentType: 'text', content: 'x' });
        expect(graph.requests).toHaveLength(0);
        // the token (and its settings) is cached, so the three runs minted once
        expect(custom.runs()).toHaveLength(1);
      });

      it('should degrade a --dry-run to a warning when the token source fails', async () => {
        const failing = fakeTokenSourceCommand(dir, { fail: true });
        const graph = interceptGraph({ status: 202, body: null });
        await connectWith(failing, graph.fetchHandler);
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await runCommand(MAIL_SEND_COMMAND, { to: ['ada@example.com'], subject: 'Hi', body: 'x', signature: true, dryRun: true });

        const data = JSON.parse(log.mock.calls[0][0] as string).data;
        expect(data.dryRun).toBe(true);
        expect(data.warnings).toHaveLength(1);
        expect(data.warnings[0]).toMatch(/^server defaults unavailable \(.+\)$/);
        expect(data.requests[0].body.message.body).toEqual({ contentType: 'text', content: 'x' });
      });
    });

    it('should refuse a reply with both --comment and --body', async () => {
      const graph = interceptGraph({ status: 202, body: null });
      await connect(graph.fetchHandler);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCommand(MAIL_REPLY_COMMAND, { id: 'm1', comment: 'Thanks', body: 'x', yes: true });

      expect(exit).toHaveBeenCalledWith(1);
      expect(printed(log).code).toBe('INVALID_ARGUMENT');
      expect(graph.requests).toHaveLength(0);
    });

    it('should map draft update of a sent message to NOT_A_DRAFT', async () => {
      // models: M-b (message-update) — isDraft false: the PATCH is never sent
      const graph = interceptGraph({ status: 200, body: { id: 'm1', isDraft: false } });
      await connect(graph.fetchHandler);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCommand(MAIL_DRAFT_UPDATE_COMMAND, { id: 'm1', subject: 'New' });

      expect(exit).toHaveBeenCalledWith(1);
      expect(printed(log).code).toBe('NOT_A_DRAFT');
      expect(graph.requests).toHaveLength(1);
    });

    it('should delete through $batch with --yes and print a per-id table', async () => {
      await connect(async () => {
        // models: json-batching — per-item status
        const responses = [
          { id: '0', status: 201, body: { id: 'a' } },
          { id: '1', status: 404, body: { error: { code: 'ErrorItemNotFound', message: 'Not found.' } } }
        ];
        return new Response(JSON.stringify({ responses }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCommand(MAIL_DELETE_COMMAND, { ids: ['a', 'b'], yes: true });

      const data = printed(log).data;
      expect(data.total).toBe(2);
      expect(data.failed).toBe(1);
      expect(data.results[1]).toEqual({ id: 'b', ok: false, status: 404, code: 'ErrorItemNotFound', message: 'Not found.' });
    });

    it('should delete a large selection in groups with progress, printing only the failed rows', async () => {
      const ids = Array.from({ length: 230 }, (_, i) => `id${i}`);
      const idsFile = join(dir, 'ids.json');
      // the saved output of mail list --all-pages --pick id
      writeFileSync(idsFile, JSON.stringify({ ok: true, data: ids.map((id) => ({ id })) }));
      let batchCalls = 0;
      await connect(async (request: Request) => {
        batchCalls += 1;
        const body = (await request.json()) as { requests: { id: string; url: string }[] };
        const responses = body.requests.map((x) => (x.url.includes('/id7/') ? { id: x.id, status: 404, body: { error: { code: 'ErrorItemNotFound' } } } : { id: x.id, status: 201, body: { id: 'moved' } }));
        return new Response(JSON.stringify({ responses }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      await runCommand(MAIL_DELETE_COMMAND, { idsFile, yes: true });

      // 230 ids: 12 $batch calls of up to 20, in three progress groups of up to 100
      expect(batchCalls).toBe(12);
      expect(stderr.mock.calls.map((x) => String(x[0]))).toEqual(['mail delete: 100/230 done, 1 failed\n', 'mail delete: 200/230 done, 1 failed\n', 'mail delete: 230/230 done, 1 failed\n']);
      const data = printed(log).data;
      expect(data).toEqual({ total: 230, ok: 229, failed: 1, omitted: 229, results: [{ id: 'id7', ok: false, status: 404, code: 'ErrorItemNotFound' }], undo: { file: expect.stringContaining(join(dir, 'config', 'undo')), command: expect.stringMatching(/^msgraph-cli mail undo /) } });
    });

    it('should print every row of a large delete with --all-results', async () => {
      await connect(async (request: Request) => {
        const body = (await request.json()) as { requests: { id: string }[] };
        return new Response(JSON.stringify({ responses: body.requests.map((x) => ({ id: x.id, status: 201, body: { id: 'moved' } })) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCommand(MAIL_DELETE_COMMAND, { ids: Array.from({ length: 60 }, (_, i) => `id${i}`), yes: true, allResults: true });

      const data = printed(log).data;
      expect(data.results).toHaveLength(60);
      expect(data.omitted).toBeUndefined();
    });

    describe('attachments on a reply', () => {
      interface RecordedCall {
        readonly method: string;
        readonly path: string;
        readonly body: unknown;
      }

      async function connectRecording(answer: (method: string, path: string) => Response) {
        const calls: RecordedCall[] = [];
        await connect(async (request: Request) => {
          const url = new URL(request.url);
          const path = url.pathname.replace(/^\/v1\.0/, '');
          const text = request.method === 'GET' ? '' : await request.text();
          calls.push({ method: request.method, path, body: text ? JSON.parse(text) : undefined });
          return answer(request.method, path);
        });
        return calls;
      }

      function json(body: unknown, status = 200) {
        return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      }

      it('should attach a local file to a reply through its draft, then send it', async () => {
        const file = join(dir, 'signed.pdf');
        writeFileSync(file, 'pdf-bytes');
        const calls = await connectRecording((method, path) => (path.endsWith('/createReply') ? json({ id: 'd1', isDraft: true }, 201) : path.endsWith('/attachments') ? json({ id: 'att1' }, 201) : new Response(null, { status: 202 })));
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await runCommand(MAIL_REPLY_COMMAND, { id: 'm1', comment: 'Signed copy attached.', attach: [file], yes: true });

        expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['POST /me/messages/m1/createReply', 'POST /me/messages/d1/attachments', 'POST /me/messages/d1/send']);
        expect((calls[0].body as { comment: string }).comment).toBe('Signed copy attached.');
        expect(calls[1].body).toMatchObject({ '@odata.type': '#microsoft.graph.fileAttachment', name: 'signed.pdf', contentBytes: Buffer.from('pdf-bytes').toString('base64') });
        expect(printed(log).data).toEqual({ sent: true, id: 'm1', attachments: 1 });
      });

      it('should download a OneDrive file by path and attach it to a reply draft', async () => {
        const calls = await connectRecording((method, path) => {
          let response: Response;

          if (path.endsWith('/contentStream')) {
            response = new Response('coi-pdf', { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Length': '7' } });
          } else if (method === 'GET') {
            response = json({ id: 'item1', name: 'COI 2026.pdf', size: 7, file: { mimeType: 'application/pdf' } });
          } else if (path.endsWith('/createReplyAll')) {
            response = json({ id: 'd1', isDraft: true, webLink: 'https://outlook/d1' }, 201);
          } else {
            response = json({ id: 'att1' }, 201);
          }

          return response;
        });
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await runCommand(MAIL_REPLY_COMMAND, { id: 'm1', all: true, comment: 'COI attached.', attachItem: ['/Insurance/COI 2026.pdf'], draft: true });

        expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['GET /me/drive/root:/Insurance/COI%202026.pdf', 'GET /me/drive/items/item1/contentStream', 'POST /me/messages/m1/createReplyAll', 'POST /me/messages/d1/attachments']);
        expect(calls[3].body).toMatchObject({ name: 'COI 2026.pdf', contentType: 'application/pdf', contentBytes: Buffer.from('coi-pdf').toString('base64') });
        // --draft: no send, and the draft is printed
        expect(printed(log).data).toEqual({ id: 'd1', isDraft: true, webLink: 'https://outlook/d1' });
      });

      it('should read a drive file only for its details on --dry-run, and refuse a folder', async () => {
        const calls = await connectRecording((method, path) => (path.includes('folder1') ? json({ id: 'folder1', name: 'Insurance', folder: { childCount: 2 } }) : json({ id: 'item1', name: 'COI.pdf', size: 1234, file: { mimeType: 'application/pdf' } })));
        const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await runCommand(MAIL_REPLY_COMMAND, { id: 'm1', comment: 'Attached.', attachItem: ['item1'], drive: 'b!drive', dryRun: true });
        await runCommand(MAIL_REPLY_COMMAND, { id: 'm1', comment: 'Attached.', attachItem: ['folder1'], yes: true });

        expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['GET /drives/b!drive/items/item1', 'GET /me/drive/items/folder1']);
        const dryRun = printed(log).data;
        expect(dryRun.requests.map((x: { method: string; url: string }) => `${x.method} ${x.url.split('?')[0]}`)).toEqual(['POST /me/messages/m1/createReply', 'POST /me/messages/%7BdraftId%7D/send']);
        expect(dryRun.note).toContain('COI.pdf (1234 bytes)');
        expect(exit).toHaveBeenCalledWith(1);
        expect(JSON.parse(log.mock.calls[1][0] as string).code).toBe('INVALID_ARGUMENT');
      });

      it('should refuse --drive without --attach-item', async () => {
        const calls = await connectRecording(() => json({}));
        const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await runCommand(MAIL_REPLY_COMMAND, { id: 'm1', comment: 'x', drive: 'b!drive', yes: true });

        expect(exit).toHaveBeenCalledWith(1);
        expect(printed(log).code).toBe('INVALID_ARGUMENT');
        expect(calls).toHaveLength(0);
      });
    });

    it('should append the saved signature-file to a new draft unless --no-signature', async () => {
      const configDir = join(dir, 'config');
      vi.stubEnv(MSGRAPH_CLI_CONFIG_DIR_ENV_VAR, configDir);
      const signatureFile = join(dir, 'signature.html');
      writeFileSync(signatureFile, '<p>Ada Lovelace</p>');
      // what `msgraph-cli config set signature-file <file>` saves
      await msGraphCliConfigStore(msGraphCliPaths({ [MSGRAPH_CLI_CONFIG_DIR_ENV_VAR]: configDir })).updateConfigFile(await msGraphCliConfigSetUpdate('signature-file', signatureFile));

      const bodies: unknown[] = [];
      await connect(async (request: Request) => {
        bodies.push(await request.json());
        return new Response(JSON.stringify({ id: 'd1', isDraft: true }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      });

      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      await runCommand(MAIL_DRAFT_CREATE_COMMAND, { to: ['ada@example.com'], subject: 'Hi', body: '<p>Hi</p>', html: true, signature: true });
      await runCommand(MAIL_DRAFT_CREATE_COMMAND, { to: ['ada@example.com'], subject: 'Hi', body: 'Hi', signature: false });

      expect((bodies[0] as { body: unknown }).body).toEqual({ contentType: 'html', content: '<p>Hi</p><br><br><p>Ada Lovelace</p>' });
      expect((bodies[1] as { body: unknown }).body).toEqual({ contentType: 'text', content: 'Hi' });
      vi.unstubAllEnvs();
    });

    describe('per-mailbox signatures', () => {
      async function saveSignatures() {
        const configDir = join(dir, 'config');
        vi.stubEnv(MSGRAPH_CLI_CONFIG_DIR_ENV_VAR, configDir);
        const store = msGraphCliConfigStore(msGraphCliPaths({ [MSGRAPH_CLI_CONFIG_DIR_ENV_VAR]: configDir }));
        const ownFile = join(dir, 'own.html');
        const billingFile = join(dir, 'billing.html');
        writeFileSync(ownFile, '<p>Ada Lovelace</p>');
        writeFileSync(billingFile, '<p>Billing team</p><img src="logo.png" alt="logo">');
        writeFileSync(join(dir, 'logo.png'), 'png');
        // what `config set signature-file <file>` and `config set signature-file <file> --mailbox billing@example.com` save
        await store.updateConfigFile(await msGraphCliConfigSetUpdate('signature-file', ownFile));
        await store.updateConfigFile(await msGraphCliConfigSetUpdate('signature-file', billingFile, { mailbox: 'Billing@Example.com', current: await store.loadConfigFile() }));
      }

      it('should append the sending mailbox signature with its image inline, and none for a mailbox without one', async () => {
        await saveSignatures();
        const sent: { url: string; body: { body?: { content: string }; attachments?: unknown[] } }[] = [];
        await connect(async (request: Request) => {
          sent.push({ url: request.url, body: await request.json() });
          return new Response(JSON.stringify({ id: 'd1', isDraft: true }), { status: 201, headers: { 'Content-Type': 'application/json' } });
        });
        vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await runCommand(MAIL_DRAFT_CREATE_COMMAND, { to: ['ada@example.com'], subject: 'Hi', body: '<p>Hi</p>', html: true, signature: true, mailbox: 'billing@example.com' });
        await runCommand(MAIL_DRAFT_CREATE_COMMAND, { to: ['ada@example.com'], subject: 'Hi', body: '<p>Hi</p>', html: true, signature: true, mailbox: 'support@example.com' });
        await runCommand(MAIL_DRAFT_CREATE_COMMAND, { to: ['ada@example.com'], subject: 'Hi', body: '<p>Hi</p>', html: true, signature: true });

        expect(sent[0].body.body?.content).toBe('<p>Hi</p><br><br><p>Billing team</p><img src="cid:signature1-logo.png" alt="logo">');
        expect(sent[0].body.attachments).toEqual([{ '@odata.type': '#microsoft.graph.fileAttachment', name: 'logo.png', contentType: 'image/png', contentBytes: 'cG5n', isInline: true, contentId: 'signature1-logo.png' }]);
        expect(sent[1].body.body?.content).toBe('<p>Hi</p>');
        expect(sent[1].body.attachments).toBeUndefined();
        expect(sent[2].body.body?.content).toBe('<p>Hi</p><br><br><p>Ada Lovelace</p>');
        vi.unstubAllEnvs();
      });

      it('should reply through a draft when the signature has images: create the reply, attach the images, then send it', async () => {
        await saveSignatures();
        const calls: { method: string; path: string; body: unknown }[] = [];
        await connect(async (request: Request) => {
          const path = new URL(request.url).pathname;
          const text = await request.text();
          calls.push({ method: request.method, path, body: text ? JSON.parse(text) : undefined });
          const answer = path.endsWith('/createReply') ? { status: 201, body: { id: 'd1', isDraft: true } } : path.endsWith('/attachments') ? { status: 201, body: { id: 'a1' } } : { status: 202, body: null };
          return new Response(answer.body == null ? null : JSON.stringify(answer.body), { status: answer.status, headers: { 'Content-Type': 'application/json' } });
        });
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await runCommand(MAIL_REPLY_COMMAND, { id: 'm1', comment: 'Thanks', signature: true, mailbox: 'billing@example.com', yes: true });

        expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['POST /v1.0/users/billing%40example.com/messages/m1/createReply', 'POST /v1.0/users/billing%40example.com/messages/d1/attachments', 'POST /v1.0/users/billing%40example.com/messages/d1/send']);
        expect((calls[0].body as { comment: string }).comment).toBe('Thanks<br><br><p>Billing team</p><img src="cid:signature1-logo.png" alt="logo">');
        expect(calls[1].body).toMatchObject({ name: 'logo.png', isInline: true, contentId: 'signature1-logo.png' });
        expect(printed(log).data).toEqual({ sent: true, id: 'm1' });
        vi.unstubAllEnvs();
      });
    });
  });

  describe('shared mailboxes', () => {
    it('should name the shared-mailbox permissions on ErrorAccessDenied and the address on ErrorInvalidUser', async () => {
      // models: docs-mail G (outlook-share-messages-folders) — Exchange denies a mailbox without Full Access; an unknown address is ErrorInvalidUser
      const cases = [
        { status: 403, code: 'ErrorAccessDenied', expected: 'SCOPE_DENIED', hint: 'Full Access' },
        { status: 404, code: 'ErrorInvalidUser', expected: 'NOT_FOUND', hint: '--mailbox' }
      ];

      for (const x of cases) {
        const graph = interceptGraph({ status: x.status, body: { error: { code: x.code, message: 'Access is denied.' } } });
        const context = await resolveMsGraphCliContext({}, { env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command }, graphFactoryConfig: { fetchHandler: graph.fetchHandler } });
        const error = await microsoftGraphRequest(context.graphContext)({ method: 'GET', path: '/users/shared%40example.com/messages' }).catch((e) => e);
        const output = msGraphCliErrorOutput(error);
        expect(output?.code).toBe(x.expected);
        expect(output?.suggestion).toContain(x.hint);
      }
    });

    it('should probe read and write per mailbox, deleting the probe draft', async () => {
      const calls: string[] = [];
      await createMsGraphCliAuthMiddleware({
        skipCommands: new Set(),
        env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command },
        graphFactoryConfig: {
          fetchHandler: async (request: Request) => {
            const url = new URL(request.url);
            calls.push(`${request.method} ${url.pathname}`);
            let response: Response;

            if (url.pathname.startsWith('/v1.0/users/denied')) {
              // models: C2 (pending live test) — a mailbox without Full Access answers 403 ErrorAccessDenied
              response = new Response(JSON.stringify({ error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } }), { status: 403, headers: { 'Content-Type': 'application/json' } });
            } else if (request.method === 'POST' && url.pathname.endsWith('/permanentDelete')) {
              response = new Response(null, { status: 204 });
            } else if (request.method === 'POST') {
              response = new Response(JSON.stringify({ id: 'probe-1', isDraft: true }), { status: 201, headers: { 'Content-Type': 'application/json' } });
            } else {
              response = new Response(JSON.stringify({ value: [{ id: 'm1' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }

            return response;
          }
        }
      })({ _: ['mail'], $0: 'msgraph-cli' });
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await (MAIL_MAILBOXES_CHECK_COMMAND.handler as (argv: unknown) => Promise<void>)({ _: ['mail'], $0: 'msgraph-cli', mailboxes: ['shared@example.com', 'denied@example.com'], write: true });

      expect(calls).toEqual(['GET /v1.0/users/shared%40example.com/messages', 'POST /v1.0/users/shared%40example.com/messages', 'POST /v1.0/users/shared%40example.com/messages/probe-1/permanentDelete', 'GET /v1.0/users/denied%40example.com/messages']);
      expect(JSON.parse(log.mock.calls[0][0] as string).data).toEqual([
        { mailbox: 'shared@example.com', read: 'ok', write: 'ok' },
        { mailbox: 'denied@example.com', read: 'denied', write: 'skipped', readCode: 'ErrorAccessDenied' }
      ]);
    });
  });

  describe('calendar, auto-reply and files commands', () => {
    interface RecordedCall {
      readonly method: string;
      readonly path: string;
      readonly body: unknown;
    }

    async function connectRecording(answer: (method: string, path: string) => { readonly status: number; readonly body?: unknown }) {
      const calls: RecordedCall[] = [];
      await createMsGraphCliAuthMiddleware({
        skipCommands: new Set(),
        env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: source.command },
        graphFactoryConfig: {
          fetchHandler: async (request: Request) => {
            const path = new URL(request.url).pathname.replace(/^\/v1\.0/, '');
            const text = await request.text();
            calls.push({ method: request.method, path, body: text ? JSON.parse(text) : undefined });
            const x = answer(request.method, path);
            return new Response(x.body == null ? null : JSON.stringify(x.body), { status: x.status, headers: { 'Content-Type': 'application/json' } });
          }
        }
      })({ _: ['calendar'], $0: 'msgraph-cli' });
      return calls;
    }

    function run(command: { handler: unknown }, argv: Record<string, unknown>): Promise<void> {
      return (command.handler as (argv: unknown) => Promise<void>)({ _: ['calendar'], $0: 'msgraph-cli', ...argv });
    }

    const EVENT_WINDOW = { subject: 'Sync', start: '2026-11-16T17:00:00Z', end: '2026-11-16T17:30:00Z' };

    it('should create an event without attendees with no --yes, and refuse one with attendees', async () => {
      // models: M-q (user-post-events) — 201 with the event; attendees get invitations
      const calls = await connectRecording(() => ({ status: 201, body: { id: 'e1', webLink: 'https://outlook/e1' } }));
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(CALENDAR_CREATE_COMMAND, { ...EVENT_WINDOW });
      await run(CALENDAR_CREATE_COMMAND, { ...EVENT_WINDOW, attendee: ['ada@example.com'] });

      expect(calls).toHaveLength(1);
      expect(calls[0].body).toEqual({ subject: 'Sync', start: { dateTime: '2026-11-16T17:00:00.000', timeZone: 'UTC' }, end: { dateTime: '2026-11-16T17:30:00.000', timeZone: 'UTC' } });
      expect(JSON.parse(log.mock.calls[0][0] as string).data).toEqual({ id: 'e1', webLink: 'https://outlook/e1', invitationsSent: 0, start: { dateTime: '2026-11-16T17:00:00.000', timeZone: 'UTC' }, end: { dateTime: '2026-11-16T17:30:00.000', timeZone: 'UTC' } });
      expect(exit).toHaveBeenCalledWith(1);
      expect(JSON.parse(log.mock.calls[1][0] as string).code).toBe('CONFIRMATION_REQUIRED');
    });

    it("should read a local --start in the mailbox's time zone, not the machine's, and end it after --duration", async () => {
      // models: user-get-mailboxsettings — GET /me/mailboxSettings/timeZone answers { value }
      const calls = await connectRecording((method, path) => (path === '/me/mailboxSettings/timeZone' ? { status: 200, body: { value: 'Pacific Standard Time' } } : { status: 201, body: { id: 'e1' } }));
      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(CALENDAR_CREATE_COMMAND, { subject: 'Call', start: '2026-11-20T15:00', duration: '1h30m' });

      expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['GET /me/mailboxSettings/timeZone', 'POST /me/events']);
      expect(calls[1].body).toEqual({ subject: 'Call', start: { dateTime: '2026-11-20T15:00', timeZone: 'Pacific Standard Time' }, end: { dateTime: '2026-11-20T16:30:00', timeZone: 'Pacific Standard Time' } });
    });

    it('should create an all-day event over inclusive days in --event-tz without reading the mailbox', async () => {
      const calls = await connectRecording(() => ({ status: 201, body: { id: 'e1' } }));
      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(CALENDAR_CREATE_COMMAND, { subject: 'Conference', allDay: true, start: '2026-12-31', end: '2027-01-01', eventTz: 'America/Denver', showAs: 'oof' });

      expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['POST /me/events']);
      expect(calls[0].body).toEqual({ subject: 'Conference', start: { dateTime: '2026-12-31T00:00:00', timeZone: 'America/Denver' }, end: { dateTime: '2027-01-02T00:00:00', timeZone: 'America/Denver' }, showAs: 'oof', isAllDay: true });
    });

    it('should refuse a zone-less start when the mailbox time zone cannot be read, naming --event-tz', async () => {
      const calls = await connectRecording(() => ({ status: 403, body: { error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } } }));
      vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(CALENDAR_CREATE_COMMAND, { subject: 'Call', start: '2026-11-20T15:00', duration: 30 });

      const refused = JSON.parse(log.mock.calls[0][0] as string);
      expect(refused.code).toBe('INVALID_ARGUMENT');
      expect(refused.suggestion).toContain('--event-tz');
      expect(calls.map((x) => x.method)).toEqual(['GET']);
    });

    it('should name the cancellations when deleting a meeting the user organizes, and delete with --yes', async () => {
      // models: M-q (event-delete) — DELETE on the organizer's calendar sends attendees cancellations; 204
      const calls = await connectRecording((method) => (method === 'GET' ? { status: 200, body: { id: 'e1', isOrganizer: true, attendees: [{ emailAddress: { address: 'ada@example.com' } }, { emailAddress: { address: 'bob@example.com' } }] } } : { status: 204 }));
      vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(CALENDAR_DELETE_COMMAND, { id: 'e1' });
      await run(CALENDAR_DELETE_COMMAND, { id: 'e1', yes: true });

      const refused = JSON.parse(log.mock.calls[0][0] as string);
      expect(refused.code).toBe('CONFIRMATION_REQUIRED');
      expect(refused.error).toContain('2 attendee(s) are sent a cancellation');
      expect(calls.map((x) => x.method)).toEqual(['GET', 'GET', 'DELETE']);
      expect(JSON.parse(log.mock.calls[1][0] as string).data).toEqual({ id: 'e1', deleted: true, cancellationsSent: 2 });
    });

    it('should refuse --cancel on an event the user does not organize', async () => {
      const calls = await connectRecording(() => ({ status: 200, body: { id: 'e1', isOrganizer: false, attendees: [] } }));
      vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(CALENDAR_DELETE_COMMAND, { id: 'e1', cancel: true, comment: 'Moved', yes: true });

      expect(JSON.parse(log.mock.calls[0][0] as string).code).toBe('INVALID_ARGUMENT');
      expect(calls.map((x) => x.method)).toEqual(['GET']);
    });

    it('should back up the setting before auto-reply off, and restore it exactly', async () => {
      // models: user-update-mailboxsettings — PATCH answers 200 with the updated settings
      const original = { status: 'scheduled', externalAudience: 'none', scheduledStartDateTime: { dateTime: '2030-01-01T00:00:00.0000000', timeZone: 'UTC' }, scheduledEndDateTime: { dateTime: '2030-01-02T00:00:00.0000000', timeZone: 'UTC' }, internalReplyMessage: '<p>Away</p>', externalReplyMessage: '' };
      let current: Record<string, unknown> = { '@odata.context': 'x', ...original };
      const calls = await connectRecording((method) => {
        let answer: { status: number; body: unknown } = { status: 200, body: current };

        if (method === 'PATCH') {
          const patch = (calls[calls.length - 1].body as { automaticRepliesSetting: Record<string, unknown> }).automaticRepliesSetting;
          current = { ...current, ...patch };
          answer = { status: 200, body: { automaticRepliesSetting: current } };
        }

        return answer;
      });
      vi.stubEnv(MSGRAPH_CLI_CONFIG_DIR_ENV_VAR, join(dir, 'config'));
      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(MAIL_AUTO_REPLY_OFF_COMMAND, { yes: true });
      expect(current['status']).toBe('disabled');
      await run(MAIL_AUTO_REPLY_RESTORE_COMMAND, { yes: true });

      expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['GET /me/mailboxSettings/automaticRepliesSetting', 'PATCH /me/mailboxSettings', 'GET /me/mailboxSettings/automaticRepliesSetting', 'PATCH /me/mailboxSettings']);
      expect(calls[3].body).toEqual({ automaticRepliesSetting: original });
      vi.unstubAllEnvs();
    });

    it('should map a files move into another drive to CROSS_DRIVE_MOVE before any write', async () => {
      // models: F-h (driveitem-move) — move cannot cross drives
      const calls = await connectRecording((method, path) => ({ status: 200, body: path === '/me/drive' ? { id: 'my-drive' } : { id: 'folder-1' } }));
      vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(FILES_MOVE_COMMAND, { id: 'item-1', to: 'folder-1', toDrive: 'other-drive' });

      const printedError = JSON.parse(log.mock.calls[0][0] as string);
      expect(printedError.code).toBe('CROSS_DRIVE_MOVE');
      expect(printedError.suggestion).toContain('files copy');
      expect(calls.map((x) => x.method)).not.toContain('PATCH');
    });

    it('should refuse files delete without --yes, and delete to the recycle bin with it', async () => {
      // models: F-f (driveitem-delete) — 204
      const calls = await connectRecording(() => ({ status: 204 }));
      vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(FILES_DELETE_COMMAND, { path: 'Docs/old.txt' });
      await run(FILES_DELETE_COMMAND, { path: 'Docs/old.txt', yes: true });

      expect(JSON.parse(log.mock.calls[0][0] as string).code).toBe('CONFIRMATION_REQUIRED');
      expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['DELETE /me/drive/root:/Docs/old.txt']);
      expect(JSON.parse(log.mock.calls[1][0] as string).data).toEqual({ deleted: true, path: 'Docs/old.txt', permanent: false });
    });

    it('should print a large upload as a session plus chunk count on --dry-run and send nothing', async () => {
      const calls = await connectRecording(() => ({ status: 200, body: {} }));
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const local = join(dir, 'big.bin');
      writeFileSync(local, new Uint8Array(5 * 1024 * 1024));

      await run(FILES_UPLOAD_COMMAND, { local, toPath: 'Docs', conflict: 'rename', dryRun: true });

      const data = JSON.parse(log.mock.calls[0][0] as string).data;
      expect(data.requests[0]).toEqual({ method: 'POST', url: '/me/drive/root:/Docs/big.bin:/createUploadSession', body: { item: { '@microsoft.graph.conflictBehavior': 'rename' } } });
      expect(data.note).toContain('1 chunk PUT(s)');
      expect(calls).toHaveLength(0);
    });
  });

  describe('teams message edits', () => {
    async function connect(fetchHandler: FetchHandler, scopes?: string[]) {
      const tokenSource = scopes ? fakeTokenSourceCommand(join(dir, 'scoped'), { scopes }) : source;
      await createMsGraphCliAuthMiddleware({ skipCommands: new Set(), env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: tokenSource.command }, graphFactoryConfig: { fetchHandler } })({ _: ['teams'], $0: 'msgraph-cli' });
    }

    function run(command: { handler: unknown }, argv: Record<string, unknown>): Promise<void> {
      return (command.handler as (argv: unknown) => Promise<void>)({ _: ['teams'], $0: 'msgraph-cli', ...argv });
    }

    function recordingHandler() {
      const calls: { method: string; path: string; body: unknown }[] = [];
      const fetchHandler: FetchHandler = async (request: Request) => {
        const text = await request.text();
        calls.push({ method: request.method, path: new URL(request.url).pathname.replace(/^\/v1\.0/, ''), body: text ? JSON.parse(text) : undefined });
        return new Response(null, { status: 204 });
      };
      return { calls, fetchHandler };
    }

    it('should PATCH a chat message with the new body after --yes, and refuse without it', async () => {
      vi.stubEnv(MSGRAPH_CLI_CONFIG_DIR_ENV_VAR, join(dir, 'config'));
      const graph = recordingHandler();
      await connect(graph.fetchHandler);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(TEAMS_CHAT_EDIT_COMMAND, { chat: '19:abc@thread.v2', message: '171', text: 'Corrected.' });
      await run(TEAMS_CHAT_EDIT_COMMAND, { chat: '19:abc@thread.v2', message: '171', text: 'Corrected.', yes: true });

      expect(exit).toHaveBeenCalledWith(1);
      expect(JSON.parse(log.mock.calls[0][0] as string).code).toBe('CONFIRMATION_REQUIRED');
      expect(graph.calls).toEqual([{ method: 'PATCH', path: '/chats/19%3Aabc%40thread.v2/messages/171', body: { body: { contentType: 'text', content: 'Corrected.' } } }]);
      expect(JSON.parse(log.mock.calls[1][0] as string).data).toEqual({ id: '171', edited: true });
      vi.unstubAllEnvs();
    });

    it('should print the PATCH on --dry-run with a note that the body is replaced whole', async () => {
      const graph = recordingHandler();
      await connect(graph.fetchHandler);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(TEAMS_CHAT_EDIT_COMMAND, { chat: 'c1', message: 'm1', html: '<p>New</p>', dryRun: true });

      const data = JSON.parse(log.mock.calls[0][0] as string).data;
      expect(data.requests).toEqual([{ method: 'PATCH', url: '/chats/c1/messages/m1', body: { body: { contentType: 'html', content: '<p>New</p>' } } }]);
      expect(data.note).toContain('replaces the old one whole');
      expect(graph.calls).toHaveLength(0);
    });

    it('should refuse a channel edit before any Graph call when the token lacks ChannelMessage.ReadWrite', async () => {
      mkdirSync(join(dir, 'scoped'));
      const graph = recordingHandler();
      await connect(graph.fetchHandler, ['User.Read', 'Chat.ReadWrite', 'ChannelMessage.Send']);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(TEAMS_CHANNEL_EDIT_COMMAND, { team: 't', channel: 'ch', message: 'r1', replyTo: 'm1', text: 'Fixed.', yes: true });

      expect(exit).toHaveBeenCalledWith(1);
      expect(JSON.parse(log.mock.calls[0][0] as string).code).toBe('ADMIN_CONSENT_REQUIRED');
      expect(graph.calls).toHaveLength(0);
    });

    it('should PATCH a channel reply under its parent when the token carries ChannelMessage.ReadWrite', async () => {
      vi.stubEnv(MSGRAPH_CLI_CONFIG_DIR_ENV_VAR, join(dir, 'config'));
      mkdirSync(join(dir, 'scoped'));
      const graph = recordingHandler();
      await connect(graph.fetchHandler, ['User.Read', 'ChannelMessage.ReadWrite']);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await run(TEAMS_CHANNEL_EDIT_COMMAND, { team: 't', channel: 'ch', message: 'r1', replyTo: 'm1', text: 'Fixed.', yes: true });

      expect(graph.calls.map((x) => `${x.method} ${x.path}`)).toEqual(['PATCH /teams/t/channels/ch/messages/m1/replies/r1']);
      expect(JSON.parse(log.mock.calls[0][0] as string).data).toEqual({ id: 'r1', edited: true });
      vi.unstubAllEnvs();
    });
  });

  describe('teams chat search', () => {
    async function connect(fetchHandler: FetchHandler, scopes?: string[]) {
      const tokenSource = scopes ? fakeTokenSourceCommand(join(dir, 'scoped'), { scopes }) : source;
      await createMsGraphCliAuthMiddleware({ skipCommands: new Set(), env: { ...env, MSGRAPH_CLI_TOKEN_COMMAND: tokenSource.command }, graphFactoryConfig: { fetchHandler } })({ _: ['teams', 'chat', 'search'], $0: 'msgraph-cli' });
    }

    function runSearch(argv: Record<string, unknown>): Promise<void> {
      return (TEAMS_CHAT_SEARCH_COMMAND.handler as (argv: unknown) => Promise<void>)({ _: ['teams', 'chat', 'search'], $0: 'msgraph-cli', ...argv });
    }

    function printed(log: { mock: { calls: unknown[][] } }) {
      return JSON.parse(log.mock.calls[0][0] as string);
    }

    // the Read + Write preset's Teams scopes
    const READ_WRITE_TEAMS_SCOPES = ['User.Read', 'Chat.Read', 'Chat.ReadWrite', 'ChannelMessage.Send'];

    it('should refuse a Graph search before any Graph call when the token lacks the admin-consent scope', async () => {
      mkdirSync(join(dir, 'scoped'));
      const graph = interceptGraph({ status: 200, body: {} });
      await connect(graph.fetchHandler, READ_WRITE_TEAMS_SCOPES);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runSearch({ query: 'budget' });

      expect(exit).toHaveBeenCalledWith(1);
      expect(graph.requests).toHaveLength(0);
      expect(printed(log).code).toBe('ADMIN_CONSENT_REQUIRED');
      expect(printed(log).suggestion).toContain('--dir');
    });

    it('should POST /search/query for chatMessage and page with --all-pages until no more results', async () => {
      // models: search-concept-chat-messages — value[0].hitsContainers[0] with hits, total, moreResultsAvailable
      mkdirSync(join(dir, 'scoped'));
      const bodies: unknown[] = [];
      await connect(
        async (request: Request) => {
          const body = (await request.json()) as { requests: { from: number }[] };
          bodies.push(body);
          const from = body.requests[0].from;
          const hits = from === 0 ? [{ hitId: 'h1', summary: 'the <c0>budget</c0>', resource: { id: 'm1', chatId: '19:c' } }] : [{ hitId: 'h2', resource: { id: 'm2', chatId: '19:c' } }];
          return new Response(JSON.stringify({ value: [{ searchTerms: ['budget'], hitsContainers: [{ hits, total: 1, moreResultsAvailable: from === 0 }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        },
        [...READ_WRITE_TEAMS_SCOPES, 'ChannelMessage.Read.All']
      );
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runSearch({ query: 'budget from:ada', allPages: true, top: 99 });

      expect(bodies[0]).toEqual({ requests: [{ entityTypes: ['chatMessage'], query: { queryString: 'budget from:ada' }, from: 0, size: 25 }] });
      expect(bodies).toHaveLength(2);
      expect(printed(log).data).toEqual({ hits: [expect.objectContaining({ id: 'm1', chatId: '19:c', snippet: 'the budget' }), expect.objectContaining({ id: 'm2' })], moreResultsAvailable: false });
    });

    it('should return nextOffset when one page leaves more results', async () => {
      mkdirSync(join(dir, 'scoped'));
      await connect(async () => new Response(JSON.stringify({ value: [{ hitsContainers: [{ hits: [{ hitId: 'h1', resource: { id: 'm1' } }], moreResultsAvailable: true }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }), ['ChannelMessage.Read.All']);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runSearch({ query: 'budget', offset: 25 });

      expect(printed(log).data).toMatchObject({ moreResultsAvailable: true, nextOffset: 26 });
    });

    it('should refuse archive-only options on a Graph search', async () => {
      const graph = interceptGraph({ status: 200, body: {} });
      await connect(graph.fetchHandler);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runSearch({ query: 'budget', from: 'ada', since: '2026-11-01' });

      expect(exit).toHaveBeenCalledWith(1);
      expect(graph.requests).toHaveLength(0);
      expect(printed(log).code).toBe('INVALID_ARGUMENT');
      expect(printed(log).error).toContain('--from, --since');
    });

    it('should run an archive search (--dir) without a token source', async () => {
      const middlewareArgv = { _: ['teams', 'chat', 'search'], $0: 'msgraph-cli', dir: join(dir, 'archive') };
      expect(isMsGraphCliTeamsChatArchiveSearch(middlewareArgv)).toBe(true);
      expect(isMsGraphCliTeamsChatArchiveSearch({ _: ['teams', 'chat', 'search'] })).toBe(false);
      const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      // no MSGRAPH_CLI_TOKEN_COMMAND and no saved source: only the skip keeps NOT_CONFIGURED away
      await createMsGraphCliAuthMiddleware({ skipCommands: new Set(), skip: isMsGraphCliTeamsChatArchiveSearch, env })(middlewareArgv);
      expect(exit).not.toHaveBeenCalled();

      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      await runSearch({ query: 'x', dir: join(dir, 'archive') });
      // an empty directory is no dump: the archive search ran (and refused it) without asking for a token
      expect(printed(log).code).toBe('INVALID_ARGUMENT');
      expect(printed(log).error).toContain('holds no teams chat dump');
    });
  });

  describe('secret redaction', () => {
    it('should redact a bare JWT', () => {
      // a fake JWT (`{"alg":"RS256"}.{"sub":"user-1"}.signature`), assembled so no token literal sits in the source
      const jwt = [{ alg: 'RS256' }, { sub: 'user-1' }].map((x) => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.') + '.c2lnbmF0dXJl';
      expect(sanitizeString(`token was ${jwt}`)).not.toContain(jwt);
    });
  });
});
