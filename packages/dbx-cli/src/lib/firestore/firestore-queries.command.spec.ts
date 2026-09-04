import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { type CliFirestoreQueryManifest, type CliFirestoreQueryManifestEntry } from '../manifest/types';
import { buildFirestoreQueriesCommand } from './firestore-queries.command';

function buildEntry(input: Partial<CliFirestoreQueryManifestEntry> & { readonly slug: string; readonly name: string }): CliFirestoreQueryManifestEntry {
  return {
    module: 'demo-firebase',
    subpath: 'model/guestbook/guestbook.query',
    model: 'Guestbook',
    collection: 'gb',
    isNested: false,
    scope: 'COLLECTION',
    signature: `${input.name}(): FirestoreQueryConstraint[]`,
    params: [],
    factory: () => [],
    ...input
  } as CliFirestoreQueryManifestEntry;
}

const MANIFEST: CliFirestoreQueryManifest = [
  buildEntry({ slug: 'published-guestbooks', name: 'publishedGuestbooksQuery', category: 'listing', tags: ['guestbook'] }),
  buildEntry({ slug: 'published-guestbook-entries', name: 'publishedGuestbookEntriesQuery', model: 'GuestbookEntry', collection: 'gbe', isNested: true, scope: 'COLLECTION_GROUP', category: 'listing' }),
  buildEntry({ slug: 'internal-scan', name: 'internalScanQuery', factory: undefined })
];

async function runQueries(argv: readonly string[]): Promise<void> {
  await yargs([...argv])
    .command(buildFirestoreQueriesCommand(MANIFEST))
    .exitProcess(false)
    .fail((msg: string, err: Error | undefined) => {
      throw err ?? new Error(msg);
    })
    .parseAsync();
}

describe('buildFirestoreQueriesCommand()', () => {
  let stdout: string[] = [];
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdout = [];
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      stdout.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((arg: any) => {
      stdout.push(String(arg));
    });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null): never => {
      throw new Error(`process.exit:${code ?? 0}`);
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('reports the catalog size in its describe text', () => {
    expect(buildFirestoreQueriesCommand(MANIFEST).describe).toContain('3 queries');
  });

  it('uses the singular in its describe text for a one-entry catalog', () => {
    expect(buildFirestoreQueriesCommand([MANIFEST[0] as CliFirestoreQueryManifestEntry]).describe).toContain('1 query');
  });

  it('honours a command-name override', () => {
    expect(buildFirestoreQueriesCommand(MANIFEST, { commandName: 'fq' }).command).toBe('fq [query]');
  });

  it('lists every entry as a table by default', async () => {
    await runQueries(['firestore-queries']);
    const output = stdout.join('');
    expect(output).toContain('SLUG');
    expect(output).toContain('published-guestbooks');
    expect(output).toContain('published-guestbook-entries');
    expect(output).toContain('internal-scan');
  });

  it('filters by --model', async () => {
    await runQueries(['firestore-queries', '--model', 'GuestbookEntry']);
    const output = stdout.join('');
    expect(output).toContain('published-guestbook-entries');
    expect(output).not.toContain('published-guestbooks ');
  });

  it('filters by --tag', async () => {
    await runQueries(['firestore-queries', '--tag', 'guestbook']);
    expect(stdout.join('')).not.toContain('internal-scan');
  });

  it('emits the { ok, data } envelope under --json, replacing factory with invocable', async () => {
    await runQueries(['firestore-queries', '--json']);
    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.ok).toBe(true);
    expect(parsed.data).toHaveLength(3);
    expect(parsed.data.every((e: Record<string, unknown>) => !('factory' in e))).toBe(true);
    expect(parsed.data.find((e: Record<string, unknown>) => e['slug'] === 'published-guestbooks')?.invocable).toBe(true);
    expect(parsed.data.find((e: Record<string, unknown>) => e['slug'] === 'internal-scan')?.invocable).toBe(false);
  });

  it('renders one entry in detail when a positional is supplied', async () => {
    await runQueries(['firestore-queries', 'published-guestbook-entries']);
    const output = stdout.join('');
    expect(output).toContain('# published-guestbook-entries');
    expect(output).toContain('Scope: COLLECTION_GROUP');
    expect(output).toContain('Invocable: yes');
  });

  it('resolves a detail lookup by exported identifier too', async () => {
    await runQueries(['firestore-queries', 'internalScanQuery']);
    expect(stdout.join('')).toContain('# internal-scan');
  });

  it('marks a factory-less entry INVOCABLE = no in the detail view', async () => {
    await runQueries(['firestore-queries', 'internal-scan']);
    expect(stdout.join('')).toContain('Invocable: no — internalScanQuery is not exported from demo-firebase');
  });

  it('emits the single-entry { ok, data } envelope under --json', async () => {
    await runQueries(['firestore-queries', 'published-guestbooks', '--json']);
    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.ok).toBe(true);
    expect(parsed.data.slug).toBe('published-guestbooks');
    expect(parsed.data.invocable).toBe(true);
  });

  it('fails with a NOT_FOUND envelope for an unknown query', async () => {
    // wrapSyncCommandHandler catches, prints the envelope, and exits — the stub turns that into a throw
    await expect(runQueries(['firestore-queries', 'nope'])).rejects.toThrow(/process\.exit:1/);
    const parsed = JSON.parse(stdout.join(''));
    expect(parsed).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(parsed.suggestion).toContain('published-guestbooks');
  });
});
