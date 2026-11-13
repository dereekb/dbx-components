import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError } from '../util/output';
import { addCliDownloadCounts, cliDownloadManifestStore, emptyCliDownloadCounts } from './download.manifest';

interface TestManifest {
  readonly version: 1;
  readonly source: string;
  readonly files: Record<string, string>;
}

const MANIFEST_FILE = '.test-download.json';

describe('cliDownloadManifestStore()', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dbx-cli-download-manifest-'));
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  function makeStore(saveDebounce?: number) {
    return cliDownloadManifestStore<TestManifest>({
      dir,
      fileName: MANIFEST_FILE,
      saveDebounce,
      empty: () => ({ version: 1, source: 's1', files: {} }),
      accept: (existing) => {
        const manifest = existing as TestManifest;

        if (manifest.version !== 1 || manifest.source !== 's1') {
          throw new CliError({ message: 'another download', code: 'INVALID_ARGUMENT' });
        }

        return manifest;
      }
    });
  }

  function readManifestFile(): string {
    return readFileSync(join(dir, MANIFEST_FILE), 'utf8');
  }

  it('reads a missing file as the empty manifest', async () => {
    const store = makeStore();
    expect(store.path).toBe(join(dir, MANIFEST_FILE));
    expect(await store.read()).toEqual({ version: 1, source: 's1', files: {} });
  });

  it('saves as indented JSON with a trailing newline, mode 0600, and reads it back', async () => {
    const store = makeStore();
    const manifest: TestManifest = { version: 1, source: 's1', files: { a: 'a.txt' } };
    await store.save(manifest);

    expect(readManifestFile()).toBe(JSON.stringify(manifest, null, 2) + '\n');
    expect(statSync(store.path).mode & 0o777).toBe(0o600);
    expect(await store.read()).toEqual(manifest);
    expect(readdirSync(dir)).toEqual([MANIFEST_FILE]);
  });

  it('refuses a manifest that accept() rejects', async () => {
    writeFileSync(join(dir, MANIFEST_FILE), JSON.stringify({ version: 1, source: 'other', files: {} }));
    await expect(makeStore().read()).rejects.toThrow('another download');
  });

  it('refuses a file that is not JSON with INVALID_ARGUMENT', async () => {
    writeFileSync(join(dir, MANIFEST_FILE), '{ not json');
    const error = await makeStore()
      .read()
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).code).toBe('INVALID_ARGUMENT');
  });

  it('saveSoon() coalesces writes into one after the debounce', async () => {
    vi.useFakeTimers();
    const store = makeStore(1000);

    store.saveSoon({ version: 1, source: 's1', files: { a: '1' } });
    store.saveSoon({ version: 1, source: 's1', files: { a: '2' } });
    await vi.advanceTimersByTimeAsync(500);
    store.saveSoon({ version: 1, source: 's1', files: { a: '3' } });

    // nothing is written before the debounce
    expect(existsSync(store.path)).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    vi.useRealTimers();
    await store.flush();

    expect(JSON.parse(readManifestFile()).files).toEqual({ a: '3' });
  });

  it('flush() writes the last pending state at once', async () => {
    const store = makeStore(60_000);
    store.saveSoon({ version: 1, source: 's1', files: { a: '1' } });
    store.saveSoon({ version: 1, source: 's1', files: { a: '2' } });

    await store.flush();

    expect(JSON.parse(readManifestFile()).files).toEqual({ a: '2' });
  });

  it('save() drops a pending saveSoon() write', async () => {
    vi.useFakeTimers();
    const store = makeStore(1000);
    store.saveSoon({ version: 1, source: 's1', files: { a: 'stale' } });
    await store.save({ version: 1, source: 's1', files: { a: 'fresh' } });
    await vi.advanceTimersByTimeAsync(2000);
    vi.useRealTimers();
    await store.flush();

    expect(JSON.parse(readManifestFile()).files).toEqual({ a: 'fresh' });
  });
});

describe('addCliDownloadCounts()', () => {
  it('adds the given fields', () => {
    expect(addCliDownloadCounts(emptyCliDownloadCounts(), { written: 2, bytes: 10 })).toEqual({ written: 2, skipped: 0, removed: 0, failed: 0, bytes: 10 });
  });
});
