import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { type DocsListResult, type DocsReadResult } from '@dereekb/firebase';
import { type CliContext, setCliContext } from '../context/cli.context';
import { configureOutputOptions } from '../util/output';
import { buildDocsApiCommand } from './docs-api.command';

const LIST: DocsListResult = {
  docs: [
    { id: 'guestbook/signing', title: 'Signing a guestbook', description: 'How entries are signed.', sections: [{ id: 'overview', title: 'Overview', depth: 2 }] },
    { id: 'getting-started', title: 'Getting started', sections: [] }
  ]
};

const READ: DocsReadResult = { id: 'guestbook/signing', title: 'Signing a guestbook', content: '# Signing a guestbook\n\n## Overview\n\nBody.' };

function buildStubContext(): CliContext {
  return {
    cliName: 'demo-cli',
    envName: 'local',
    env: { apiBaseUrl: 'http://localhost/api/', oidcIssuer: 'http://localhost/oidc' },
    accessToken: 'cli-access-token',
    callModel: (async () => undefined) as never,
    getModel: (async () => ({ key: '', data: null })) as never,
    getMultipleModels: (async () => ({ results: [], errors: [] })) as never
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('buildDocsApiCommand()', () => {
  let stdout: string[] = [];
  let stderr: string[] = [];
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  async function runDocs(args: readonly string[], fetcher: typeof fetch): Promise<Error | undefined> {
    let captured: Error | undefined;

    try {
      await yargs([...args])
        .command(buildDocsApiCommand({ fetcher }))
        .exitProcess(false)
        .fail((msg: string, err: Error | undefined) => {
          throw err ?? new Error(msg);
        })
        .parseAsync();
    } catch (e) {
      captured = e as Error;
    }

    return captured;
  }

  beforeEach(() => {
    stdout = [];
    stderr = [];
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      stdout.push(String(chunk));
      return true;
    });
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
      stderr.push(String(chunk));
      return true;
    });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((arg: any) => {
      stdout.push(`${String(arg)}\n`);
    });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null): never => {
      throw new Error(`process.exit:${code ?? 0}`);
    });
    setCliContext(buildStubContext());
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    setCliContext(undefined);
    configureOutputOptions({});
  });

  it('prints the list as markdown', async () => {
    expect(await runDocs(['docs', 'list'], (async () => jsonResponse(LIST)) as typeof fetch)).toBeUndefined();
    const output = stdout.join('');
    expect(output).toContain('# Docs you can read (2)');
    expect(output).toContain('`demo-cli docs read <id> [section]`');
  });

  it('prints the list envelope with --json', async () => {
    expect(await runDocs(['docs', 'list', '--json'], (async () => jsonResponse(LIST)) as typeof fetch)).toBeUndefined();
    expect(JSON.parse(stdout.join(''))).toEqual({ ok: true, data: LIST });
  });

  it('switches to JSON and picks each doc with --pick', async () => {
    configureOutputOptions({ pick: 'id' });
    expect(await runDocs(['docs', 'list', '--pick', 'id'], (async () => jsonResponse(LIST)) as typeof fetch)).toBeUndefined();
    expect(JSON.parse(stdout.join('')).data).toEqual({ docs: [{ id: 'guestbook/signing' }, { id: 'getting-started' }] });
  });

  it('joins the search words and forwards --limit', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ total: 0, results: [] }));
    expect(await runDocs(['docs', 'search', 'guestbook', 'signing', '--limit', '3'], fetcher as unknown as typeof fetch)).toBeUndefined();
    const [url] = fetcher.mock.calls[0] as unknown as [string];
    expect(url).toBe('http://localhost/api/docs/search?q=guestbook+signing&limit=3');
    expect(stdout.join('')).toContain('No docs match "guestbook signing".');
  });

  it('prints exactly the content for read', async () => {
    const fetcher = vi.fn(async () => jsonResponse(READ));
    expect(await runDocs(['docs', 'read', 'guestbook/signing'], fetcher as unknown as typeof fetch)).toBeUndefined();
    expect(stdout.join('')).toBe(`${READ.content}\n`);
    expect(stderr).toEqual([]);
  });

  it('forwards the section for read <id> <section>', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ ...READ, section: { id: 'overview', title: 'Overview' }, content: '## Overview\n\nBody.' }));
    expect(await runDocs(['docs', 'read', 'guestbook/signing', 'overview'], fetcher as unknown as typeof fetch)).toBeUndefined();
    const [url] = fetcher.mock.calls[0] as unknown as [string];
    expect(url).toBe('http://localhost/api/docs/read?id=guestbook%2Fsigning&section=overview');
    expect(stdout.join('')).toBe('## Overview\n\nBody.\n');
  });

  it('notes a truncated read on stderr and leaves stdout raw', async () => {
    expect(await runDocs(['docs', 'read', 'guestbook/signing'], (async () => jsonResponse({ ...READ, truncated: true })) as typeof fetch)).toBeUndefined();
    expect(stdout.join('')).toBe(`${READ.content}\n`);
    expect(stderr.join('')).toContain("was cut at the server's maximum read length");
    expect(stderr.join('')).toContain('`demo-cli docs list --sections`');
  });

  it('exits 1 with the error envelope on a failure', async () => {
    const error = await runDocs(['docs', 'read', 'no/such-doc'], (async () => jsonResponse({ statusCode: 404, message: 'No doc with id "no/such-doc".', code: 'DOCS_NOT_FOUND' }, 404)) as typeof fetch);
    expect(error?.message).toBe('process.exit:1');
    const output = JSON.parse(stdout.join(''));
    expect(output.ok).toBe(false);
    expect(output.serverCode).toBe('DOCS_NOT_FOUND');
    expect(output.suggestion).toContain('demo-cli docs list');
  });

  it('demands a subcommand', async () => {
    const error = await runDocs(['docs'], (async () => jsonResponse(LIST)) as typeof fetch);
    expect(error?.message).toContain('Specify a docs subcommand');
  });
});
