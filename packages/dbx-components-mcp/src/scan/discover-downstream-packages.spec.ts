import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverDownstreamPackages, packageNameToSlug } from './discover-downstream-packages.js';

describe('discoverDownstreamPackages', () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'dbx-discover-downstream-'));
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('returns an empty array when no packages exist', async () => {
    const packages = await discoverDownstreamPackages({ workspaceRoot });
    expect(packages).toEqual([]);
  });

  it('discovers components/*-firebase|shared|web|core', async () => {
    await scaffoldPackage({ workspaceRoot, relDir: 'components/demo-firebase', packageName: 'demo-firebase', files: { 'foo.component.ts': 'export class FooComponent {}' } });
    await scaffoldPackage({ workspaceRoot, relDir: 'components/demo-shared', packageName: 'demo-shared', files: { 'foo.pipe.ts': 'export class FooPipe {}' } });
    await scaffoldPackage({ workspaceRoot, relDir: 'components/demo-web', packageName: '@demo/demo-web', files: { 'foo.directive.ts': 'export class FooDirective {}' } });
    await scaffoldPackage({ workspaceRoot, relDir: 'components/demo-core', packageName: 'demo-core', files: {} });
    const packages = await discoverDownstreamPackages({ workspaceRoot });
    expect(packages.map((p) => p.relDir).sort((a, b) => a.localeCompare(b))).toEqual(['components/demo-core', 'components/demo-firebase', 'components/demo-shared', 'components/demo-web']);
  });

  it('skips apps/* without dbx-mcp.scan.json', async () => {
    await scaffoldPackage({ workspaceRoot, relDir: 'apps/demo-api', packageName: 'demo-api', files: { 'foo.component.ts': 'export class FooComponent {}' } });
    const packages = await discoverDownstreamPackages({ workspaceRoot });
    expect(packages).toEqual([]);
  });

  it('includes apps/* when dbx-mcp.scan.json is present', async () => {
    await scaffoldPackage({ workspaceRoot, relDir: 'apps/demo-api', packageName: 'demo-api', files: { 'foo.component.ts': 'export class FooComponent {}' } });
    await writeFile(join(workspaceRoot, 'apps/demo-api/dbx-mcp.scan.json'), JSON.stringify({ version: 1, uiComponents: { include: ['src/**/*.ts'] } }), 'utf8');
    const packages = await discoverDownstreamPackages({ workspaceRoot });
    expect(packages).toHaveLength(1);
    expect(packages[0].relDir).toBe('apps/demo-api');
    expect(packages[0].hasScanConfig).toBe(true);
    expect(packages[0].declaredScanClusters).toEqual(['uiComponents']);
  });

  it('detects candidate clusters via file-suffix heuristics', async () => {
    await scaffoldPackage({
      workspaceRoot,
      relDir: 'components/demo-shared',
      packageName: 'demo-shared',
      files: {
        'foo.component.ts': 'export class FooComponent {}',
        'bar.directive.ts': 'export class BarDirective {}',
        'baz.pipe.ts': 'export class BazPipe {}',
        'qux.field.ts': 'export const quxField = () => ({});',
        'quux.filter.ts': 'export class QuuxFilter {}',
        'random.ts': 'export const x = 1;'
      }
    });
    const packages = await discoverDownstreamPackages({ workspaceRoot });
    expect(packages).toHaveLength(1);
    expect([...packages[0].candidateClusters].sort((a, b) => a.localeCompare(b))).toEqual(['actions', 'filters', 'forgeFields', 'pipes', 'uiComponents']);
  });

  it('ignores .spec.ts in heuristics', async () => {
    await scaffoldPackage({
      workspaceRoot,
      relDir: 'components/demo-shared',
      packageName: 'demo-shared',
      files: { 'foo.component.spec.ts': 'export class FooComponent {}' }
    });
    const packages = await discoverDownstreamPackages({ workspaceRoot });
    expect(packages[0].candidateClusters).toEqual([]);
  });

  it('falls back to dir basename when package.json is missing', async () => {
    await mkdir(join(workspaceRoot, 'components/no-pkg-firebase/src'), { recursive: true });
    const packages = await discoverDownstreamPackages({ workspaceRoot });
    expect(packages).toHaveLength(1);
    expect(packages[0].packageName).toBe('no-pkg-firebase');
    expect(packages[0].slug).toBe('no-pkg-firebase');
  });

  it('treats explicitDirs as the only candidates when supplied', async () => {
    await scaffoldPackage({ workspaceRoot, relDir: 'components/demo-firebase', packageName: 'demo-firebase', files: { 'foo.component.ts': '' } });
    await scaffoldPackage({ workspaceRoot, relDir: 'libs/custom-lib', packageName: 'custom-lib', files: { 'foo.pipe.ts': '' } });
    const packages = await discoverDownstreamPackages({ workspaceRoot, explicitDirs: ['libs/custom-lib'] });
    expect(packages.map((p) => p.relDir)).toEqual(['libs/custom-lib']);
    expect(packages[0].candidateClusters).toEqual(['pipes']);
  });

  it('merges declaredScanClusters with heuristic candidates', async () => {
    await scaffoldPackage({ workspaceRoot, relDir: 'components/demo-shared', packageName: 'demo-shared', files: { 'foo.pipe.ts': '' } });
    await writeFile(join(workspaceRoot, 'components/demo-shared/dbx-mcp.scan.json'), JSON.stringify({ version: 1, source: 'demo', topicNamespace: 'demo', include: ['src/**/*.ts'], actions: { include: ['src/**/*.ts'] } }), 'utf8');
    const packages = await discoverDownstreamPackages({ workspaceRoot });
    expect([...packages[0].candidateClusters].sort((a, b) => a.localeCompare(b))).toEqual(['actions', 'pipes', 'semanticTypes']);
    expect([...packages[0].declaredScanClusters].sort((a, b) => a.localeCompare(b))).toEqual(['actions', 'semanticTypes']);
  });
});

describe('packageNameToSlug', () => {
  it('strips @scope/ and lowercases', () => {
    expect(packageNameToSlug('@dereekb/dbx-form')).toBe('dereekb-dbx-form');
    expect(packageNameToSlug('demo-firebase')).toBe('demo-firebase');
    expect(packageNameToSlug('@org/Pkg.Name')).toBe('org-pkg-name');
  });
});

interface ScaffoldInput {
  readonly workspaceRoot: string;
  readonly relDir: string;
  readonly packageName: string;
  readonly files: Record<string, string>;
}

async function scaffoldPackage(input: ScaffoldInput): Promise<void> {
  const dir = join(input.workspaceRoot, input.relDir);
  await mkdir(join(dir, 'src/lib'), { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: input.packageName }), 'utf8');
  for (const [filename, content] of Object.entries(input.files)) {
    await writeFile(join(dir, 'src/lib', filename), content, 'utf8');
  }
}
