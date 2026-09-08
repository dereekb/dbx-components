import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MS_IN_HOUR } from '@dereekb/util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLI_DATA_CACHE_INDEX_FILE_NAME, type CliDataCache, type CliDataCacheEntry, cliDataCacheMeta, createCliDataCache, loadOrBuildCliCachedData } from './data-cache';
import { cliCacheFingerprint, cliDataCacheKey } from './data-cache.fingerprint';
import { DEFAULT_CLI_DATA_CACHE_OPTIONS, DISABLED_CLI_DATA_CACHE_OPTIONS } from './data-cache.options';

interface Row {
  readonly id: string;
  readonly at: Date;
}

const DATASET = 'worker.lineDetails';
const VERSION = 1;
const ENV = 'prod';
const ROWS: Row[] = [
  { id: 'a', at: new Date('2026-09-01T00:00:00.000Z') },
  { id: 'b', at: new Date('2026-09-02T00:00:00.000Z') }
];

describe('createCliDataCache()', () => {
  let dir: string;
  let cache: CliDataCache;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dbx-cli-data-cache-'));
    cache = createCliDataCache({ dataCacheDir: dir, cliBuildStamp: '1.0.0' });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /**
   * Rewrites a recorded entry's `builtAt` to age it, which is how the staleness paths are exercised
   * without waiting or stubbing the clock.
   */
  async function ageEntry(entry: CliDataCacheEntry, ageMs: number): Promise<void> {
    const indexPath = join(dir, CLI_DATA_CACHE_INDEX_FILE_NAME);
    const index = JSON.parse(await readFile(indexPath, 'utf8')) as Record<string, CliDataCacheEntry>;
    const key = cliDataCacheKey({ env: entry.env, dataset: entry.dataset, fingerprint: entry.fingerprint });
    index[key] = { ...entry, builtAt: new Date(Date.now() - ageMs).toISOString() };
    writeFileSync(indexPath, JSON.stringify(index, null, 2));
    // the index memoizes per instance, so an out-of-band edit needs a fresh one to be observed —
    // which is also what makes this a genuine cross-invocation test
    cache = createCliDataCache({ dataCacheDir: dir, cliBuildStamp: '1.0.0' });
  }

  it('reports a miss on an empty cache', async () => {
    await expect(cache.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION, env: ENV })).resolves.toBeUndefined();
  });

  it('records a build and reads it back, dates intact', async () => {
    await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });
    const hit = await cache.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION, env: ENV });

    expect(hit?.data).toHaveLength(2);
    expect(hit?.data[0]?.at).toBeInstanceOf(Date);
    expect(hit?.data[0]?.at.getTime()).toBe(ROWS[0]?.at.getTime());
  });

  it('records the row count, size, filter, and build stamp', async () => {
    const entry = await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, filter: { tg: ['b', 'a'] }, data: ROWS });

    expect(entry.itemCount).toBe(2);
    expect(entry.bytes).toBeGreaterThan(0);
    // stored NORMALIZED, so `cache list` shows what the build covers rather than how it was typed
    expect(entry.filter).toEqual({ tg: ['a', 'b'] });
    expect(entry.cliBuildStamp).toBe('1.0.0');
  });

  it('separates builds by filter and reuses one entry across equivalent filters', async () => {
    await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, filter: { tg: ['a'] }, data: ROWS });
    await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, filter: { limit: 5 }, data: [ROWS[0] as Row] });

    expect(await cache.listEntries()).toHaveLength(2);
    // key order and array order do not make a new build
    const hit = await cache.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION, env: ENV, filter: { tg: ['a'] } });
    expect(hit?.data).toHaveLength(2);
  });

  it('misses when the dataset version was bumped', async () => {
    await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });
    await expect(cache.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION + 1, env: ENV })).resolves.toBeUndefined();
  });

  it('misses when the env differs', async () => {
    await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });
    await expect(cache.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION, env: 'staging' })).resolves.toBeUndefined();
  });

  it('hits inside the age window and misses past it', async () => {
    const entry = await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });
    await ageEntry(entry, 3 * MS_IN_HOUR);

    await expect(cache.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION, env: ENV, maxAgeMs: 24 * MS_IN_HOUR })).resolves.toBeDefined();
    await expect(cache.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION, env: ENV, maxAgeMs: 1 * MS_IN_HOUR })).resolves.toBeUndefined();
  });

  it('hits regardless of age when no window is given', async () => {
    const entry = await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });
    await ageEntry(entry, 400 * MS_IN_HOUR);
    await expect(cache.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION, env: ENV })).resolves.toBeDefined();
  });

  it('writes every file readable by the owner only', async () => {
    // a recorded export holds production rows — worker names, emails, billing lines
    const entry = await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });
    expect(statSync(entry.file).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, CLI_DATA_CACHE_INDEX_FILE_NAME)).mode & 0o777).toBe(0o600);
  });

  it('overwrites a re-recorded build rather than accumulating entries', async () => {
    await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });
    await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: [ROWS[0] as Row] });

    expect(await cache.listEntries()).toHaveLength(1);
    const hit = await cache.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION, env: ENV });
    expect(hit?.data).toHaveLength(1);
  });

  describe('degrading to a miss', () => {
    it('misses and self-heals when the payload file was deleted', async () => {
      const entry = await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });
      rmSync(entry.file);

      await expect(cache.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION, env: ENV })).resolves.toBeUndefined();
      // the dangling index entry is dropped, so `cache list` cannot claim data that is not there
      expect(await cache.listEntries()).toHaveLength(0);
    });

    it('misses when the payload file is unparsable', async () => {
      const entry = await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });
      writeFileSync(entry.file, '{ not json');

      await expect(cache.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION, env: ENV })).resolves.toBeUndefined();
    });

    it('misses when the payload was written under another schema version', async () => {
      const entry = await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });
      const payload = JSON.parse(await readFile(entry.file, 'utf8'));
      writeFileSync(entry.file, JSON.stringify({ ...payload, schemaVersion: 999 }));

      await expect(cache.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION, env: ENV })).resolves.toBeUndefined();
    });

    it('misses on a corrupt index instead of throwing', async () => {
      // a cache is never allowed to turn into a failure — the caller must always be able to rebuild
      writeFileSync(join(dir, CLI_DATA_CACHE_INDEX_FILE_NAME), 'not json at all');
      const fresh = createCliDataCache({ dataCacheDir: dir });

      await expect(fresh.loadData<Row[]>({ dataset: DATASET, datasetVersion: VERSION, env: ENV })).resolves.toBeUndefined();
      await expect(fresh.listEntries()).resolves.toEqual([]);
    });
  });

  describe('listEntries()', () => {
    it('orders newest build first and narrows by env and dataset', async () => {
      const older = await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });
      await ageEntry(older, 5 * MS_IN_HOUR);
      await cache.saveData({ dataset: 'worker.source', datasetVersion: VERSION, env: 'staging', data: ROWS });

      const all = await cache.listEntries();
      expect(all.map((entry) => entry.dataset)).toEqual(['worker.source', DATASET]);
      expect(await cache.listEntries({ env: ENV })).toHaveLength(1);
      expect(await cache.listEntries({ dataset: 'worker.source' })).toHaveLength(1);
    });
  });

  describe('removeEntries()', () => {
    it('removes the matching entries and their payload files', async () => {
      const kept = await cache.saveData({ dataset: 'worker.source', datasetVersion: VERSION, env: 'staging', data: ROWS });
      const removedEntry = await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });

      const removed = await cache.removeEntries({ env: ENV });

      expect(removed).toHaveLength(1);
      expect(() => statSync(removedEntry.file)).toThrow();
      expect(statSync(kept.file).isFile()).toBe(true);
      expect(await cache.listEntries()).toHaveLength(1);
    });

    it('removes only entries older than the given age', async () => {
      const older = await cache.saveData({ dataset: DATASET, datasetVersion: VERSION, env: ENV, data: ROWS });
      await ageEntry(older, 50 * MS_IN_HOUR);
      await cache.saveData({ dataset: 'worker.source', datasetVersion: VERSION, env: ENV, data: ROWS });

      const removed = await cache.removeEntries({ olderThanMs: 24 * MS_IN_HOUR });

      expect(removed.map((entry) => entry.dataset)).toEqual([DATASET]);
      expect(await cache.listEntries()).toHaveLength(1);
    });
  });
});

describe('loadOrBuildCliCachedData()', () => {
  let dir: string;
  let cache: CliDataCache;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dbx-cli-load-or-build-'));
    cache = createCliDataCache({ dataCacheDir: dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function inputFor(build: () => Promise<Row[]>, options = DEFAULT_CLI_DATA_CACHE_OPTIONS) {
    return { cache, dataset: DATASET, datasetVersion: VERSION, env: ENV, options, build };
  }

  it('builds and records when reads are off, reporting the build as fresh', async () => {
    const build = vi.fn(async () => ROWS);
    const result = await loadOrBuildCliCachedData<Row[]>(inputFor(build));

    expect(build).toHaveBeenCalledTimes(1);
    expect(result.fromCache).toBe(false);
    expect(result.ageMs).toBe(0);
    expect(result.itemCount).toBe(2);
    // recorded even though this run did not read: that is what makes a later `--cache` run instant
    expect(await cache.listEntries()).toHaveLength(1);
  });

  it('rebuilds every time while reads are off, even with a recorded build present', async () => {
    const build = vi.fn(async () => ROWS);
    await loadOrBuildCliCachedData<Row[]>(inputFor(build));
    await loadOrBuildCliCachedData<Row[]>(inputFor(build));

    expect(build).toHaveBeenCalledTimes(2);
  });

  it('serves a recorded build without calling build() once reads are on', async () => {
    const build = vi.fn(async () => ROWS);
    await loadOrBuildCliCachedData<Row[]>(inputFor(build));

    const second = vi.fn(async () => ROWS);
    const result = await loadOrBuildCliCachedData<Row[]>(inputFor(second, { read: true, write: true }));

    expect(second).not.toHaveBeenCalled();
    expect(result.fromCache).toBe(true);
    expect(result.data[0]?.at).toBeInstanceOf(Date);
  });

  it('never runs the earlier stage when the later stage hits', async () => {
    // the property that makes nesting these calls resolve a pipeline back-to-front: on a hit the
    // enclosing build closure — and therefore every read it would have done — is never entered
    const readOptions = { read: true, write: true };
    const source = vi.fn(async () => ROWS);
    const lineDetails = async () =>
      loadOrBuildCliCachedData<Row[]>({
        cache,
        dataset: DATASET,
        datasetVersion: VERSION,
        env: ENV,
        options: readOptions,
        build: async () => {
          const inner = await loadOrBuildCliCachedData<Row[]>({ cache, dataset: 'worker.source', datasetVersion: VERSION, env: ENV, options: readOptions, build: source });
          return inner.data;
        }
      });

    await lineDetails();
    expect(source).toHaveBeenCalledTimes(1);

    await lineDetails();
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('records nothing when writes are off', async () => {
    const result = await loadOrBuildCliCachedData<Row[]>(inputFor(async () => ROWS, DISABLED_CLI_DATA_CACHE_OPTIONS));

    expect(result.fromCache).toBe(false);
    // still reports a fingerprint and a build time, so the envelope reads the same either way
    expect(result.fingerprint).toBe(cliCacheFingerprint({ dataset: DATASET, datasetVersion: VERSION, env: ENV }));
    expect(await cache.listEntries()).toHaveLength(0);
  });
});

describe('cliDataCacheMeta()', () => {
  const result = { data: [], fromCache: true, dataset: DATASET, fingerprint: 'abc', builtAt: new Date('2026-09-08T00:00:00.000Z'), ageMs: 3600, itemCount: 7 };

  it('renders one result as an object', () => {
    expect(cliDataCacheMeta(result)).toEqual({ cache: { dataset: DATASET, fingerprint: 'abc', fromCache: true, builtAt: '2026-09-08T00:00:00.000Z', ageMs: 3600, itemCount: 7 } });
  });

  it('renders a pipeline as an array, one entry per stage', () => {
    const meta = cliDataCacheMeta([result, { ...result, dataset: 'worker.source', fromCache: false }]);
    expect((meta['cache'] as unknown[]).length).toBe(2);
  });
});
