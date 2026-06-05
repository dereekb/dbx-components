/**
 * Spec for the `dbx_model_test_hotspots` tool wrapper.
 *
 * Spins up a temp workspace with a synthetic API app (a `Job` + sub
 * `JobFeedback` fixture and two job specs), points the tool at it via
 * `process.chdir`, and verifies arg validation, the cwd-bound path check, and
 * the markdown / JSON output.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MODEL_TEST_HOTSPOTS_TOOL } from './model-test-hotspots.tool.js';

const API_REL = 'apps/fake-api';

const FIXTURE_TS = `
import { FirebaseAdminFunctionTestContextInstance, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestContextInstance, FirebaseAdminTestContextInstance, modelTestContextFactory, ModelTestContextFixture, ModelTestContextInstance } from '@dereekb/firebase-server/test';
import { TestContextFixture } from '@dereekb/util/test';
export class FakeApiContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextFixture<F, TestContextFixture<F>, FakeApiContextFixtureInstance<F>> {}
export class FakeApiContextFixtureInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextInstance<F> {}
export class FakeApiFunctionContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends FakeApiContextFixture<F> {}
export class FakeApiFunctionContextFixtureInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends FakeApiContextFixtureInstance<F> {}

export type FakeApiJobTestContextParams = Partial<Job>;
export class FakeApiJobTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Job, JobDocument, FakeApiFunctionContextFixtureInstance<F>, FakeApiFunctionContextFixture<F>, FakeApiJobTestContextInstance<F>> {}
export class FakeApiJobTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Job, JobDocument, FakeApiFunctionContextFixtureInstance<F>> {}
export const fakeApiJobContextFactory = () =>
  modelTestContextFactory<Job, JobDocument, FakeApiJobTestContextParams, FakeApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, FakeApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, FakeApiJobTestContextInstance<FirebaseAdminFunctionTestContextInstance>, FakeApiJobTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
    makeFixture: (f) => new FakeApiJobTestContextFixture(f),
    getCollection: (fi) => fi.fakeFirestoreCollections.jobCollection,
    makeInstance: (delegate, ref, testInstance) => new FakeApiJobTestContextInstance(delegate, ref, testInstance)
  });
export const fakeApiJobContext = fakeApiJobContextFactory();

export interface FakeApiJobFeedbackTestContextParams extends Partial<JobFeedback> {
  job: FakeApiJobTestContextFixture;
}
export class FakeApiJobFeedbackTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<JobFeedback, JobFeedbackDocument, FakeApiFunctionContextFixtureInstance<F>, FakeApiFunctionContextFixture<F>, FakeApiJobFeedbackTestContextInstance<F>> {}
export class FakeApiJobFeedbackTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<JobFeedback, JobFeedbackDocument, FakeApiFunctionContextFixtureInstance<F>> {}
export const fakeApiJobFeedbackContextFactory = () =>
  modelTestContextFactory<JobFeedback, JobFeedbackDocument, FakeApiJobFeedbackTestContextParams, FakeApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, FakeApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, FakeApiJobFeedbackTestContextInstance<FirebaseAdminFunctionTestContextInstance>, FakeApiJobFeedbackTestContextFixture<FirebaseAdminFunctionTestContextInstance>, JobFeedbackFirestoreCollection>({
    makeFixture: (f) => new FakeApiJobFeedbackTestContextFixture(f),
    getCollection: (fi, params) => fi.fakeFirestoreCollections.jobFeedbackCollectionFactory(params.job.document),
    collectionForDocument: (fi, doc) => fi.fakeFirestoreCollections.jobFeedbackCollectionFactory(doc.parent),
    makeInstance: (delegate, ref, testInstance) => new FakeApiJobFeedbackTestContextInstance(delegate, ref, testInstance)
  });
export const fakeApiJobFeedbackContext = fakeApiJobFeedbackContextFactory();
`;

const JOB_SCENARIO_SPEC = `import { fakeApiFunctionContextFactory, fakeApiJobContext, fakeApiJobFeedbackContext } from '../../../test/fixture';
fakeApiFunctionContextFactory((f) => {
  describe('feedback flow', () => {
    fakeApiJobContext({ f }, (job) => {
      fakeApiJobFeedbackContext({ f, job }, (fb) => {
        it('records worker feedback', () => {});
      });
    });
  });
});
`;

const JOB_CRUD_SPEC = `import { fakeApiFunctionContextFactory, fakeApiJobContext } from '../../../test/fixture';
fakeApiFunctionContextFactory((f) => {
  fakeApiJobContext({ f }, (job) => {
    it('creates a job', () => {});
  });
});
`;

interface Workspace {
  readonly root: string;
  readonly originalCwd: string;
}

async function makeWorkspace(): Promise<Workspace> {
  const root = await mkdtemp(join(tmpdir(), 'dbx-model-test-hotspots-tool-'));
  const apiAbs = join(root, API_REL);
  await mkdir(join(apiAbs, 'src', 'test'), { recursive: true });
  await mkdir(join(apiAbs, 'src', 'app', 'function', 'job'), { recursive: true });
  await writeFile(join(apiAbs, 'src', 'test', 'fixture.ts'), FIXTURE_TS, 'utf8');
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'job', 'job.scenario.spec.ts'), JOB_SCENARIO_SPEC, 'utf8');
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'job', 'job.crud.spec.ts'), JOB_CRUD_SPEC, 'utf8');
  const originalCwd = process.cwd();
  process.chdir(root);
  return { root, originalCwd };
}

describe('dbx_model_test_hotspots', () => {
  let workspace: Workspace;

  beforeEach(async () => {
    workspace = await makeWorkspace();
  });

  afterEach(async () => {
    process.chdir(workspace.originalCwd);
    await rm(workspace.root, { recursive: true, force: true });
  });

  it('rejects an invalid arg payload', async () => {
    const result = await MODEL_TEST_HOTSPOTS_TOOL.run({ apiDir: API_REL });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('rejects a path that escapes the server cwd', async () => {
    const result = await MODEL_TEST_HOTSPOTS_TOOL.run({ apiDir: '../escape', model: 'JobFeedback' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('outside the server cwd');
  });

  it('surfaces the parent group crud/scenario hotspots for a sub-model', async () => {
    const result = await MODEL_TEST_HOTSPOTS_TOOL.run({ apiDir: API_REL, model: 'JobFeedback' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('Model-test hotspots — `JobFeedback`');
    expect(text).toContain('job/job.scenario.spec.ts');
    expect(text).toContain('job/job.crud.spec.ts');
  });

  it('returns parseable JSON when format=json', async () => {
    const result = await MODEL_TEST_HOTSPOTS_TOOL.run({ apiDir: API_REL, model: 'JobFeedback', format: 'json' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.model).toBe('JobFeedback');
    expect(parsed.parentModels).toContain('Job');
    expect(parsed.hotspots).toHaveLength(2);
  });

  it('suggests default files when no spec references the model', async () => {
    const result = await MODEL_TEST_HOTSPOTS_TOOL.run({ apiDir: API_REL, model: 'Nonexistent', format: 'json' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.hotspots).toEqual([]);
    expect(parsed.suggestedFiles).toContain(`${API_REL}/src/app/function/nonexistent/nonexistent.crud.spec.ts`);
  });
});
