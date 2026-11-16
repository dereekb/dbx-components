import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR } from '@dereekb/dbx-cli';
import { MS_IN_HOUR } from '@dereekb/util';
import { MSGRAPH_CLI_CONFIG_DIR_ENV_VAR } from './config/cli.config';

/**
 * Smoke tests against the BUILT msgraph-cli bundle (`dist/packages/microsoft/cli/index.js`).
 *
 * The in-process specs call `configureMsGraphCliOutput()` themselves, so they cannot see a bundler
 * dropping it (82bcd66ae: a bare `import './lib/util/output'` was tree-shaken out of the
 * `"sideEffects": false` package, and the binary shipped without its Graph error mapping and JWT
 * redaction). These run the binary as a child process against a fake Graph on 127.0.0.1.
 *
 * `nx test microsoft-cli` builds the bundle first (its `test` target depends on `build-base`).
 */

const BUNDLE_TEST_TIMEOUT_MS = 30000;
const FAKE_GRAPH_TOKEN = 'fake-graph-token';
const SCOPE_FORBIDDEN_SERVER_CODE = 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR';

/**
 * A fake JWT (`{"alg":"RS256"}.{"sub":"user-1"}.signature`) matching msgraph-cli's bare-JWT secret
 * pattern, assembled at runtime so no token literal sits in the source.
 */
const FAKE_JWT = [{ alg: 'RS256' }, { sub: 'user-1' }].map((x) => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.') + '.c2lnbmF0dXJl';

interface BundleRunResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /**
   * The last non-empty stdout line, parsed.
   */
  readonly json: Record<string, unknown> | undefined;
}

/**
 * Walks up from this file to the workspace root (the directory holding `nx.json`).
 *
 * @returns The workspace root.
 */
function findWorkspaceRoot(): string {
  let dir = __dirname;

  while (!existsSync(join(dir, 'nx.json'))) {
    const parent = dirname(dir);

    if (parent === dir) {
      throw new Error(`No nx.json above ${__dirname}`);
    }

    dir = parent;
  }

  return dir;
}

function parseLastJsonLine(stdout: string): Record<string, unknown> | undefined {
  const lines = stdout.split('\n').filter((line) => line.trim().length > 0);
  const last = lines.at(-1);
  let result: Record<string, unknown> | undefined;

  if (last) {
    try {
      result = JSON.parse(last) as Record<string, unknown>;
    } catch {
      result = undefined;
    }
  }

  return result;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

describe('msgraph-cli bundle', () => {
  const bundlePath = join(findWorkspaceRoot(), 'dist/packages/microsoft/cli/index.js');
  const authorizations: (string | undefined)[] = [];

  let server: Server;
  let baseUrl: string;
  let dir: string;
  let okTokenCommand: string;
  let failingTokenCommand: string;
  let throttledRequests = 0;

  /**
   * Runs the bundle asynchronously — never `spawnSync`, which would block the event loop so the
   * in-process fake Graph could never answer.
   *
   * @param args - The CLI arguments.
   * @param tokenCommand - The `MSGRAPH_CLI_TOKEN_COMMAND` to run with.
   * @returns The exit code, output and parsed envelope.
   */
  function runBundle(args: readonly string[], tokenCommand: string = okTokenCommand): Promise<BundleRunResult> {
    const env: NodeJS.ProcessEnv = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith('MSGRAPH_CLI_') && key !== DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR) {
        env[key] = value;
      }
    }

    env[MSGRAPH_CLI_CONFIG_DIR_ENV_VAR] = join(dir, 'config');
    env['MSGRAPH_CLI_TOKEN_COMMAND'] = tokenCommand;

    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [bundlePath, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
      child.on('error', reject);
      child.on('close', (exitCode) => resolve({ exitCode, stdout, stderr, json: parseLastJsonLine(stdout) }));
    });
  }

  beforeAll(async () => {
    if (!existsSync(bundlePath)) {
      throw new Error(`The msgraph-cli bundle is missing at ${bundlePath}. Build it first: npx nx run microsoft-cli:build-base (nx test microsoft-cli does this through dependsOn)`);
    }

    dir = mkdtempSync(join(tmpdir(), 'msgraph-cli-bundle-'));

    const okScript = join(dir, 'token-source-ok.cjs');
    const bundle = { uid: 'u1', providerType: 'microsoft', accessToken: FAKE_GRAPH_TOKEN, scopes: ['Mail.Read'], expiresAt: new Date(Date.now() + MS_IN_HOUR).toISOString() };
    writeFileSync(
      okScript,
      `if (process.env[${JSON.stringify(DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR)}] !== '1') {
  process.stdout.write(JSON.stringify({ ok: false, error: 'not run as a credential process', code: 'NOT_CREDENTIAL_PROCESS' }));
  process.exit(1);
}
process.stdout.write(JSON.stringify(${JSON.stringify(bundle)}));
`
    );
    okTokenCommand = `"${process.execPath}" "${okScript}"`;

    const failingScript = join(dir, 'token-source-failing.cjs');
    const failure = { ok: false, error: `external-token microsoft failed: Forbidden (${SCOPE_FORBIDDEN_SERVER_CODE})`, code: 'AUTH_FORBIDDEN', serverCode: SCOPE_FORBIDDEN_SERVER_CODE, suggestion: 'x' };
    writeFileSync(failingScript, `process.stdout.write(JSON.stringify(${JSON.stringify(failure)}));\nprocess.exit(1);\n`);
    failingTokenCommand = `"${process.execPath}" "${failingScript}"`;

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      authorizations.push(req.headers.authorization);
      const path = (req.url ?? '').split('?')[0];

      switch (path) {
        case '/v1.0/me/messages':
          sendJson(res, 200, {
            '@odata.context': `${baseUrl}/v1.0/$metadata#users('u1')/messages`,
            value: [
              { id: 'm1', subject: 'Hi' },
              { id: 'm2', subject: 'Yo' }
            ],
            '@odata.nextLink': `${baseUrl}/v1.0/me/messages?$skip=2`
          });
          break;
        case '/v1.0/expired':
          // the JWT is NOT after `Bearer ` / `access_token:` — only msgraph-cli's own bare-JWT pattern redacts it
          sendJson(res, 401, { error: { code: 'InvalidAuthenticationToken', message: `IDX14100: JWT is not well formed: ${FAKE_JWT}` } });
          break;
        case '/v1.0/forbidden':
          sendJson(res, 403, { error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } });
          break;
        case '/v1.0/throttled':
          // models: B10 (a Graph 429 carries TooManyRequests and Retry-After); 0 s keeps the retries instant
          throttledRequests += 1;
          res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '0' });
          res.end(JSON.stringify({ error: { code: 'TooManyRequests', message: 'Too many requests.' } }));
          break;
        default:
          sendJson(res, 404, { error: { code: 'NotFound', message: 'Not found.' } });
          break;
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it(
    'should start and list its commands',
    async () => {
      const result = await runBundle(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('mail');
      expect(result.stdout).toContain('request');
      expect(result.stdout).toContain('auth');
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  it(
    'should map a 401 to TOKEN_REJECTED with the Graph code as serverCode, and redact a bare JWT',
    async () => {
      authorizations.length = 0;
      const result = await runBundle(['request', 'GET', `${baseUrl}/v1.0/expired`]);

      expect(result.exitCode).toBe(1);
      expect(result.json?.['code']).toBe('TOKEN_REJECTED');
      expect(result.json?.['serverCode']).toBe('InvalidAuthenticationToken');
      expect(result.json?.['error']).toContain('[REDACTED]');
      expect(result.stdout).not.toContain(FAKE_JWT);
      // the token source ran and its token reached Graph
      expect(authorizations).toContain(`Bearer ${FAKE_GRAPH_TOKEN}`);
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  it(
    'should map a 403 to SCOPE_DENIED',
    async () => {
      const result = await runBundle(['request', 'GET', `${baseUrl}/v1.0/forbidden`]);

      expect(result.exitCode).toBe(1);
      expect(result.json?.['code']).toBe('SCOPE_DENIED');
      expect(result.json?.['serverCode']).toBe('ErrorAccessDenied');
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  it(
    'should retry a 429 three times, then map it to RATE_LIMITED',
    async () => {
      throttledRequests = 0;
      const result = await runBundle(['request', 'GET', `${baseUrl}/v1.0/throttled`]);

      expect(throttledRequests).toBe(1 + 3);
      expect(result.stderr).toContain('throttled by Microsoft Graph (429); waiting 0 s');
      expect(result.exitCode).toBe(1);
      expect(result.json?.['code']).toBe('RATE_LIMITED');
      expect(result.json?.['serverCode']).toBe('TooManyRequests');
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  it(
    'should apply --pick to each item of a collection page and keep the page fields',
    async () => {
      const result = await runBundle(['request', 'GET', `${baseUrl}/v1.0/me/messages`, '--pick', 'id']);
      const data = result.json?.['data'] as Record<string, unknown> | undefined;

      expect(result.exitCode).toBe(0);
      expect(result.json?.['ok']).toBe(true);
      expect(data?.['value']).toEqual([{ id: 'm1' }, { id: 'm2' }]);
      expect(data?.['@odata.nextLink']).toBe(`${baseUrl}/v1.0/me/messages?$skip=2`);
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  it(
    'should warn on stderr when --pick matches no fields',
    async () => {
      const result = await runBundle(['request', 'GET', `${baseUrl}/v1.0/me/messages`, '--pick', 'nope']);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('matched no fields');
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  it(
    "should fail auth show with the token source's code and serverCode when the source cannot produce a token",
    async () => {
      const result = await runBundle(['auth', 'show'], failingTokenCommand);
      const data = result.json?.['data'] as { readonly tokenSource?: Record<string, unknown> } | undefined;

      expect(result.exitCode).toBe(1);
      expect(result.json?.['ok']).toBe(false);
      expect(result.json?.['code']).toBe('AUTH_FORBIDDEN');
      expect(result.json?.['serverCode']).toBe(SCOPE_FORBIDDEN_SERVER_CODE);
      expect(data?.tokenSource?.['errorCode']).toBe('AUTH_FORBIDDEN');
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  describe('docs', () => {
    const workspaceRoot = findWorkspaceRoot();
    const sourceRefPath = join(workspaceRoot, 'packages/microsoft/refs/msgraph-cli/REF.md');

    it(
      'should list the embedded msgraph-cli ref',
      async () => {
        const result = await runBundle(['docs']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('`msgraph-cli`');
        expect(result.stdout).toContain('Run: msgraph-cli docs <topic>');
      },
      BUNDLE_TEST_TIMEOUT_MS
    );

    it(
      'should print the msgraph-cli ref byte-identical to the source file',
      async () => {
        const result = await runBundle(['docs', 'msgraph-cli']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe(readFileSync(sourceRefPath, 'utf8'));
      },
      BUNDLE_TEST_TIMEOUT_MS
    );

    it(
      'should fail an unknown topic with DOCS_TOPIC_NOT_FOUND',
      async () => {
        const result = await runBundle(['docs', 'nope']);

        expect(result.exitCode).not.toBe(0);
        expect(result.json?.['code']).toBe('DOCS_TOPIC_NOT_FOUND');
      },
      BUNDLE_TEST_TIMEOUT_MS
    );

    it('should ship the ref and its declaration in the built package', () => {
      const distPackage = join(workspaceRoot, 'dist/packages/microsoft');
      const packageJson = JSON.parse(readFileSync(join(distPackage, 'package.json'), 'utf8')) as { readonly dbxClaude?: { readonly refs?: readonly { readonly name: string }[] } };

      expect(readFileSync(join(distPackage, 'refs/msgraph-cli/REF.md'), 'utf8')).toBe(readFileSync(sourceRefPath, 'utf8'));
      expect(packageJson.dbxClaude?.refs?.[0]?.name).toBe('msgraph-cli');
    });
  });
});
