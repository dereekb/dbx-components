import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError, DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR, buildErrorOutput, sanitizeString } from '@dereekb/dbx-cli';
import { microsoftGraphRequest } from '@dereekb/microsoft';
import { MS_IN_HOUR } from '@dereekb/util';
import { type FetchHandler } from '@dereekb/util/fetch';
import { MSGRAPH_CLI_CONFIG_DIR_ENV_VAR, msGraphCliConfigStore, msGraphCliPaths } from './config/cli.config';
import { createMsGraphCliAuthMiddleware, msGraphCommandHandler, resolveMsGraphCliContext } from './middleware/auth.middleware';
import { configureMsGraphCliOutput, msGraphCliErrorOutput } from './util/output';

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
function interceptGraph(answer: { readonly status: number; readonly body: unknown }) {
  const requests: InterceptedRequest[] = [];
  const fetchHandler: FetchHandler = async (request: Request) => {
    requests.push({ url: request.url, authorization: request.headers.get('Authorization') });
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'Content-Type': 'application/json' } });
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
      expect(output?.suggestion).toContain('auth show');
      // msgraph-cli has no --scopes; the suggestion must not send the user looking for one
      expect(output?.suggestion).not.toContain('--scopes');
      expect(buildErrorOutput(error).code).toBe('SCOPE_DENIED');
    });

    it('should leave non-Graph errors to the default mapping', () => {
      expect(msGraphCliErrorOutput(new Error('boom'))).toBeUndefined();
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
