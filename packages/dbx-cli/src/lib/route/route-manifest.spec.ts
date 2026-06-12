import { describe, expect, it } from 'vitest';
import { buildRouteManifest, ROUTE_MANIFEST_VERSION, type RouteManifestStateEntry } from './route-manifest.js';
import type { RouteSource } from './route-types.js';

const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z');

const WORKER_ROUTER = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
import { AppWorkerComponent } from './worker.component';
import { TimesheetListComponent } from './timesheet-list.component';

export const WORKER_STATE: Ng2StateDeclaration = { name: 'worker', url: '/worker', abstract: true };

export const WORKER_USER_STATE: Ng2StateDeclaration = {
  name: 'worker.user',
  url: '/:uid',
  component: AppWorkerComponent
};

export const WORKER_TIMESHEETS_STATE: Ng2StateDeclaration = {
  name: 'worker.user.timesheets',
  url: '/timesheets'
};

export const WORKER_TIMESHEETS_LIST_STATE: Ng2StateDeclaration = {
  name: 'worker.user.timesheets.list',
  url: '/list',
  component: TimesheetListComponent
};

export const STATES: Ng2StateDeclaration[] = [WORKER_STATE, WORKER_USER_STATE, WORKER_TIMESHEETS_STATE, WORKER_TIMESHEETS_LIST_STATE];
`;

const WORKER_COMPONENT = `
/**
 * @dbxRouteModel profile :uid - The profile for the worker
 * @dbxRouteModel worker :uid
 */
export class AppWorkerComponent {}
`;

const TIMESHEET_LIST_COMPONENT = `
/**
 * @dbxRouteModelList jobWorkerTimesheet
 */
export class TimesheetListComponent {}
`;

function workerSources(): readonly RouteSource[] {
  return [
    { name: 'app/worker.router.ts', text: WORKER_ROUTER },
    { name: 'app/worker.component.ts', text: WORKER_COMPONENT },
    { name: 'app/timesheet-list.component.ts', text: TIMESHEET_LIST_COMPONENT }
  ];
}

function stateNamed(states: readonly RouteManifestStateEntry[], name: string): RouteManifestStateEntry {
  const found = states.find((s) => s.name === name);
  if (found == null) {
    throw new Error(`state ${name} not found`);
  }
  return found;
}

describe('buildRouteManifest', () => {
  it('stamps version, ISO timestamp, and app', () => {
    const { manifest } = buildRouteManifest({ app: { name: 'demo', baseUrl: 'https://app.example.co' }, sources: [] }, FIXED_NOW);
    expect(manifest.version).toBe(ROUTE_MANIFEST_VERSION);
    expect(manifest.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(manifest.app).toEqual({ name: 'demo', baseUrl: 'https://app.example.co' });
    expect(manifest.states).toEqual([]);
  });

  it('resolves component @dbxRouteModel tags onto the rendering state', () => {
    const { manifest } = buildRouteManifest({ app: { name: 'app' }, sources: workerSources() }, FIXED_NOW);
    const user = stateNamed(manifest.states, 'worker.user');
    expect(user.component).toBe('AppWorkerComponent');
    expect(user.componentFile).toBe('app/worker.component.ts');
    expect(user.fullUrl).toBe('/worker/:uid');
    expect(user.urlParamKeys).toEqual(['uid']);
    expect(user.models).toEqual([
      { modelType: 'profile', kind: 'id', keyTemplate: ':uid', description: 'The profile for the worker' },
      { modelType: 'worker', kind: 'id', keyTemplate: ':uid' }
    ]);
  });

  it('flattens ancestor models onto descendants with a `from` attribution', () => {
    const { manifest } = buildRouteManifest({ app: { name: 'app' }, sources: workerSources() }, FIXED_NOW);
    const list = stateNamed(manifest.states, 'worker.user.timesheets.list');
    expect(list.fullUrl).toBe('/worker/:uid/timesheets/list');
    // own model first (no `from`), then inherited (with `from`)
    expect(list.models).toEqual([
      { modelType: 'jobWorkerTimesheet', kind: 'list' },
      { modelType: 'profile', kind: 'id', keyTemplate: ':uid', description: 'The profile for the worker', from: 'worker.user' },
      { modelType: 'worker', kind: 'id', keyTemplate: ':uid', from: 'worker.user' }
    ]);
  });

  it('keeps an abstract layout state with no models', () => {
    const { manifest } = buildRouteManifest({ app: { name: 'app' }, sources: workerSources() }, FIXED_NOW);
    const worker = stateNamed(manifest.states, 'worker');
    expect(worker.abstract).toBe(true);
    expect(worker.component).toBeUndefined();
    expect(worker.models).toEqual([]);
  });

  it('lets a state tag override a component tag by modelType', () => {
    const router = WORKER_ROUTER.replace('export const WORKER_USER_STATE: Ng2StateDeclaration = {', '/**\n * @dbxRouteModel profile {authUid}\n */\nexport const WORKER_USER_STATE: Ng2StateDeclaration = {');
    const sources: readonly RouteSource[] = [
      { name: 'app/worker.router.ts', text: router },
      { name: 'app/worker.component.ts', text: WORKER_COMPONENT },
      { name: 'app/timesheet-list.component.ts', text: TIMESHEET_LIST_COMPONENT }
    ];
    const { manifest } = buildRouteManifest({ app: { name: 'app' }, sources }, FIXED_NOW);
    const user = stateNamed(manifest.states, 'worker.user');
    expect(user.models).toEqual([
      { modelType: 'worker', kind: 'id', keyTemplate: ':uid' },
      { modelType: 'profile', kind: 'id', keyTemplate: '{authUid}' }
    ]);
  });

  it('drops future states but keeps the real subtree without warning', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const STATES: Ng2StateDeclaration[] = [
  { name: 'demo.**', url: '/demo' },
  { name: 'demo', url: '/demo' },
  { name: 'demo.home', url: '/home' }
];
`;
    const { manifest, warnings } = buildRouteManifest({ app: { name: 'app' }, sources: [{ name: 'a.ts', text }] }, FIXED_NOW);
    expect(manifest.states.map((s) => s.name).sort((a, b) => a.localeCompare(b))).toEqual(['demo', 'demo.home']);
    expect(warnings.filter((w) => w.kind === 'dropped-future-state')).toEqual([]);
  });

  it('warns when a dropped future state has no real subtree', () => {
    const text = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const STATES: Ng2StateDeclaration[] = [
  { name: 'lonely.**', url: '/lonely' }
];
`;
    const { warnings } = buildRouteManifest({ app: { name: 'app' }, sources: [{ name: 'a.ts', text }] }, FIXED_NOW);
    expect(warnings.some((w) => w.kind === 'dropped-future-state' && w.stateName === 'lonely.**')).toBe(true);
  });

  it('warns when a key template references a route param not in the URL', () => {
    const router = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
import { ThingComponent } from './thing.component';
export const THING_STATE: Ng2StateDeclaration = { name: 'thing', url: '/thing', component: ThingComponent };
export const STATES: Ng2StateDeclaration[] = [THING_STATE];
`;
    const component = `/**\n * @dbxRouteModel thing :bogus\n */\nexport class ThingComponent {}`;
    const { warnings } = buildRouteManifest(
      {
        app: { name: 'app' },
        sources: [
          { name: 'app/thing.router.ts', text: router },
          { name: 'app/thing.component.ts', text: component }
        ]
      },
      FIXED_NOW
    );
    expect(warnings.some((w) => w.kind === 'unknown-route-param' && w.modelType === 'thing')).toBe(true);
  });

  it('warns on an unknown model type when a model catalog is supplied', () => {
    const { warnings } = buildRouteManifest({ app: { name: 'app' }, sources: workerSources(), modelTypes: ['profile'] }, FIXED_NOW);
    expect(warnings.some((w) => w.kind === 'unknown-model-type' && w.modelType === 'worker')).toBe(true);
    expect(warnings.some((w) => w.kind === 'unknown-model-type' && w.modelType === 'profile')).toBe(false);
  });

  it('dedupes a model the child re-declares from an ancestor', () => {
    const router = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
import { ParentComponent } from './parent.component';
import { ChildComponent } from './child.component';
export const PARENT_STATE: Ng2StateDeclaration = { name: 'p', url: '/p/:id', component: ParentComponent };
export const CHILD_STATE: Ng2StateDeclaration = { name: 'p.c', url: '/c', component: ChildComponent };
export const STATES: Ng2StateDeclaration[] = [PARENT_STATE, CHILD_STATE];
`;
    const parentComponent = `/**\n * @dbxRouteModel item :id\n */\nexport class ParentComponent {}`;
    const childComponent = `/**\n * @dbxRouteModel item :id\n */\nexport class ChildComponent {}`;
    const { manifest } = buildRouteManifest(
      {
        app: { name: 'app' },
        sources: [
          { name: 'app/x.router.ts', text: router },
          { name: 'app/parent.component.ts', text: parentComponent },
          { name: 'app/child.component.ts', text: childComponent }
        ]
      },
      FIXED_NOW
    );
    const child = stateNamed(manifest.states, 'p.c');
    // The child declares its own `item :id`, so the ancestor copy is deduped (no inherited duplicate).
    expect(child.models).toEqual([{ modelType: 'item', kind: 'id', keyTemplate: ':id' }]);
  });

  it('marks malformed-tag findings as error severity and others as warning severity', () => {
    const router = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
import { ThingComponent } from './thing.component';
export const THING_STATE: Ng2StateDeclaration = { name: 'thing', url: '/thing', component: ThingComponent };
export const STATES: Ng2StateDeclaration[] = [THING_STATE];
`;
    const component = `/**\n * @dbxRouteModel thing\n */\nexport class ThingComponent {}`;
    const { warnings } = buildRouteManifest(
      {
        app: { name: 'app' },
        sources: [
          { name: 'app/thing.router.ts', text: router },
          { name: 'app/thing.component.ts', text: component }
        ]
      },
      FIXED_NOW
    );
    const malformed = warnings.filter((w) => w.kind === 'malformed-tag');
    expect(malformed.length).toBeGreaterThan(0);
    expect(malformed.every((w) => w.severity === 'error')).toBe(true);
    // Every non-malformed finding stays a non-blocking warning.
    expect(warnings.filter((w) => w.kind !== 'malformed-tag').every((w) => w.severity === 'warning')).toBe(true);
  });

  it('flags an id-like route param with no @dbxRouteModel binding', () => {
    const router = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const DETAIL_STATE: Ng2StateDeclaration = { name: 'thing.detail', url: '/things/:id' };
export const STATES: Ng2StateDeclaration[] = [DETAIL_STATE];
`;
    const { warnings } = buildRouteManifest({ app: { name: 'app' }, sources: [{ name: 'app/thing.router.ts', text: router }] }, FIXED_NOW);
    const missing = warnings.filter((w) => w.kind === 'missing-route-model');
    expect(missing.some((w) => w.stateName === 'thing.detail' && w.param === 'id')).toBe(true);
    expect(missing.every((w) => w.severity === 'warning')).toBe(true);
  });

  it('does not flag an id-like param that an inherited model binding covers', () => {
    const { warnings } = buildRouteManifest({ app: { name: 'app' }, sources: workerSources() }, FIXED_NOW);
    expect(warnings.some((w) => w.kind === 'missing-route-model')).toBe(false);
  });

  it('does not flag a non-id-like route param', () => {
    const router = `
import { type Ng2StateDeclaration } from '@uirouter/angular';
export const SLUG_STATE: Ng2StateDeclaration = { name: 'thing.slug', url: '/things/:slug' };
export const STATES: Ng2StateDeclaration[] = [SLUG_STATE];
`;
    const { warnings } = buildRouteManifest({ app: { name: 'app' }, sources: [{ name: 'app/thing.router.ts', text: router }] }, FIXED_NOW);
    expect(warnings.some((w) => w.kind === 'missing-route-model')).toBe(false);
  });
});
