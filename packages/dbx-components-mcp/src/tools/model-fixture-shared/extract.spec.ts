/**
 * Extraction specs for the `dbx_model_fixture_*` cluster.
 *
 * Drives `extractAppFixturesFromText` directly with synthetic fixture
 * snippets so the parser is exercised without depending on `apps/demo-api`.
 * Each snippet covers a different archetype shape.
 */

import { describe, expect, it } from 'vitest';
import { extractAppFixturesFromText } from './extract.js';

const BASE_HEADER = `
import { FirebaseAdminFunctionTestContextInstance, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestContextInstance, FirebaseAdminTestContextInstance, modelTestContextFactory, ModelTestContextFixture, ModelTestContextInstance } from '@dereekb/firebase-server/test';
import { TestContextFixture } from '@dereekb/util/test';
export class DemoApiContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextFixture<F, TestContextFixture<F>, DemoApiContextFixtureInstance<F>> {}
export class DemoApiContextFixtureInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextInstance<F> {}
export class DemoApiFunctionContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends DemoApiContextFixture<F> {}
export class DemoApiFunctionContextFixtureInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends DemoApiContextFixtureInstance<F> {}
`;

const TOP_LEVEL_SIMPLE = `
export type DemoApiGuestbookTestContextParams = Partial<Guestbook>;
export class DemoApiGuestbookTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Guestbook, GuestbookDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiGuestbookTestContextInstance<F>> {}
export class DemoApiGuestbookTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Guestbook, GuestbookDocument, DemoApiFunctionContextFixtureInstance<F>> {}
export const demoGuestbookContextFactory = () =>
  modelTestContextFactory<Guestbook, GuestbookDocument, DemoApiGuestbookTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiGuestbookTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiGuestbookTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
    makeFixture: (f) => new DemoApiGuestbookTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.guestbookCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiGuestbookTestContextInstance(delegate, ref, testInstance)
  });
export const demoGuestbookContext = demoGuestbookContextFactory();
`;

const TOP_LEVEL_WITH_DEPS = `
export interface DemoApiProfileTestContextParams {
  u: DemoApiAuthorizedUserTestContextFixture;
}
export class DemoApiProfileTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Profile, ProfileDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiProfileTestContextInstance<F>> {
  async load() { return this.instance.load(); }
}
export class DemoApiProfileTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Profile, ProfileDocument, DemoApiFunctionContextFixtureInstance<F>> {
  async load() { return this.document; }
}
export const demoProfileContextFactory = () =>
  modelTestContextFactory<Profile, ProfileDocument, DemoApiProfileTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiProfileTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiProfileTestContextFixture<FirebaseAdminFunctionTestContextInstance>, ProfileFirestoreCollection>({
    makeFixture: (f) => new DemoApiProfileTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.profileCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiProfileTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params) => collection.documentAccessor().documentRefForId(params.u.uid)
  });
export const demoProfileContext = demoProfileContextFactory();
`;

const SUB_COLLECTION = `
export interface DemoApiGuestbookEntryTestContextParams extends Partial<GuestbookEntry> {
  init?: boolean;
  u: DemoApiAuthorizedUserTestContextFixture;
  g: DemoApiGuestbookTestContextFixture;
}
export class DemoApiGuestbookEntryTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<GuestbookEntry, GuestbookEntryDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiGuestbookEntryTestContextInstance<F>> {}
export class DemoApiGuestbookEntryTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<GuestbookEntry, GuestbookEntryDocument, DemoApiFunctionContextFixtureInstance<F>> {}
export const demoGuestbookEntryContextFactory = () =>
  modelTestContextFactory<GuestbookEntry, GuestbookEntryDocument, DemoApiGuestbookEntryTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiGuestbookEntryTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiGuestbookEntryTestContextFixture<FirebaseAdminFunctionTestContextInstance>, GuestbookEntryFirestoreCollection>({
    makeFixture: (f) => new DemoApiGuestbookEntryTestContextFixture(f),
    getCollection: (fi, params) => fi.demoFirestoreCollections.guestbookEntryCollectionFactory(params.g.document),
    collectionForDocument: (fi, doc) => fi.demoFirestoreCollections.guestbookEntryCollectionFactory(doc.parent),
    makeInstance: (delegate, ref, testInstance) => new DemoApiGuestbookEntryTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params) => collection.documentAccessor().documentRefForId(params.u.uid)
  });
export const demoGuestbookEntryContext = demoGuestbookEntryContextFactory();
`;

describe('extractAppFixturesFromText', () => {
  it('detects the workspace prefix from the base context fixture', () => {
    const extraction = extractAppFixturesFromText({ text: BASE_HEADER, fixturePath: 'apps/demo-api/src/test/fixture.ts' });
    expect(extraction.prefix).toBe('DemoApi');
  });

  it('classifies a top-level-simple entry', () => {
    const extraction = extractAppFixturesFromText({ text: BASE_HEADER + TOP_LEVEL_SIMPLE, fixturePath: 'fixture.ts' });
    const entry = extraction.entries.find((e) => e.model === 'Guestbook');
    expect(entry).toBeDefined();
    expect(entry?.archetype).toBe('top-level-simple');
    expect(entry?.fixtureClassName).toBe('DemoApiGuestbookTestContextFixture');
    expect(entry?.instanceClassName).toBe('DemoApiGuestbookTestContextInstance');
    expect(entry?.paramsTypeName).toBe('DemoApiGuestbookTestContextParams');
    expect(entry?.factoryName).toBe('demoGuestbookContextFactory');
    expect(entry?.singletonName).toBe('demoGuestbookContext');
    expect(entry?.params?.kind).toBe('alias');
    expect(entry?.params?.aliasOfPartial).toBe(true);
  });

  it('classifies a top-level-with-deps entry and reads its method tables', () => {
    const extraction = extractAppFixturesFromText({ text: BASE_HEADER + TOP_LEVEL_WITH_DEPS, fixturePath: 'fixture.ts' });
    const entry = extraction.entries.find((e) => e.model === 'Profile');
    expect(entry).toBeDefined();
    expect(entry?.archetype).toBe('top-level-with-deps');
    expect(entry?.params?.fields.map((f) => f.name)).toEqual(['u']);
    expect(entry?.params?.fields[0]?.fixtureModel).toBe('AuthorizedUser');
    expect(entry?.fixtureMethods.map((m) => m.name)).toEqual(['load']);
    expect(entry?.instanceMethods.map((m) => m.name)).toEqual(['load']);
  });

  it('classifies a sub-collection-traversal entry', () => {
    const extraction = extractAppFixturesFromText({ text: BASE_HEADER + SUB_COLLECTION, fixturePath: 'fixture.ts' });
    const entry = extraction.entries.find((e) => e.model === 'GuestbookEntry');
    expect(entry).toBeDefined();
    expect(entry?.archetype).toBe('sub-collection-traversal');
    expect(entry?.factory?.hasParamsGetCollection).toBe(true);
    expect(entry?.factory?.hasCollectionForDocument).toBe(true);
    expect(entry?.factory?.parentFixtureFieldFromGetCollection).toBe('g');
    const fieldNames = entry?.params?.fields.map((f) => f.name) ?? [];
    expect(fieldNames).toContain('g');
    expect(fieldNames).toContain('u');
  });

  it("flags classes that match the suffix but don't fit the prefix as unrecognized", () => {
    const off = `
export class FooTestContextFixture {}
`;
    const extraction = extractAppFixturesFromText({ text: BASE_HEADER + off, fixturePath: 'fixture.ts' });
    expect(extraction.unrecognizedClassNames).toContain('FooTestContextFixture');
  });

  it('returns an empty list when the file declares no fixture/instance pairs', () => {
    const extraction = extractAppFixturesFromText({ text: BASE_HEADER, fixturePath: 'fixture.ts' });
    expect(extraction.entries).toEqual([]);
  });
});
