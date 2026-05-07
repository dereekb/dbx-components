import { describe, expect, it } from 'vitest';
import { createUtilRegistryFromEntries, type UtilEntryInfo } from '../registry/utils-runtime.js';
import { createSearchUtilTool } from './search-util.tool.js';

const FIXTURE_ENTRIES: readonly UtilEntryInfo[] = [
  {
    slug: 'expiration-details',
    name: 'expirationDetails',
    kind: 'function',
    category: 'date',
    module: '@dereekb/util',
    subpath: 'date/expires',
    signature: 'expirationDetails(input): ExpirationDetails<T>',
    description: 'Returns an ExpirationDetails for the given input.',
    params: [{ name: 'input', type: 'ExpirationDetailsInput<T>', description: '', optional: false }],
    returns: 'ExpirationDetails<T>',
    tags: ['expiration', 'expires', 'expiry', 'ttl', 'throttle', 'date'],
    example: '',
    relatedSlugs: ['is-expired', 'is-throttled'],
    skillRefs: [],
    deprecated: false,
    since: ''
  },
  {
    slug: 'is-throttled',
    name: 'isThrottled',
    kind: 'function',
    category: 'date',
    module: '@dereekb/util',
    subpath: 'date/expires',
    signature: 'isThrottled(throttleTime, lastRunAt, now?): boolean',
    description: 'Convenience function for quickly calculating throttling.',
    params: [],
    returns: 'boolean',
    tags: ['throttle', 'throttled', 'rate-limit', 'debounce', 'ttl'],
    example: '',
    relatedSlugs: ['expiration-details'],
    skillRefs: [],
    deprecated: false,
    since: ''
  },
  {
    slug: 'memoize-async-value-cache',
    name: 'memoizeAsyncValueCache',
    kind: 'function',
    category: 'cache',
    module: '@dereekb/util',
    subpath: 'cache/cache.memoize',
    signature: 'memoizeAsyncValueCache(inner): AsyncValueCache<T>',
    description: 'Wraps an inner AsyncValueCache with single-load in-memory memoization.',
    params: [],
    returns: 'AsyncValueCache<T>',
    tags: ['memoize', 'cache', 'async', 'memo'],
    example: '',
    relatedSlugs: [],
    skillRefs: [],
    deprecated: false,
    since: ''
  },
  {
    slug: 'first-value',
    name: 'firstValue',
    kind: 'function',
    category: 'array',
    module: '@dereekb/util',
    subpath: 'array/array',
    signature: 'firstValue(input): T',
    description: 'Returns the first value from the array.',
    params: [],
    returns: 'T',
    tags: ['array', 'first', 'head', 'value'],
    example: '',
    relatedSlugs: [],
    skillRefs: [],
    deprecated: false,
    since: ''
  }
];

const registry = createUtilRegistryFromEntries({ entries: FIXTURE_ENTRIES, loadedSources: ['@dereekb/util'] });
const tool = createSearchUtilTool({ registry });

function runSearch(args: unknown): { isError?: boolean; content: { type: string; text: string }[] } {
  return tool.run(args) as { isError?: boolean; content: { type: string; text: string }[] };
}

describe('dbx_util_search', () => {
  it('returns isError when query is missing', () => {
    const result = runSearch({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('ranks expiration-details highest for "expiration"', () => {
    const result = runSearch({ query: 'expiration' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('expiration-details');
    const expirationIndex = text.indexOf('expiration-details');
    const throttleIndex = text.indexOf('is-throttled');
    expect(expirationIndex).toBeLessThan(throttleIndex === -1 ? Number.MAX_SAFE_INTEGER : throttleIndex);
  });

  it('finds is-throttled when searching by tag "throttle"', () => {
    const result = runSearch({ query: 'throttle' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('is-throttled');
  });

  it('finds memoize-async-value-cache by intent "memoize"', () => {
    const result = runSearch({ query: 'memoize' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('memoize-async-value-cache');
  });

  it('honors the category filter', () => {
    const result = runSearch({ query: 'value', category: 'array' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('first-value');
    expect(text).not.toContain('expiration-details');
  });

  it('honors the module filter', () => {
    const result = runSearch({ query: 'expiration', module: '@dereekb/util' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('expiration-details');
  });

  it('returns no results when nothing matches', () => {
    const result = runSearch({ query: 'totallyUnrelatedXYZ' });
    expect(result.content[0].text).toContain('No utility entries matched');
  });

  it('clamps limit to maximum', () => {
    const result = runSearch({ query: 'value', limit: 100 });
    expect(result.isError).toBeFalsy();
  });

  it('AND-combines multiple tokens', () => {
    const result = runSearch({ query: 'throttle date' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('is-throttled');
  });
});
