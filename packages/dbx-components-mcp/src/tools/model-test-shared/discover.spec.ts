/**
 * Spec for `discoverSpecFilesByGroup`.
 *
 * Writes a synthetic API-app skeleton into a temp dir and verifies the
 * walker groups spec files by parent folder, classifies them against the
 * naming convention, and skips folders without spec files.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverSpecFilesByGroup } from './discover.js';

interface Workspace {
  readonly root: string;
  readonly apiAbs: string;
}

async function makeWorkspace(): Promise<Workspace> {
  const root = await mkdtemp(join(tmpdir(), 'dbx-model-test-discover-'));
  const apiAbs = join(root, 'apps', 'fake-api');
  await mkdir(join(apiAbs, 'src', 'app', 'function', 'job'), { recursive: true });
  await mkdir(join(apiAbs, 'src', 'app', 'function', 'worker'), { recursive: true });
  await mkdir(join(apiAbs, 'src', 'app', 'function', 'empty'), { recursive: true });
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'job', 'job.crud.spec.ts'), '// ok\n', 'utf8');
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'job', 'job.scenario.requirement.spec.ts'), '// ok\n', 'utf8');
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'worker', 'worker.crud.spec.ts'), '// ok\n', 'utf8');
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'worker', 'worker.payroll.scenario.spec.ts'), '// ok\n', 'utf8');
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'worker', 'worker.system.spec.ts'), '// ok\n', 'utf8');
  return { root, apiAbs };
}

describe('discoverSpecFilesByGroup', () => {
  let workspace: Workspace;

  beforeEach(async () => {
    workspace = await makeWorkspace();
  });

  afterEach(async () => {
    await rm(workspace.root, { recursive: true, force: true });
  });

  it('groups spec files by parent folder and skips empty folders', async () => {
    const catalog = await discoverSpecFilesByGroup({ apiAbs: workspace.apiAbs, apiRel: 'apps/fake-api' });
    expect(catalog.apiRel).toBe('apps/fake-api');
    expect(catalog.functionDirRel).toBe('apps/fake-api/src/app/function');
    expect(catalog.groups.map((g) => g.group)).toEqual(['job', 'worker']);
    expect(catalog.totalSpecFiles).toBe(5);
    expect(catalog.totalDriftFiles).toBe(2);
  });

  it('classifies each spec file with the canonical convention', async () => {
    const catalog = await discoverSpecFilesByGroup({ apiAbs: workspace.apiAbs, apiRel: 'apps/fake-api' });
    const worker = catalog.groups.find((g) => g.group === 'worker');
    expect(worker).toBeDefined();
    const filenames = worker!.files.map((f) => `${f.filename}:${f.classification.kind}`);
    expect(filenames).toEqual(['worker.crud.spec.ts:crud', 'worker.payroll.scenario.spec.ts:scenario-misplaced', 'worker.system.spec.ts:no-bucket']);
  });

  it('returns an empty catalog when the function dir is missing', async () => {
    const catalog = await discoverSpecFilesByGroup({ apiAbs: join(workspace.root, 'no-such-app'), apiRel: 'apps/no-such-app' });
    expect(catalog.groups).toEqual([]);
    expect(catalog.totalSpecFiles).toBe(0);
  });
});
