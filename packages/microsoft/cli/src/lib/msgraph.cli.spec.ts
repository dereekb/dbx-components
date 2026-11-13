import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// what the entry point does at startup
configureMsGraphCliOutput();

const MINTED_ACCESS_TOKEN = 'minted-graph-token';

/**
 * Writes a fake token-source command that prints a Microsoft token bundle when run as a credential
 * process (like `<app-cli> external-token microsoft`), and logs the arguments of each run.
 *
 * @param dir - Where to write the script.
 * @returns The command and its run log.
 */
function fakeTokenSourceCommand(dir: string) {
  const runsPath = join(dir, 'runs.ndjson');
  const scriptPath = join(dir, 'token-source.cjs');
  const bundle = { uid: 'user-1', providerType: 'microsoft', accessToken: MINTED_ACCESS_TOKEN, scopes: ['User.Read', 'Mail.Read', 'Calendars.Read'], expiresAt: new Date(Date.now() + MS_IN_HOUR).toISOString() };

  writeFileSync(
    scriptPath,
    String.raw`const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(runsPath)}, JSON.stringify(args) + '\n');
if (process.env[${JSON.stringify(DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR)}] !== '1') {
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
      expect(JSON.parse(log.mock.calls[0][0] as string).data).toEqual({ id: 'e1', webLink: 'https://outlook/e1', invitationsSent: 0 });
      expect(exit).toHaveBeenCalledWith(1);
      expect(JSON.parse(log.mock.calls[1][0] as string).code).toBe('CONFIRMATION_REQUIRED');
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

  describe('secret redaction', () => {
    it('should redact a bare JWT', () => {
      // a fake JWT (`{"alg":"RS256"}.{"sub":"user-1"}.signature`), assembled so no token literal sits in the source
      const jwt = [{ alg: 'RS256' }, { sub: 'user-1' }].map((x) => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.') + '.c2lnbmF0dXJl';
      expect(sanitizeString(`token was ${jwt}`)).not.toContain(jwt);
    });
  });
});
