/**
 * Validator specs covering each diagnostic rule independently.
 *
 * Each test feeds a small synthetic fixture through `extractAppFixturesFromText`
 * and `validateAppFixtures` to verify the rule fires (or doesn't) under the
 * expected conditions.
 */

import { describe, expect, it } from 'vitest';
import { extractAppFixturesFromText } from './extract.js';
import type { FixtureModelRegistry } from './types.js';
import { validateAppFixtures } from './validate.js';

const HEADER = `
import { FirebaseAdminFunctionTestContextInstance, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestContextInstance, FirebaseAdminTestContextInstance, modelTestContextFactory, ModelTestContextFixture, ModelTestContextInstance } from '@dereekb/firebase-server/test';
import { TestContextFixture } from '@dereekb/util/test';
export class DemoApiContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextFixture<F, TestContextFixture<F>, DemoApiContextFixtureInstance<F>> {}
export class DemoApiContextFixtureInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextInstance<F> {}
export class DemoApiFunctionContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends DemoApiContextFixture<F> {}
export class DemoApiFunctionContextFixtureInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends DemoApiContextFixtureInstance<F> {}
`;

function fix(snippet: string) {
  return extractAppFixturesFromText({ text: HEADER + snippet, fixturePath: 'fixture.ts' });
}

describe('validateAppFixtures', () => {
  it('passes a fully-forwarded triplet with no diagnostics', () => {
    const extraction = fix(`
export type DemoApiWidgetTestContextParams = Partial<Widget>;
export class DemoApiWidgetTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Widget, WidgetDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiWidgetTestContextInstance<F>> {
  async ping() { return this.instance.ping(); }
}
export class DemoApiWidgetTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Widget, WidgetDocument, DemoApiFunctionContextFixtureInstance<F>> {
  async ping() { return 'ok'; }
}
export const demoWidgetContextFactory = () =>
  modelTestContextFactory<Widget, WidgetDocument, DemoApiWidgetTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiWidgetTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiWidgetTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
    makeFixture: (f) => new DemoApiWidgetTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.widgetCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiWidgetTestContextInstance(delegate, ref, testInstance)
  });
export const demoWidgetContext = demoWidgetContextFactory();
`);
    const result = validateAppFixtures(extraction);
    expect(result.errorCount).toBe(0);
    expect(result.diagnostics.find((d) => d.code === 'forwarder-missing')).toBeUndefined();
  });

  it('flags forwarder-missing when an instance method has no fixture counterpart', () => {
    const extraction = fix(`
export type DemoApiWidgetTestContextParams = Partial<Widget>;
export class DemoApiWidgetTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Widget, WidgetDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiWidgetTestContextInstance<F>> {}
export class DemoApiWidgetTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Widget, WidgetDocument, DemoApiFunctionContextFixtureInstance<F>> {
  async ping() { return 'ok'; }
}
export const demoWidgetContextFactory = () =>
  modelTestContextFactory<Widget, WidgetDocument, DemoApiWidgetTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiWidgetTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiWidgetTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
    makeFixture: (f) => new DemoApiWidgetTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.widgetCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiWidgetTestContextInstance(delegate, ref, testInstance)
  });
export const demoWidgetContext = demoWidgetContextFactory();
`);
    const result = validateAppFixtures(extraction);
    const missing = result.diagnostics.find((d) => d.code === 'forwarder-missing');
    expect(missing).toBeDefined();
    expect(missing?.message).toMatch(/ping/);
  });

  it('flags triplet-incomplete when factory registration is missing', () => {
    const extraction = fix(`
export type DemoApiWidgetTestContextParams = Partial<Widget>;
export class DemoApiWidgetTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Widget, WidgetDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiWidgetTestContextInstance<F>> {}
export class DemoApiWidgetTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Widget, WidgetDocument, DemoApiFunctionContextFixtureInstance<F>> {}
`);
    const result = validateAppFixtures(extraction);
    const missing = result.diagnostics.find((d) => d.code === 'triplet-incomplete' && d.severity === 'error');
    expect(missing).toBeDefined();
    expect(missing?.message).toMatch(/modelTestContextFactory/);
  });

  it('flags archetype-inconsistent when getCollection reads a missing params field', () => {
    const extraction = fix(`
export interface DemoApiInnerTestContextParams {}
export class DemoApiInnerTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Inner, InnerDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiInnerTestContextInstance<F>> {}
export class DemoApiInnerTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Inner, InnerDocument, DemoApiFunctionContextFixtureInstance<F>> {}
export const demoInnerContextFactory = () =>
  modelTestContextFactory<Inner, InnerDocument, DemoApiInnerTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiInnerTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiInnerTestContextFixture<FirebaseAdminFunctionTestContextInstance>, InnerFirestoreCollection>({
    makeFixture: (f) => new DemoApiInnerTestContextFixture(f),
    getCollection: (fi, params) => fi.demoFirestoreCollections.innerCollectionFactory(params.parent.document),
    makeInstance: (delegate, ref, testInstance) => new DemoApiInnerTestContextInstance(delegate, ref, testInstance)
  });
export const demoInnerContext = demoInnerContextFactory();
`);
    const result = validateAppFixtures(extraction);
    expect(result.diagnostics.find((d) => d.code === 'archetype-inconsistent')).toBeDefined();
  });

  it('flags params-field-naming when a parent field uses an alias other than the firestoreModelIdentity short alias', () => {
    const registry: FixtureModelRegistry = {
      entries: [
        { name: 'SchoolGroup', modelType: 'schoolGroup', collectionPrefix: 'sg' },
        { name: 'School', modelType: 'school', collectionPrefix: 's' }
      ]
    };
    const extraction = fix(`
export interface DemoApiSchoolTestContextParams {
  parent: DemoApiSchoolGroupTestContextFixture;
}
export class DemoApiSchoolTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<School, SchoolDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiSchoolTestContextInstance<F>> {}
export class DemoApiSchoolTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<School, SchoolDocument, DemoApiFunctionContextFixtureInstance<F>> {}
export class DemoApiSchoolGroupTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<SchoolGroup, SchoolGroupDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiSchoolGroupTestContextInstance<F>> {}
export class DemoApiSchoolGroupTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<SchoolGroup, SchoolGroupDocument, DemoApiFunctionContextFixtureInstance<F>> {}
`);
    const result = validateAppFixtures(extraction, { registry });
    const drift = result.diagnostics.find((d) => d.code === 'params-field-naming');
    expect(drift).toBeDefined();
    expect(drift?.message).toMatch(/should be named `sg`/);
  });

  it('does not fire params-field-naming when the parent field already matches the short alias', () => {
    const registry: FixtureModelRegistry = {
      entries: [{ name: 'SchoolGroup', modelType: 'schoolGroup', collectionPrefix: 'sg' }]
    };
    const extraction = fix(`
export interface DemoApiInnerTestContextParams {
  sg: DemoApiSchoolGroupTestContextFixture;
}
export class DemoApiInnerTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Inner, InnerDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiInnerTestContextInstance<F>> {}
export class DemoApiInnerTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Inner, InnerDocument, DemoApiFunctionContextFixtureInstance<F>> {}
export class DemoApiSchoolGroupTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<SchoolGroup, SchoolGroupDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiSchoolGroupTestContextInstance<F>> {}
export class DemoApiSchoolGroupTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<SchoolGroup, SchoolGroupDocument, DemoApiFunctionContextFixtureInstance<F>> {}
`);
    const result = validateAppFixtures(extraction, { registry });
    expect(result.diagnostics.find((d) => d.code === 'params-field-naming')).toBeUndefined();
  });
});
