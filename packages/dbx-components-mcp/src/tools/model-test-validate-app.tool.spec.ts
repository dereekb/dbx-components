/**
 * Spec for the `dbx_model_test_validate_app` tool wrapper.
 *
 * Spins up a temp workspace mirroring the component + API layout the
 * validator expects, points the tool at it via `process.chdir`, and
 * verifies the markdown / JSON output, the `strict` toggle, and the
 * cwd-bound path check.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MODEL_TEST_VALIDATE_APP_TOOL } from './model-test-validate-app.tool.js';

const COMPONENT_REL = 'components/fake-firebase';
const API_REL = 'apps/fake-api';

interface Workspace {
  readonly root: string;
  readonly originalCwd: string;
}

const PROFILE_TS = `import { firestoreModelIdentity } from '@dereekb/firebase';\nexport const profileIdentity = firestoreModelIdentity('profile', 'p');\n`;
const WORKER_TS = `import { firestoreModelIdentity } from '@dereekb/firebase';\nexport const workerIdentity = firestoreModelIdentity('worker', 'w');\n`;

async function makeWorkspace(): Promise<Workspace> {
  const root = await mkdtemp(join(tmpdir(), 'dbx-model-test-validate-app-'));
  const profileFolder = join(root, COMPONENT_REL, 'src', 'lib', 'model', 'profile');
  const workerFolder = join(root, COMPONENT_REL, 'src', 'lib', 'model', 'worker');
  await mkdir(profileFolder, { recursive: true });
  await mkdir(workerFolder, { recursive: true });
  await writeFile(join(profileFolder, 'profile.ts'), PROFILE_TS, 'utf8');
  await writeFile(join(workerFolder, 'worker.ts'), WORKER_TS, 'utf8');

  const fnDir = join(root, API_REL, 'src', 'app', 'function');
  await mkdir(join(fnDir, 'profile'), { recursive: true });
  await mkdir(join(fnDir, 'worker'), { recursive: true });
  // Profile has its CRUD spec (clean). Worker has only a drift file (no `crud`/`scenario` segment).
  await writeFile(join(fnDir, 'profile', 'profile.crud.spec.ts'), '// ok\n', 'utf8');
  await writeFile(join(fnDir, 'worker', 'worker.system.spec.ts'), '// drift\n', 'utf8');

  const originalCwd = process.cwd();
  process.chdir(root);
  return { root, originalCwd };
}

describe('dbx_model_test_validate_app', () => {
  let workspace: Workspace;

  beforeEach(async () => {
    workspace = await makeWorkspace();
  });

  afterEach(async () => {
    process.chdir(workspace.originalCwd);
    await rm(workspace.root, { recursive: true, force: true });
  });

  it('rejects an invalid arg payload', async () => {
    const result = await MODEL_TEST_VALIDATE_APP_TOOL.run({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('rejects a path that escapes the server cwd', async () => {
    const result = await MODEL_TEST_VALIDATE_APP_TOOL.run({ componentDir: '../escape', apiDir: API_REL });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('outside the server cwd');
  });

  it('emits warnings (not errors) for filename drift + missing coverage by default', async () => {
    const result = await MODEL_TEST_VALIDATE_APP_TOOL.run({ componentDir: COMPONENT_REL, apiDir: API_REL });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('PASS WITH WARNINGS');
    expect(text).toContain('TEST_FILE_MISSING_BUCKET');
    expect(text).toContain('MODEL_GROUP_MISSING_CRUD_SPEC');
    expect(text).toContain('worker.system.spec.ts');
    expect(text).toContain('worker.crud.spec.ts');
  });

  it('upgrades violations to errors and sets isError when strict is true', async () => {
    const result = await MODEL_TEST_VALIDATE_APP_TOOL.run({ componentDir: COMPONENT_REL, apiDir: API_REL, strict: true });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('FAIL');
  });

  it('returns parseable JSON when format=json', async () => {
    const result = await MODEL_TEST_VALIDATE_APP_TOOL.run({ componentDir: COMPONENT_REL, apiDir: API_REL, format: 'json' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.componentDir).toBe(COMPONENT_REL);
    expect(parsed.apiDir).toBe(API_REL);
    expect(parsed.specFilesChecked).toBe(2);
    expect(parsed.modelGroupsChecked).toBe(2);
    const codes = parsed.violations.map((v: { code: string }) => v.code);
    expect(codes).toContain('TEST_FILE_MISSING_BUCKET');
    expect(codes).toContain('MODEL_GROUP_MISSING_CRUD_SPEC');
  });
});
