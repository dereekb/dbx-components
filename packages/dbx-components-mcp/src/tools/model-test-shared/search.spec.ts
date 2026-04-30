/**
 * Search specs for the `dbx_model_test_*` cluster.
 *
 * Drives `searchSpecTree` against trees built by `extractSpecTreeFromText`
 * to verify each query mode.
 */

import { describe, expect, it } from 'vitest';
import { extractSpecTreeFromText } from './extract.js';
import { searchSpecTree } from './search.js';

const SPEC = `import { hellosubsApiFunctionContextFactory, hellosubsCountryContext, hellosubsCountryStateContext, hellosubsJobContext } from '../../../test/fixture';
hellosubsApiFunctionContextFactory((f) => {
  describe('admin', () => {
    hellosubsCountryContext({ f }, (rc) => {
      hellosubsCountryStateContext({ f, rc }, (rcs) => {
        describe('jobs', () => {
          hellosubsJobContext({ f }, (j) => {
            it('does the thing', () => {});
          });
        });
      });
    });
  });
});
`;

describe('searchSpecTree', () => {
  it('finds fixture nodes by model', () => {
    const tree = extractSpecTreeFromText({ text: SPEC, specPath: 'spec.ts' });
    const result = searchSpecTree(tree, { mode: 'model', value: 'CountryState' });
    expect(result.hits.length).toBe(1);
    expect(result.hits[0].model).toBe('CountryState');
    expect(result.hits[0].fixtureChain).toEqual(['Country']);
    expect(result.hits[0].describePath).toEqual(['admin']);
  });

  it('matches consecutive chains via the chain query', () => {
    const tree = extractSpecTreeFromText({ text: SPEC, specPath: 'spec.ts' });
    const result = searchSpecTree(tree, { mode: 'chain', value: 'Country > CountryState' });
    expect(result.hits.length).toBeGreaterThan(0);
    const last = result.hits[result.hits.length - 1];
    expect(last.fixtureChain[0]).toBe('Country');
  });

  it('does not match a non-consecutive chain query', () => {
    const tree = extractSpecTreeFromText({ text: SPEC, specPath: 'spec.ts' });
    const result = searchSpecTree(tree, { mode: 'chain', value: 'Country > Job' });
    expect(result.hits.length).toBe(0);
  });

  it('finds describes by substring', () => {
    const tree = extractSpecTreeFromText({ text: SPEC, specPath: 'spec.ts' });
    const result = searchSpecTree(tree, { mode: 'describe', value: 'JOB' });
    expect(result.hits.length).toBe(1);
    expect(result.hits[0].title).toBe('jobs');
  });

  it('finds its by substring with full describe path and fixture chain', () => {
    const tree = extractSpecTreeFromText({ text: SPEC, specPath: 'spec.ts' });
    const result = searchSpecTree(tree, { mode: 'it', value: 'thing' });
    expect(result.hits.length).toBe(1);
    expect(result.hits[0].describePath).toEqual(['admin', 'jobs']);
    expect(result.hits[0].fixtureChain).toEqual(['Country', 'CountryState', 'Job']);
  });
});
