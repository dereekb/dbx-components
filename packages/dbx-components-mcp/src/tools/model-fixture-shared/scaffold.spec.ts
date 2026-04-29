/**
 * Scaffold renderer specs.
 *
 * Drives `renderFixtureScaffold()` for each archetype against the same parsed
 * extraction to confirm the snippet shape, generic count, and TODO list are
 * archetype-correct. Pure text generation — no disk I/O.
 */

import { describe, expect, it } from 'vitest';
import { extractAppFixturesFromText } from './extract.js';
import { renderFixtureScaffold } from './scaffold.js';

const HEADER = `
import { FirebaseAdminFunctionTestContextInstance, FirebaseAdminNestTestContextFixture, FirebaseAdminTestContextInstance, modelTestContextFactory, ModelTestContextFixture, ModelTestContextInstance } from '@dereekb/firebase-server/test';
import { TestContextFixture } from '@dereekb/util/test';
export class DemoApiContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextFixture<F, TestContextFixture<F>, DemoApiContextFixtureInstance<F>> {}
export class DemoApiContextFixtureInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> {}
`;

const extraction = extractAppFixturesFromText({ text: HEADER, fixturePath: 'fixture.ts' });

describe('renderFixtureScaffold', () => {
  it('renders a top-level-simple scaffold with a Partial alias', () => {
    const out = renderFixtureScaffold(extraction, {
      model: 'Widget',
      prefix: 'DemoApi',
      archetype: 'top-level-simple'
    });
    expect(out.snippet).toContain('export type DemoApiWidgetTestContextParams = Partial<Widget>;');
    expect(out.snippet).toContain('class DemoApiWidgetTestContextFixture');
    expect(out.snippet).toContain('class DemoApiWidgetTestContextInstance');
    expect(out.snippet).toContain('export const demoWidgetContextFactory = ()');
    expect(out.snippet).toContain('export const demoWidgetContext = demoWidgetContextFactory();');
    expect(out.snippet).toMatch(/getCollection: \(fi\) => fi\.demoFirestoreCollections\.widgetCollection/);
    expect(out.factoryName).toBe('demoWidgetContextFactory');
    expect(out.singletonName).toBe('demoWidgetContext');
  });

  it('renders a top-level-with-deps scaffold with extends Partial + dep field', () => {
    const out = renderFixtureScaffold(extraction, {
      model: 'Profile',
      prefix: 'DemoApi',
      archetype: 'top-level-with-deps',
      paramsDependsOn: [{ field: 'u', fixtureModel: 'AuthorizedUser' }]
    });
    expect(out.snippet).toContain('export interface DemoApiProfileTestContextParams extends Partial<Profile> {');
    expect(out.snippet).toContain('readonly u: DemoApiAuthorizedUserTestContextFixture;');
  });

  it('renders a sub-collection scaffold with 8 generics, two-arg getCollection, and required parent field', () => {
    const out = renderFixtureScaffold(extraction, {
      model: 'JobLocationTimesheetSummary',
      prefix: 'HellosubsApi',
      archetype: 'sub-collection',
      parentFixture: 'JobLocation',
      parentFixtureField: 'jl',
      collectionGenericArg: 'JobLocationTimesheetSummaryFirestoreCollection'
    });
    expect(out.snippet).toContain('readonly jl: HellosubsApiJobLocationTestContextFixture;');
    expect(out.snippet).toContain('JobLocationTimesheetSummaryFirestoreCollection');
    expect(out.snippet).toMatch(/getCollection: \(fi, params\) => fi\.[a-z]+FirestoreCollections\.[a-z][a-zA-Z]*CollectionFactory\(params\.jl\.document\)/);
    expect(out.snippet).not.toContain('collectionForDocument');
  });

  it('renders a sub-collection-traversal scaffold with both getCollection and collectionForDocument', () => {
    const out = renderFixtureScaffold(extraction, {
      model: 'GuestbookEntry',
      prefix: 'DemoApi',
      archetype: 'sub-collection-traversal',
      parentFixture: 'Guestbook',
      parentFixtureField: 'g',
      collectionGenericArg: 'GuestbookEntryFirestoreCollection',
      withInitDocument: true
    });
    expect(out.snippet).toContain('collectionForDocument:');
    expect(out.snippet).toContain('initDocument:');
    expect(out.snippet).toContain('readonly g: DemoApiGuestbookTestContextFixture;');
  });

  it('reports inserted entities + TODOs', () => {
    const out = renderFixtureScaffold(extraction, {
      model: 'Widget',
      prefix: 'DemoApi',
      archetype: 'top-level-simple'
    });
    expect(out.inserted.map((i) => i.kind)).toEqual(['params', 'instance', 'fixture', 'factory', 'singleton']);
    expect(out.todos.length).toBeGreaterThan(0);
  });
});
