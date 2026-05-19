/**
 * Spec for the `dbx_model_test_list_app` tool wrapper.
 *
 * Spins up a temp workspace with a synthetic API app, points the tool at it
 * via `process.chdir`, and verifies the markdown / JSON output, the group
 * filter, and the cwd-bound path check.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MODEL_TEST_LIST_APP_TOOL } from './model-test-list-app.tool.js';

const API_REL = 'apps/fake-api';

interface Workspace {
  readonly root: string;
  readonly originalCwd: string;
}

async function makeWorkspace(): Promise<Workspace> {
  const root = await mkdtemp(join(tmpdir(), 'dbx-model-test-list-app-'));
  const apiAbs = join(root, API_REL);
  await mkdir(join(apiAbs, 'src', 'app', 'function', 'job'), { recursive: true });
  await mkdir(join(apiAbs, 'src', 'app', 'function', 'worker'), { recursive: true });
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'job', 'job.crud.spec.ts'), '// ok\n', 'utf8');
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'job', 'job.scenario.requirement.spec.ts'), '// ok\n', 'utf8');
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'worker', 'worker.crud.spec.ts'), '// ok\n', 'utf8');
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'worker', 'worker.payroll.scenario.spec.ts'), '// ok\n', 'utf8');
  const originalCwd = process.cwd();
  process.chdir(root);
  return { root, originalCwd };
}

describe('dbx_model_test_list_app', () => {
  let workspace: Workspace;

  beforeEach(async () => {
    workspace = await makeWorkspace();
  });

  afterEach(async () => {
    process.chdir(workspace.originalCwd);
    await rm(workspace.root, { recursive: true, force: true });
  });

  it('rejects an invalid arg payload', async () => {
    const result = await MODEL_TEST_LIST_APP_TOOL.run({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('rejects a path that escapes the server cwd', async () => {
    const result = await MODEL_TEST_LIST_APP_TOOL.run({ apiDir: '../escape' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('outside the server cwd');
  });

  it('lists every group with kind labels and the where-to-add block', async () => {
    const result = await MODEL_TEST_LIST_APP_TOOL.run({ apiDir: API_REL });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('# Model-test spec files — apps/fake-api');
    expect(text).toContain('## job');
    expect(text).toContain('## worker');
    expect(text).toContain('Where to add a new test for `job`');
    expect(text).toContain('apps/fake-api/src/app/function/worker/worker.scenario.spec.ts');
    expect(text).toContain('## Drift (1)');
    expect(text).toContain('worker.scenario.payroll.spec.ts');
  });

  it('honours the group filter', async () => {
    const result = await MODEL_TEST_LIST_APP_TOOL.run({ apiDir: API_REL, group: 'job' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('## job');
    expect(text).not.toContain('## worker');
  });

  it('returns parseable JSON when format=json', async () => {
    const result = await MODEL_TEST_LIST_APP_TOOL.run({ apiDir: API_REL, format: 'json' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.apiRel).toBe(API_REL);
    expect(parsed.totalSpecFiles).toBe(4);
    expect(parsed.totalDriftFiles).toBe(1);
    const worker = parsed.groups.find((g: { group: string }) => g.group === 'worker');
    expect(worker.recommendations).toHaveLength(2);
    const drift = worker.files.find((f: { filename: string }) => f.filename === 'worker.payroll.scenario.spec.ts');
    expect(drift.kind).toBe('scenario-misplaced');
    expect(drift.recommendedRename).toBe('worker.scenario.payroll.spec.ts');
  });

  it('reports an empty result for an app with no function tests', async () => {
    const emptyApi = 'apps/empty-api';
    await mkdir(join(workspace.root, emptyApi), { recursive: true });
    const result = await MODEL_TEST_LIST_APP_TOOL.run({ apiDir: emptyApi });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('No spec files discovered');
  });
});
