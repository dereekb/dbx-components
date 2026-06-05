/**
 * Forwarder renderer specs.
 *
 * Drives `renderForwarders()` against extracted entries to confirm signature
 * preservation, async handling, and idempotency.
 */

import { describe, expect, it } from 'vitest';
import { extractAppFixturesFromText } from './extract.js';
import { renderForwarders } from './forward.js';

const HEADER = `
import { FirebaseAdminFunctionTestContextInstance, FirebaseAdminNestTestContextFixture, FirebaseAdminTestContextInstance, modelTestContextFactory, ModelTestContextFixture, ModelTestContextInstance } from '@dereekb/firebase-server/test';
import { TestContextFixture } from '@dereekb/util/test';
export class DemoApiContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextFixture<F, TestContextFixture<F>, DemoApiContextFixtureInstance<F>> {}
export class DemoApiContextFixtureInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> {}
export class DemoApiFunctionContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends DemoApiContextFixture<F> {}
export class DemoApiFunctionContextFixtureInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends DemoApiContextFixtureInstance<F> {}
`;

function fix(snippet: string) {
  return extractAppFixturesFromText({ text: HEADER + snippet, fixturePath: 'fixture.ts' });
}

describe('renderForwarders', () => {
  it('emits forwarders for instance methods missing on the fixture', () => {
    const extraction = fix(`
export type DemoApiWidgetTestContextParams = Partial<Widget>;
export class DemoApiWidgetTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Widget, WidgetDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiWidgetTestContextInstance<F>> {}
export class DemoApiWidgetTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Widget, WidgetDocument, DemoApiFunctionContextFixtureInstance<F>> {
  async ping(): Promise<string> { return 'ok'; }
  async update(params: Omit<UpdateWidgetParams, 'key'>) { return params; }
}
`);
    const entry = extraction.entries.find((e) => e.model === 'Widget');
    expect(entry).toBeDefined();
    const result = renderForwarders({ entry: entry! });
    expect(result.added.map((f) => f.method)).toEqual(['ping', 'update']);
    const pingSrc = result.added[0].source;
    expect(pingSrc).toContain('async ping(): Promise<string>');
    expect(pingSrc).toContain('return this.instance.ping();');
    const updateSrc = result.added[1].source;
    expect(updateSrc).toContain("update(params: Omit<UpdateWidgetParams, 'key'>)");
    expect(updateSrc).toContain('return this.instance.update(params);');
  });

  it('skips methods that already have a forwarder', () => {
    const extraction = fix(`
export type DemoApiWidgetTestContextParams = Partial<Widget>;
export class DemoApiWidgetTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Widget, WidgetDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiWidgetTestContextInstance<F>> {
  async ping() { return this.instance.ping(); }
}
export class DemoApiWidgetTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Widget, WidgetDocument, DemoApiFunctionContextFixtureInstance<F>> {
  async ping() { return 'ok'; }
}
`);
    const entry = extraction.entries.find((e) => e.model === 'Widget');
    const result = renderForwarders({ entry: entry! });
    expect(result.added).toEqual([]);
    expect(result.skippedAlreadyForwarded).toEqual(['ping']);
  });

  it('respects the methods whitelist', () => {
    const extraction = fix(`
export type DemoApiWidgetTestContextParams = Partial<Widget>;
export class DemoApiWidgetTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Widget, WidgetDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiWidgetTestContextInstance<F>> {}
export class DemoApiWidgetTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Widget, WidgetDocument, DemoApiFunctionContextFixtureInstance<F>> {
  async a() {}
  async b() {}
}
`);
    const entry = extraction.entries.find((e) => e.model === 'Widget');
    const result = renderForwarders({ entry: entry!, methods: ['b', 'c'] });
    expect(result.added.map((f) => f.method)).toEqual(['b']);
    expect(result.missingFromInstance).toEqual(['c']);
  });
});
