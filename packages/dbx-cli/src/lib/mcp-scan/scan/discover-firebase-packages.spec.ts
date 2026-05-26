import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverDownstreamFirebasePackages, resolveExplicitFirebasePackages } from './discover-firebase-packages.js';

describe('discoverDownstreamFirebasePackages', () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'dbx-firebase-discover-'));
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('returns packages whose model dir exists', async () => {
    await scaffoldComponent(workspaceRoot, 'demo-firebase', 'demo-firebase');
    await scaffoldComponent(workspaceRoot, 'advisorey-firebase', 'advisorey-firebase');
    const packages = await discoverDownstreamFirebasePackages(workspaceRoot);
    expect(packages).toHaveLength(2);
    expect(packages.map((p) => p.packageName)).toEqual(['advisorey-firebase', 'demo-firebase']);
    expect(packages[0].componentDir).toBe('components/advisorey-firebase');
    expect(packages[0].modelDir).toBe('components/advisorey-firebase/src/lib/model');
  });

  it('skips dirs without src/lib/model', async () => {
    await mkdir(join(workspaceRoot, 'components/empty-firebase'), { recursive: true });
    await scaffoldComponent(workspaceRoot, 'has-firebase', 'has-firebase');
    const packages = await discoverDownstreamFirebasePackages(workspaceRoot);
    expect(packages.map((p) => p.componentDir)).toEqual(['components/has-firebase']);
  });

  it('falls back to dir basename when package.json is missing or unreadable', async () => {
    const dir = join(workspaceRoot, 'components/no-pkg-firebase');
    await mkdir(join(dir, 'src/lib/model'), { recursive: true });
    const packages = await discoverDownstreamFirebasePackages(workspaceRoot);
    expect(packages).toHaveLength(1);
    expect(packages[0].packageName).toBe('no-pkg-firebase');
  });

  it('falls back to dir basename when package.json is malformed', async () => {
    const dir = join(workspaceRoot, 'components/bad-pkg-firebase');
    await mkdir(join(dir, 'src/lib/model'), { recursive: true });
    await writeFile(join(dir, 'package.json'), 'not-json{', 'utf8');
    const packages = await discoverDownstreamFirebasePackages(workspaceRoot);
    expect(packages).toHaveLength(1);
    expect(packages[0].packageName).toBe('bad-pkg-firebase');
  });

  it('returns an empty array when no components/*-firebase exist', async () => {
    const packages = await discoverDownstreamFirebasePackages(workspaceRoot);
    expect(packages).toEqual([]);
  });
});

describe('resolveExplicitFirebasePackages', () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'dbx-firebase-explicit-'));
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('resolves explicit dirs anywhere in the workspace', async () => {
    await mkdir(join(workspaceRoot, 'libs/custom-firebase/src/lib/model'), { recursive: true });
    await writeFile(join(workspaceRoot, 'libs/custom-firebase/package.json'), JSON.stringify({ name: '@org/custom-firebase' }), 'utf8');
    const packages = await resolveExplicitFirebasePackages(workspaceRoot, ['libs/custom-firebase']);
    expect(packages).toHaveLength(1);
    expect(packages[0].packageName).toBe('@org/custom-firebase');
    expect(packages[0].componentDir).toBe('libs/custom-firebase');
  });

  it('drops entries without a model dir', async () => {
    await mkdir(join(workspaceRoot, 'libs/no-model-firebase'), { recursive: true });
    const packages = await resolveExplicitFirebasePackages(workspaceRoot, ['libs/no-model-firebase']);
    expect(packages).toEqual([]);
  });

  it('dedupes and ignores empty/trailing-slash variants', async () => {
    await mkdir(join(workspaceRoot, 'libs/dup-firebase/src/lib/model'), { recursive: true });
    const packages = await resolveExplicitFirebasePackages(workspaceRoot, ['libs/dup-firebase', 'libs/dup-firebase/', '']);
    expect(packages).toHaveLength(1);
  });
});

async function scaffoldComponent(workspaceRoot: string, dirName: string, packageName: string): Promise<void> {
  const dir = join(workspaceRoot, 'components', dirName);
  await mkdir(join(dir, 'src/lib/model'), { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: packageName }), 'utf8');
}
