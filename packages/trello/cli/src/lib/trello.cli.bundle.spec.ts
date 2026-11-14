import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { TRELLO_CLI_CONFIG_DIR_ENV_VAR } from './config/cli.config';

/**
 * Smoke tests against the BUILT trello-cli binary (`dist/packages/trello/bin/index.js`).
 *
 * The in-process specs call `configureTrelloCliOutput()` themselves, so they cannot see a bundler dropping it (a bare
 * side-effect import is tree-shaken out of a `"sideEffects": false` package, and the binary would ship without its
 * Trello error mapping and redaction). These run the binary as a child process against a fake Trello on 127.0.0.1,
 * with every `TRELLO_*` env var stripped.
 *
 * `nx test trello-cli` builds the binary first (its `test` target depends on `build-bin`).
 */

const BUNDLE_TEST_TIMEOUT_MS = 30000;
const FAKE_KEY = 'fake-bundle-key';
const FAKE_TOKEN = 'fake-bundle-token';

interface BundleRunResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /**
   * The last non-empty stdout line, parsed.
   */
  readonly json: Record<string, any> | undefined;
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
  const last = stdout.split('\n').findLast((line) => line.trim().length > 0);
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

function send(res: ServerResponse, status: number, body: unknown): void {
  const isText = typeof body === 'string';
  res.writeHead(status, { 'Content-Type': isText ? 'text/plain' : 'application/json' });
  res.end(isText ? body : JSON.stringify(body));
}

describe('trello-cli bundle', () => {
  const workspaceRoot = findWorkspaceRoot();
  const bundlePath = join(workspaceRoot, 'dist/packages/trello/bin/index.js');
  const authorizations: (string | undefined)[] = [];

  let server: Server;
  let apiUrl: string;
  let dir: string;

  /**
   * Runs the binary asynchronously — never `spawnSync`, which would block the event loop so the in-process fake Trello
   * could never answer.
   *
   * @param args - The CLI arguments.
   * @param options - Whether to pass the fake key + token, and extra env vars.
   * @returns The exit code, output and parsed envelope.
   */
  function runBundle(args: readonly string[], options: { readonly credentials?: boolean; readonly env?: NodeJS.ProcessEnv } = {}): Promise<BundleRunResult> {
    const env: NodeJS.ProcessEnv = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith('TRELLO_')) {
        env[key] = value;
      }
    }

    env[TRELLO_CLI_CONFIG_DIR_ENV_VAR] = join(dir, 'config');

    if (options.credentials !== false) {
      env['TRELLO_API_KEY'] = FAKE_KEY;
      env['TRELLO_API_TOKEN'] = FAKE_TOKEN;
    }

    Object.assign(env, options.env);

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
      throw new Error(`The trello-cli binary is missing at ${bundlePath}. Build it first: npx nx run trello-cli:build-bin (nx test trello-cli does this through dependsOn)`);
    }

    dir = mkdtempSync(join(tmpdir(), 'trello-cli-bundle-'));

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      authorizations.push(req.headers.authorization);
      const path = (req.url ?? '').split('?')[0];

      switch (path) {
        case '/1/members/me/boards':
          send(res, 200, [{ id: 'board-1', name: 'Bundle Board' }]);
          break;
        case '/1/members/me':
          send(res, 200, { id: 'member-1', username: 'bundle-bot', fullName: 'Bundle Bot', initials: 'BB', avatarUrl: null });
          break;
        case '/1/cards/expired':
          // the token is echoed in the body: only trello-cli's own token= pattern redacts it
          send(res, 401, `invalid token=${FAKE_TOKEN}`);
          break;
        case '/1/cards/forbidden':
          send(res, 403, 'unauthorized card permission requested');
          break;
        case '/1/cards/throttled':
          send(res, 429, 'API_TOKEN_LIMIT_EXCEEDED');
          break;
        default:
          send(res, 404, 'The requested resource was not found.');
          break;
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/1`;
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

      for (const command of ['auth', 'board', 'list', 'card', 'comment', 'attachment', 'checklist', 'search', 'request', 'docs', 'doctor', 'extensions']) {
        expect(result.stdout).toContain(command);
      }
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  it(
    'should call the fake Trello with the key + token header and print the envelope',
    async () => {
      authorizations.length = 0;
      const result = await runBundle(['board', 'list', '--api-url', apiUrl]);

      expect(result.exitCode).toBe(0);
      expect(result.json).toEqual({ ok: true, data: [{ id: 'board-1', name: 'Bundle Board' }] });
      expect(authorizations).toEqual([`OAuth oauth_consumer_key="${FAKE_KEY}", oauth_token="${FAKE_TOKEN}"`]);
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  it(
    'should fail with NOT_CONFIGURED and exit code 4 without credentials',
    async () => {
      const result = await runBundle(['board', 'list', '--api-url', apiUrl], { credentials: false });

      expect(result.exitCode).toBe(4);
      expect(result.json?.['code']).toBe('NOT_CONFIGURED');
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  it(
    'should map a 401 to TOKEN_REJECTED and redact the echoed token',
    async () => {
      const result = await runBundle(['card', 'get', 'expired', '--api-url', apiUrl]);

      expect(result.exitCode).toBe(1);
      expect(result.json).toMatchObject({ ok: false, code: 'TOKEN_REJECTED', httpStatus: 401 });
      expect(result.json?.['error']).toContain('[REDACTED]');
      expect(result.stdout).not.toContain(FAKE_TOKEN);
      expect(result.stderr).not.toContain(FAKE_TOKEN);
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  it.each([
    ['forbidden', 'SCOPE_DENIED'],
    ['throttled', 'RATE_LIMITED'],
    ['missing', 'NOT_FOUND']
  ])(
    'should map card %s to %s',
    async (card, code) => {
      const result = await runBundle(['card', 'get', card, '--api-url', apiUrl]);

      expect(result.exitCode).toBe(1);
      expect(result.json?.['code']).toBe(code);
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  it(
    'should refuse an --api-url off the Trello host',
    async () => {
      const result = await runBundle(['board', 'list', '--api-url', 'https://evil.example.com/1']);

      expect(result.exitCode).not.toBe(0);
      expect(result.json?.['code']).toBe('INVALID_ARGUMENT');
    },
    BUNDLE_TEST_TIMEOUT_MS
  );

  describe('plugins', () => {
    let fixturePath: string;
    let brokenPath: string;

    beforeAll(() => {
      fixturePath = join(dir, 'fixture.plugin.mjs');
      brokenPath = join(dir, 'broken.plugin.mjs');
      writeFileSync(
        fixturePath,
        `export default {
  apiVersion: 1,
  name: 'fixture',
  version: '0.0.1',
  setup: (api) => {
    console.log('setup output goes to stderr, never stdout');
    return { commands: [{ command: 'hello', describe: 'Say hello', requires: 'none', handler: (_argv, ctx) => ctx.output.result({ hello: api.pluginName, source: api.source, stateDir: ctx.stateDir() }) }] };
  }
};
`
      );
      writeFileSync(brokenPath, `throw new Error('broken on import');\n`);
    });

    it(
      'should load a plugin with --extension and run its command',
      async () => {
        const result = await runBundle(['--extension', fixturePath, 'fixture', 'hello']);

        expect(result.exitCode).toBe(0);
        expect(result.json).toEqual({ ok: true, data: { hello: 'fixture', source: 'flag', stateDir: join(dir, 'config', 'state', 'fixture') } });
        expect(result.stdout).not.toContain('setup output');
        expect(result.stderr).toContain('setup output goes to stderr');
      },
      BUNDLE_TEST_TIMEOUT_MS
    );

    it(
      'should warn about a plugin that throws on import while the core commands keep working',
      async () => {
        const result = await runBundle(['--extension', brokenPath, 'board', 'list', '--api-url', apiUrl]);

        expect(result.exitCode).toBe(0);
        expect(result.json?.['data']).toEqual([{ id: 'board-1', name: 'Bundle Board' }]);
        expect(result.json?.['meta']?.['warnings']).toEqual([expect.stringContaining('broken on import')]);
        expect(result.stderr).toContain('broken on import');
      },
      BUNDLE_TEST_TIMEOUT_MS
    );

    it(
      'should list the plugins with extensions, and load none with --no-extensions',
      async () => {
        const listed = await runBundle(['--extension', fixturePath, '--extension', brokenPath, 'extensions']);

        expect(listed.exitCode).toBe(0);
        expect(listed.json?.['data']['plugins']).toEqual([expect.objectContaining({ source: 'flag', name: 'fixture', status: 'loaded', commands: ['hello'] }), expect.objectContaining({ source: 'flag', status: 'failed', step: 'import' })]);

        const disabled = await runBundle(['--no-extensions', '--extension', fixturePath, 'extensions']);

        expect(disabled.json?.['data']).toEqual({ externalDisabled: true, plugins: [] });

        const unknown = await runBundle(['--no-extensions', '--extension', fixturePath, 'fixture', 'hello']);

        expect(unknown.exitCode).toBe(1);
        expect(unknown.json?.['ok']).toBe(false);
      },
      BUNDLE_TEST_TIMEOUT_MS
    );

    it(
      'should load plugins listed in TRELLO_CLI_EXTENSIONS',
      async () => {
        const result = await runBundle(['fixture', 'hello'], { env: { TRELLO_CLI_EXTENSIONS: fixturePath } });

        expect(result.exitCode).toBe(0);
        expect(result.json?.['data']['source']).toBe('env');
      },
      BUNDLE_TEST_TIMEOUT_MS
    );
  });

  describe('docs', () => {
    const sourceRefPath = join(workspaceRoot, 'packages/trello/refs/trello-cli/REF.md');

    it(
      'should list the embedded trello-cli ref',
      async () => {
        const result = await runBundle(['docs']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('`trello-cli`');
      },
      BUNDLE_TEST_TIMEOUT_MS
    );

    it(
      'should print the trello-cli ref byte-identical to the source file',
      async () => {
        const result = await runBundle(['docs', 'trello-cli']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe(readFileSync(sourceRefPath, 'utf8'));
      },
      BUNDLE_TEST_TIMEOUT_MS
    );

    it('should ship the ref, the library entry and the bin declaration in the built package', () => {
      const distPackage = join(workspaceRoot, 'dist/packages/trello');
      const packageJson = JSON.parse(readFileSync(join(distPackage, 'package.json'), 'utf8')) as { readonly bin?: Record<string, string>; readonly exports?: Record<string, unknown>; readonly dbxClaude?: { readonly refs?: readonly { readonly name: string }[] } };

      expect(readFileSync(join(distPackage, 'refs/trello-cli/REF.md'), 'utf8')).toBe(readFileSync(sourceRefPath, 'utf8'));
      expect(packageJson.bin?.['trello-cli']).toBe('bin/index.js');
      expect(packageJson.exports?.['./cli']).toBeDefined();
      expect(packageJson.dbxClaude?.refs?.[0]?.name).toBe('trello-cli');
      expect(existsSync(join(distPackage, 'cli/index.esm.js'))).toBe(true);
      expect(existsSync(join(distPackage, 'cli/index.d.ts'))).toBe(true);
    });
  });
});
