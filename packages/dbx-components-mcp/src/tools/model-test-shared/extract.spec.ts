/**
 * Extraction specs for the `dbx_model_test_*` cluster.
 *
 * Drives `extractSpecTreeFromText` directly with synthetic spec snippets so
 * the parser is exercised without depending on a downstream app.
 */

import { describe, expect, it } from 'vitest';
import { extractSpecTreeFromText } from './extract.js';
import type { SpecNode } from './types.js';

const FIXTURE_IMPORT = `import { hellosubsApiFunctionContextFactory, hellosubsCountryContext, hellosubsCountryStateContext, hellosubsJobContext } from '../../../test/fixture';\n`;

function findFirst(node: SpecNode, predicate: (n: SpecNode) => boolean): SpecNode | undefined {
  if (predicate(node)) return node;
  for (const child of node.children) {
    const found = findFirst(child, predicate);
    if (found !== undefined) return found;
  }
  return undefined;
}

function findAll(node: SpecNode, predicate: (n: SpecNode) => boolean): SpecNode[] {
  const out: SpecNode[] = [];
  const visit = (n: SpecNode): void => {
    if (predicate(n)) out.push(n);
    for (const child of n.children) visit(child);
  };
  visit(node);
  return out;
}

describe('extractSpecTreeFromText', () => {
  it('detects the workspace prefix from named imports off `test/fixture`', () => {
    const text = `${FIXTURE_IMPORT}hellosubsApiFunctionContextFactory((f) => { describe('a', () => { it('b', () => {}); }); });\n`;
    const tree = extractSpecTreeFromText({ text, specPath: 'apps/x/spec.ts' });
    expect(tree.prefix).toBe('Hellosubs');
    expect(tree.prefixSource).toBe('imports');
    expect(tree.knownFixtureNames).toContain('hellosubsCountryContext');
    expect(tree.knownFixtureNames).toContain('hellosubsJobContext');
  });

  it('uses caller-supplied prefix and knownFixtureNames when provided', () => {
    const text = `${FIXTURE_IMPORT}hellosubsApiFunctionContextFactory((f) => { hellosubsCountryContext({ f }, (rc) => { describe('a', () => {}); }); });\n`;
    const tree = extractSpecTreeFromText({ text, specPath: 'spec.ts', prefix: 'Hellosubs', knownFixtureNames: ['hellosubsCountryContext'] });
    expect(tree.prefixSource).toBe('apiDir');
    expect(tree.prefix).toBe('Hellosubs');
    const fixture = findFirst(tree.root, (n) => n.kind === 'fixture');
    expect(fixture?.model).toBe('Country');
  });

  it('classifies describe / it / hook nodes with titles and line ranges', () => {
    const text = `describe('outer', () => { beforeEach(() => {}); it('inner', () => {}); });\n`;
    const tree = extractSpecTreeFromText({ text, specPath: 'spec.ts' });
    const describeNode = tree.root.children[0];
    expect(describeNode.kind).toBe('describe');
    expect(describeNode.title).toBe('outer');
    expect(describeNode.line).toBe(1);
    const hook = describeNode.children.find((c) => c.kind === 'hook');
    expect(hook?.title).toBe('beforeEach');
    const itNode = describeNode.children.find((c) => c.kind === 'it');
    expect(itNode?.title).toBe('inner');
  });

  it('detects fixture nodes with model, varName, and parentVars', () => {
    const text = `${FIXTURE_IMPORT}hellosubsApiFunctionContextFactory((f) => { hellosubsCountryContext({ f }, (rc) => { hellosubsCountryStateContext({ f, rc }, (rcs) => { it('x', () => {}); }); }); });\n`;
    const tree = extractSpecTreeFromText({ text, specPath: 'spec.ts' });
    const fixtures = findAll(tree.root, (n) => n.kind === 'fixture');
    expect(fixtures.length).toBe(2);
    const country = fixtures[0];
    expect(country.model).toBe('Country');
    expect(country.varName).toBe('rc');
    expect(country.parentVars).toEqual(['f']);
    const state = fixtures[1];
    expect(state.model).toBe('CountryState');
    expect(state.varName).toBe('rcs');
    expect(state.parentVars).toEqual(['f', 'rc']);
  });

  it('treats a plain non-test call with a callback as a wrapper', () => {
    const text = `wrapperFn((f) => { describe('a', () => {}); });\n`;
    const tree = extractSpecTreeFromText({ text, specPath: 'spec.ts' });
    const wrapper = tree.root.children[0];
    expect(wrapper.kind).toBe('wrapper');
    expect(wrapper.callee).toBe('wrapperFn');
    expect(wrapper.children[0]?.kind).toBe('describe');
  });

  it('detects helper-describe functions defined locally', () => {
    const text = `function describeIt(name) { describe(name, () => { it('x', () => {}); }); } describeIt('a');\n`;
    const tree = extractSpecTreeFromText({ text, specPath: 'spec.ts' });
    expect(tree.helpers.length).toBe(1);
    expect(tree.helpers[0].name).toBe('describeIt');
    expect(tree.helpers[0].emitsDescribe).toBe(true);
    expect(tree.helpers[0].emitsIt).toBe(true);
    const helperCall = findFirst(tree.root, (n) => n.kind === 'helperCall');
    expect(helperCall?.callee).toBe('describeIt');
  });

  it('flags template-literal titles', () => {
    const text = "describe(`a ${1}`, () => { it('inner', () => {}); });\n";
    const tree = extractSpecTreeFromText({ text, specPath: 'spec.ts' });
    const describeNode = tree.root.children[0];
    expect(describeNode.titleIsTemplate).toBe(true);
  });

  it('counts describes, its, and fixture calls', () => {
    const text = `${FIXTURE_IMPORT}describe('a', () => { it('1', () => {}); it('2', () => {}); hellosubsCountryContext({ f }, (rc) => { it('3', () => {}); }); });\n`;
    const tree = extractSpecTreeFromText({ text, specPath: 'spec.ts' });
    expect(tree.describeCount).toBe(1);
    expect(tree.itCount).toBe(3);
    expect(tree.fixtureCallsCount).toBe(1);
  });
});
