import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { type FirestoreQueryConstraint, where } from '@dereekb/firebase';
import { setCliContext, type CliContext } from '../context/cli.context';
import { type CliFirestoreQueryManifest, type CliFirestoreQueryManifestEntry } from '../manifest/types';
import { buildFirestoreQueryCommand } from './firestore-query.command';
import { type CliFirestoreModels } from './firestore.models';

interface QueryCall {
  readonly constraints: readonly FirestoreQueryConstraint[];
  readonly kind: 'pairs' | 'count';
}

const calls: QueryCall[] = [];

/**
 * Stub collection whose `queryDocument` records the constraints it was handed, so the command's
 * params → constraints → execution path can be asserted without an emulator.
 *
 * `getDocSnapshotDataPairs` returns pairs shaped exactly the way `runCliFirestoreQuery` reads them:
 * a `document` carrying key/id/converter and a `snapshot` the converter decodes.
 */
function buildStubCollection() {
  return {
    queryDocument: (...constraints: FirestoreQueryConstraint[]) => ({
      getDocSnapshotDataPairs: async () => {
        calls.push({ constraints, kind: 'pairs' });
        return [
          {
            document: { key: 'gb/one', id: 'one', converter: { fromFirestore: (snapshot: { readonly raw: string }) => ({ decoded: snapshot.raw }) } },
            snapshot: { raw: 'first' }
          }
        ];
      },
      countDocs: async () => {
        calls.push({ constraints, kind: 'count' });
        return 7;
      }
    })
  };
}

function buildModels(): CliFirestoreModels {
  const collection = buildStubCollection();

  return {
    session: { fromCache: false } as never,
    collections: {},
    binding: { collections: () => ({}), models: (() => ({})) as never },
    allTypes: () => ['guestbook'],
    serviceFor: () => ({ loadModelForKey: (() => undefined) as never, getFirestoreCollection: () => collection as never }),
    modelTypeForCollection: () => 'guestbook'
  };
}

function buildEntry(input: Partial<CliFirestoreQueryManifestEntry> & { readonly slug: string; readonly name: string }): CliFirestoreQueryManifestEntry {
  return {
    module: 'demo-firebase',
    subpath: 'model/guestbook/guestbook.query',
    model: 'Guestbook',
    collection: 'gb',
    isNested: false,
    scope: 'COLLECTION',
    signature: `${input.name}(params: PublishedGuestbooksQueryParams): FirestoreQueryConstraint[]`,
    params: [{ name: 'params', type: 'PublishedGuestbooksQueryParams', optional: false }],
    factory: (params: any) => [where('published', '==', params.published)],
    ...input
  } as CliFirestoreQueryManifestEntry;
}

const PUBLISHED = buildEntry({ slug: 'published-guestbooks', name: 'publishedGuestbooksQuery' });
const NOT_INVOCABLE = buildEntry({ slug: 'internal-scan', name: 'internalScanQuery', factory: undefined, params: [] });
const MANIFEST: CliFirestoreQueryManifest = [PUBLISHED, NOT_INVOCABLE];

function buildStubContext(models?: CliFirestoreModels): CliContext {
  return {
    cliName: 'demo-cli',
    envName: 'local',
    env: { apiBaseUrl: 'http://localhost/api' } as never,
    accessToken: 'token',
    callModel: (async () => undefined) as never,
    getModel: (async () => ({ key: '', data: null })) as never,
    getMultipleModels: (async () => ({ results: [], errors: [] })) as never,
    ...(models ? { getFirestoreModels: async () => models } : {})
  };
}

async function runQuery(argv: readonly string[]): Promise<void> {
  await yargs([...argv])
    .command(buildFirestoreQueryCommand(MANIFEST))
    .exitProcess(false)
    .fail((msg: string, err: Error | undefined) => {
      throw err ?? new Error(msg);
    })
    .parseAsync();
}

describe('buildFirestoreQueryCommand()', () => {
  let stdout: string[] = [];
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    calls.length = 0;
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
    setCliContext(undefined);
  });

  it('honours a command-name override', () => {
    expect(buildFirestoreQueryCommand(MANIFEST, { commandName: 'fq' }).command).toBe('fq <query>');
  });

  it('emits the { ok, data, meta } envelope with DECODED rows', async () => {
    setCliContext(buildStubContext(buildModels()));
    await runQuery(['firestore-query', 'published-guestbooks', '--params', '{"published":true}']);

    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.ok).toBe(true);
    expect(parsed.meta).toEqual({ source: 'firestore', sessionFromCache: false });
    expect(parsed.data).toMatchObject({ slug: 'published-guestbooks', model: 'Guestbook', collection: 'gb', scope: 'COLLECTION', count: 1, source: 'firestore' });
    expect(parsed.data.rows).toEqual([{ key: 'gb/one', id: 'one', data: { decoded: 'first' } }]);
  });

  it('passes the factory-produced constraints through to the query', async () => {
    setCliContext(buildStubContext(buildModels()));
    await runQuery(['firestore-query', 'published-guestbooks', '--params', '{"published":true}']);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.kind).toBe('pairs');
    expect(calls[0]?.constraints).toHaveLength(1);
  });

  it('appends a limit constraint under --limit', async () => {
    setCliContext(buildStubContext(buildModels()));
    await runQuery(['firestore-query', 'published-guestbooks', '--params', '{"published":true}', '--limit', '5']);
    expect(calls[0]?.constraints.length).toBe(2);
  });

  it('returns the count with no rows under --count', async () => {
    setCliContext(buildStubContext(buildModels()));
    await runQuery(['firestore-query', 'published-guestbooks', '--params', '{"published":true}', '--count']);

    const parsed = JSON.parse(stdout.join(''));
    expect(calls[0]?.kind).toBe('count');
    expect(parsed.data.count).toBe(7);
    expect(parsed.data.rows).toBeUndefined();
  });

  it('resolves the entry by exported identifier too', async () => {
    setCliContext(buildStubContext(buildModels()));
    await runQuery(['firestore-query', 'publishedGuestbooksQuery', '--params', '{"published":true}']);
    expect(JSON.parse(stdout.join('')).data.slug).toBe('published-guestbooks');
  });

  it('refuses a non-invocable entry with FIRESTORE_QUERY_NOT_INVOCABLE, naming the module', async () => {
    setCliContext(buildStubContext(buildModels()));
    await expect(runQuery(['firestore-query', 'internal-scan'])).rejects.toThrow(/process\.exit:1/);

    const parsed = JSON.parse(stdout.join(''));
    expect(parsed).toMatchObject({ ok: false, code: 'FIRESTORE_QUERY_NOT_INVOCABLE' });
    expect(parsed.error).toContain('internalScanQuery');
    expect(parsed.error).toContain('demo-firebase');
    expect(calls).toHaveLength(0);
  });

  it('fails with NOT_FOUND for an unknown query', async () => {
    setCliContext(buildStubContext(buildModels()));
    await expect(runQuery(['firestore-query', 'nope'])).rejects.toThrow(/process\.exit:1/);
    expect(JSON.parse(stdout.join(''))).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('fails with INVALID_ARGUMENT when the required params are omitted', async () => {
    setCliContext(buildStubContext(buildModels()));
    await expect(runQuery(['firestore-query', 'published-guestbooks'])).rejects.toThrow(/process\.exit:1/);
    expect(JSON.parse(stdout.join(''))).toMatchObject({ ok: false, code: 'INVALID_ARGUMENT' });
  });

  it('fails with INVALID_ARGUMENT when the CLI has no firestore binding', async () => {
    setCliContext(buildStubContext());
    await expect(runQuery(['firestore-query', 'published-guestbooks', '--params', '{"published":true}'])).rejects.toThrow(/process\.exit:1/);
    expect(JSON.parse(stdout.join(''))).toMatchObject({ ok: false, code: 'INVALID_ARGUMENT' });
  });

  it('rejects --parent on a root-collection entry', async () => {
    setCliContext(buildStubContext(buildModels()));
    await expect(runQuery(['firestore-query', 'published-guestbooks', '--params', '{"published":true}', '--parent', 'gb/abc'])).rejects.toThrow(/process\.exit:1/);
    expect(JSON.parse(stdout.join('')).error).toContain('not a subcollection');
  });
});
