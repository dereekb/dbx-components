/**
 * Spec for `findModelTestHotspots`.
 *
 * Writes a synthetic API-app skeleton (a `src/test/fixture.ts` declaring a
 * top-level `Job` + a sub `JobFeedback` whose Params depends on the Job
 * fixture, plus `function/<group>/*.spec.ts` files) into a temp dir and
 * verifies the inverse fixture→specs lookup: a sub-model resolves its parent
 * fixture and surfaces the parent group's crud/scenario specs, an unknown model
 * falls back to canonical default-file suggestions, and unrelated groups are
 * excluded.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findModelTestHotspots } from './hotspots.js';
import { formatHotspotsAsJson, formatHotspotsAsMarkdown } from './format.hotspots.js';

const API_REL = 'apps/demo-api';

const FIXTURE_TS = `
import { FirebaseAdminFunctionTestContextInstance, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestContextInstance, FirebaseAdminTestContextInstance, modelTestContextFactory, ModelTestContextFixture, ModelTestContextInstance } from '@dereekb/firebase-server/test';
import { TestContextFixture } from '@dereekb/util/test';
export class DemoApiContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextFixture<F, TestContextFixture<F>, DemoApiContextFixtureInstance<F>> {}
export class DemoApiContextFixtureInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextInstance<F> {}
export class DemoApiFunctionContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends DemoApiContextFixture<F> {}
export class DemoApiFunctionContextFixtureInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends DemoApiContextFixtureInstance<F> {}

export type DemoApiJobTestContextParams = Partial<Job>;
export class DemoApiJobTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Job, JobDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiJobTestContextInstance<F>> {}
export class DemoApiJobTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Job, JobDocument, DemoApiFunctionContextFixtureInstance<F>> {}
export const demoApiJobContextFactory = () =>
  modelTestContextFactory<Job, JobDocument, DemoApiJobTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiJobTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiJobTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
    makeFixture: (f) => new DemoApiJobTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.jobCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiJobTestContextInstance(delegate, ref, testInstance)
  });
export const demoApiJobContext = demoApiJobContextFactory();

export interface DemoApiJobFeedbackTestContextParams extends Partial<JobFeedback> {
  job: DemoApiJobTestContextFixture;
}
export class DemoApiJobFeedbackTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<JobFeedback, JobFeedbackDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiJobFeedbackTestContextInstance<F>> {}
export class DemoApiJobFeedbackTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<JobFeedback, JobFeedbackDocument, DemoApiFunctionContextFixtureInstance<F>> {}
export const demoApiJobFeedbackContextFactory = () =>
  modelTestContextFactory<JobFeedback, JobFeedbackDocument, DemoApiJobFeedbackTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiJobFeedbackTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiJobFeedbackTestContextFixture<FirebaseAdminFunctionTestContextInstance>, JobFeedbackFirestoreCollection>({
    makeFixture: (f) => new DemoApiJobFeedbackTestContextFixture(f),
    getCollection: (fi, params) => fi.demoFirestoreCollections.jobFeedbackCollectionFactory(params.job.document),
    collectionForDocument: (fi, doc) => fi.demoFirestoreCollections.jobFeedbackCollectionFactory(doc.parent),
    makeInstance: (delegate, ref, testInstance) => new DemoApiJobFeedbackTestContextInstance(delegate, ref, testInstance)
  });
export const demoApiJobFeedbackContext = demoApiJobFeedbackContextFactory();
`;

const JOB_SCENARIO_SPEC = `import { demoApiFunctionContextFactory, demoApiJobContext, demoApiJobFeedbackContext } from '../../../test/fixture';
demoApiFunctionContextFactory((f) => {
  describe('feedback flow', () => {
    demoApiJobContext({ f }, (job) => {
      demoApiJobFeedbackContext({ f, job }, (fb) => {
        it('records worker feedback', () => {});
      });
    });
  });
});
`;

const JOB_CRUD_SPEC = `import { demoApiFunctionContextFactory, demoApiJobContext } from '../../../test/fixture';
demoApiFunctionContextFactory((f) => {
  demoApiJobContext({ f }, (job) => {
    it('creates a job', () => {});
  });
});
`;

const WORKER_CRUD_SPEC = `import { demoApiFunctionContextFactory } from '../../../test/fixture';
demoApiFunctionContextFactory((f) => {
  describe('worker', () => {
    it('does worker things', () => {});
  });
});
`;

interface Workspace {
  readonly root: string;
  readonly apiAbs: string;
}

async function makeWorkspace(): Promise<Workspace> {
  const root = await mkdtemp(join(tmpdir(), 'dbx-model-test-hotspots-'));
  const apiAbs = join(root, 'apps', 'demo-api');
  await mkdir(join(apiAbs, 'src', 'test'), { recursive: true });
  await mkdir(join(apiAbs, 'src', 'app', 'function', 'job'), { recursive: true });
  await mkdir(join(apiAbs, 'src', 'app', 'function', 'worker'), { recursive: true });
  await writeFile(join(apiAbs, 'src', 'test', 'fixture.ts'), FIXTURE_TS, 'utf8');
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'job', 'job.scenario.spec.ts'), JOB_SCENARIO_SPEC, 'utf8');
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'job', 'job.crud.spec.ts'), JOB_CRUD_SPEC, 'utf8');
  await writeFile(join(apiAbs, 'src', 'app', 'function', 'worker', 'worker.crud.spec.ts'), WORKER_CRUD_SPEC, 'utf8');
  return { root, apiAbs };
}

describe('findModelTestHotspots', () => {
  let workspace: Workspace;

  beforeEach(async () => {
    workspace = await makeWorkspace();
  });

  afterEach(async () => {
    await rm(workspace.root, { recursive: true, force: true });
  });

  it('resolves a sub-model to its parent group and surfaces the crud/scenario hotspots', async () => {
    const result = await findModelTestHotspots({ apiAbs: workspace.apiAbs, apiRel: API_REL, model: 'JobFeedback' });
    expect(result.fixtureFound).toBe(true);
    expect(result.parentModels).toContain('Job');
    expect(result.group).toBe('job');
    expect(result.groupMatchedExisting).toBe(true);
    expect(result.suggestedFiles).toEqual([]);

    const files = result.hotspots.map((hotspot) => hotspot.fileRel);
    expect(files).toHaveLength(2);
    expect(files.some((file) => file.endsWith('job/job.scenario.spec.ts'))).toBe(true);
    expect(files.some((file) => file.endsWith('job/job.crud.spec.ts'))).toBe(true);
    expect(files.some((file) => file.includes('/worker/'))).toBe(false);

    // Direct-reference file (own fixture) ranks ahead of the parent-only file.
    expect(result.hotspots[0].fileRel.endsWith('job/job.scenario.spec.ts')).toBe(true);

    const scenario = result.hotspots.find((hotspot) => hotspot.fileRel.endsWith('job/job.scenario.spec.ts'));
    expect(scenario?.bucket).toBe('scenario');
    expect(scenario?.directRefs).toBe(1);
    expect(scenario?.parentRefs).toBe(1);

    const crud = result.hotspots.find((hotspot) => hotspot.fileRel.endsWith('job/job.crud.spec.ts'));
    expect(crud?.bucket).toBe('crud');
    expect(crud?.directRefs).toBe(0);
    expect(crud?.parentRefs).toBe(1);
  });

  it('finds direct references for a top-level model with no parent fixtures', async () => {
    const result = await findModelTestHotspots({ apiAbs: workspace.apiAbs, apiRel: API_REL, model: 'Job' });
    expect(result.fixtureFound).toBe(true);
    expect(result.parentModels).toEqual([]);
    expect(result.hotspots).toHaveLength(2);
    expect(result.hotspots.every((hotspot) => hotspot.directRefs > 0)).toBe(true);
  });

  it('suggests canonical default files when no spec references the model', async () => {
    const result = await findModelTestHotspots({ apiAbs: workspace.apiAbs, apiRel: API_REL, model: 'Nonexistent' });
    expect(result.fixtureFound).toBe(false);
    expect(result.hotspots).toEqual([]);
    expect(result.groupMatchedExisting).toBe(false);
    expect(result.suggestedFiles).toEqual([`${API_REL}/src/app/function/nonexistent/nonexistent.crud.spec.ts`, `${API_REL}/src/app/function/nonexistent/nonexistent.scenario.spec.ts`]);
  });

  it('renders markdown + json', async () => {
    const result = await findModelTestHotspots({ apiAbs: workspace.apiAbs, apiRel: API_REL, model: 'JobFeedback' });
    const markdown = formatHotspotsAsMarkdown(result);
    expect(markdown).toContain('Model-test hotspots');
    expect(markdown).toContain('job.scenario.spec.ts');
    const json = formatHotspotsAsJson(result);
    expect(JSON.parse(json).model).toBe('JobFeedback');
  });
});
