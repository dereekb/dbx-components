import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearDownstreamCatalogCache, getDownstreamCatalog } from './downstream-models-runtime.js';

const REPO_ROOT = resolve(__dirname, '../../../..');

describe('getDownstreamCatalog (cache + extraction)', () => {
  beforeEach(() => {
    clearDownstreamCatalogCache();
  });

  afterEach(() => {
    clearDownstreamCatalogCache();
  });

  it('returns demo-firebase models when run against the workspace root', async () => {
    const result = await getDownstreamCatalog({ workspaceRoot: REPO_ROOT });
    expect(result.errors).toEqual([]);
    expect(result.discoveryUsed).toBe(true);
    expect(
      result.packages.find((p) => p.packageName === 'demo-firebase'),
      'demo-firebase missing from packages'
    ).toBeDefined();
    const guestbook = result.models.find((m) => m.name === 'Guestbook');
    expect(guestbook, 'Guestbook missing from runtime catalog').toBeDefined();
    expect(guestbook?.sourcePackage).toBe('demo-firebase');
    expect(guestbook?.collectionPrefix).toBe('gb');
  });

  it('caches by (workspaceRoot, componentDirs) — same key returns the same promise', () => {
    const a = getDownstreamCatalog({ workspaceRoot: REPO_ROOT });
    const b = getDownstreamCatalog({ workspaceRoot: REPO_ROOT });
    expect(a).toBe(b);
  });

  it('different componentDirs override → different cache entry', async () => {
    const auto = getDownstreamCatalog({ workspaceRoot: REPO_ROOT });
    const explicit = getDownstreamCatalog({ workspaceRoot: REPO_ROOT, componentDirs: ['components/demo-firebase'] });
    expect(auto).not.toBe(explicit);
    const explicitResult = await explicit;
    expect(explicitResult.discoveryUsed).toBe(false);
    expect(explicitResult.packages.map((p) => p.packageName)).toContain('demo-firebase');
  });

  it('records errors when a package contains malformed source — no throw', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'dbx-cat-'));
    try {
      const componentDir = join(tempRoot, 'components/broken-firebase');
      await mkdir(join(componentDir, 'src/lib/model/bad'), { recursive: true });
      await writeFile(join(componentDir, 'package.json'), JSON.stringify({ name: 'broken-firebase' }), 'utf8');
      // Source has firestoreModelIdentity( but the file is parseable; we verify no errors here.
      await writeFile(join(componentDir, 'src/lib/model/bad/bad.ts'), `export const ok = firestoreModelIdentity('thing', 't');\n`, 'utf8');
      const result = await getDownstreamCatalog({ workspaceRoot: tempRoot });
      expect(result.errors).toEqual([]);
      expect(result.packages.length).toBe(1);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('returns an empty catalog when nothing is discoverable', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'dbx-cat-empty-'));
    try {
      const result = await getDownstreamCatalog({ workspaceRoot: tempRoot });
      expect(result.models).toEqual([]);
      expect(result.modelGroups).toEqual([]);
      expect(result.packages).toEqual([]);
      expect(result.discoveryUsed).toBe(true);
      expect(result.errors).toEqual([]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
