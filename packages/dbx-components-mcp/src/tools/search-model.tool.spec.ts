import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { clearDownstreamCatalogCache } from '../registry/downstream-models-runtime.js';
import { runSearchModel } from './search-model.tool.js';

const REPO_ROOT = resolve(__dirname, '../../../..');

async function firstText(promise: ReturnType<typeof runSearchModel>): Promise<string> {
  const result = await promise;
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_model_search', () => {
  beforeAll(() => {
    clearDownstreamCatalogCache();
    process.chdir(REPO_ROOT);
  });

  afterAll(() => {
    clearDownstreamCatalogCache();
  });

  it('rejects missing query via arktype', async () => {
    const result = await runSearchModel({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Invalid arguments/);
  });

  it('returns Firebase models for a model-name query', async () => {
    const text = await firstText(runSearchModel({ query: 'StorageFile', scope: 'upstream' }));
    expect(text).toMatch(/# Search: `StorageFile`/);
    expect(text).toMatch(/StorageFile.*firebase model/);
    expect(text).toMatch(/\*\*identity:\*\* `storageFileIdentity`/);
    expect(text).toMatch(/\*\*package:\*\* `@dereekb\/firebase`/);
    expect(text).toMatch(/Sources scanned: upstream only/);
  });

  it('ranks collection prefix matches', async () => {
    const text = await firstText(runSearchModel({ query: 'nb', scope: 'upstream' }));
    expect(text).toMatch(/NotificationBox.*firebase model/);
  });

  it('matches enum-name substrings', async () => {
    const text = await firstText(runSearchModel({ query: 'StorageFileGroup', scope: 'upstream' }));
    expect(text).toMatch(/firebase model/);
  });

  it('respects the limit cap', async () => {
    const text = await firstText(runSearchModel({ query: 'firestore', limit: 2, scope: 'upstream' }));
    const resultSections = text.match(/## `[^`]+`/g) ?? [];
    expect(resultSections.length).toBeLessThanOrEqual(2);
  });

  it('returns a friendly message when nothing matches', async () => {
    const text = await firstText(runSearchModel({ query: 'zzzz-nothing-here', scope: 'upstream' }));
    expect(text).toMatch(/No Firebase models matched/);
  });

  it('returns downstream-only hits when scope=downstream', async () => {
    const text = await firstText(runSearchModel({ query: 'guestbook', scope: 'downstream' }));
    expect(text).toMatch(/Guestbook.*firebase model/);
    expect(text).toMatch(/\*\*package:\*\* `demo-firebase`/);
    expect(text).toMatch(/Sources scanned: \d+ downstream package/);
    expect(text).not.toMatch(/`@dereekb\/firebase`/);
  });

  it('merges upstream + downstream when scope=all (default)', async () => {
    const text = await firstText(runSearchModel({ query: 'guestbook' }));
    expect(text).toMatch(/Guestbook.*firebase model/);
    expect(text).toMatch(/\*\*package:\*\* `demo-firebase`/);
    expect(text).toMatch(/Sources scanned: upstream/);
  });

  it('honours an explicit componentDirs override', async () => {
    const text = await firstText(runSearchModel({ query: 'guestbook', scope: 'downstream', componentDirs: ['components/demo-firebase'] }));
    expect(text).toMatch(/Guestbook/);
    expect(text).toMatch(/Sources scanned: 1 downstream package\./);
  });

  describe('with no downstream packages discoverable', () => {
    let tempRoot: string;
    let originalCwd: string;

    beforeAll(async () => {
      originalCwd = process.cwd();
      tempRoot = await mkdtemp(join(tmpdir(), 'dbx-search-empty-'));
      process.chdir(tempRoot);
      clearDownstreamCatalogCache();
    });

    afterAll(async () => {
      process.chdir(originalCwd);
      await rm(tempRoot, { recursive: true, force: true });
      clearDownstreamCatalogCache();
    });

    it('emits the no-discoverable hint when scope is all and zero hits', async () => {
      const text = await firstText(runSearchModel({ query: 'zzzz-not-a-real-thing' }));
      expect(text).toMatch(/No Firebase models matched/);
      expect(text).toMatch(/No downstream packages discovered under `components\/\*-firebase`/);
    });
  });

  afterEach(() => {
    clearDownstreamCatalogCache();
  });
});
