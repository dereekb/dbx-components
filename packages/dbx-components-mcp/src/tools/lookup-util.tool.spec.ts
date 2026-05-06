import { describe, expect, it } from 'vitest';
import { createUtilRegistryFromEntries, type UtilEntryInfo } from '../registry/utils-runtime.js';
import { createLookupUtilTool } from './lookup-util.tool.js';

const FIXTURE_ENTRIES: readonly UtilEntryInfo[] = [
  {
    slug: 'expiration-details',
    name: 'expirationDetails',
    kind: 'function',
    category: 'date',
    module: '@dereekb/util',
    subpath: 'date/expires',
    signature: 'expirationDetails(input: ExpirationDetailsInput<T>): ExpirationDetails<T>',
    description: 'Returns an ExpirationDetails for the given input configuration.',
    params: [{ name: 'input', type: 'ExpirationDetailsInput<T>', description: 'Configuration for calculating expiration', optional: false }],
    returns: 'An ExpirationDetails object that can determine expiration state',
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
    returns: 'True if the operation should be throttled',
    tags: ['throttle', 'throttled', 'rate-limit', 'debounce', 'ttl'],
    example: '',
    relatedSlugs: ['expiration-details'],
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
    signature: 'firstValue(input: ArrayOrValue<T>): T',
    description: 'Returns the first value from the array, or the value itself if not an array.',
    params: [{ name: 'input', type: 'ArrayOrValue<T>', description: 'single value or array', optional: false }],
    returns: 'the first element of the array',
    tags: ['array', 'first', 'head', 'value'],
    example: '',
    relatedSlugs: ['last-value'],
    skillRefs: [],
    deprecated: false,
    since: ''
  }
];

const tool = createLookupUtilTool({
  registry: createUtilRegistryFromEntries({ entries: FIXTURE_ENTRIES, loadedSources: ['@dereekb/util'] })
});

function runLookupUtil(args: unknown): { isError?: boolean; content: { type: string; text: string }[] } {
  return tool.run(args) as { isError?: boolean; content: { type: string; text: string }[] };
}

describe('dbx_util_lookup', () => {
  it('returns isError when topic is missing', () => {
    const result = runLookupUtil({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('returns the catalog for topic="list"', () => {
    const result = runLookupUtil({ topic: 'list' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# Utility catalog');
    expect(result.content[0].text).toContain('expiration-details');
    expect(result.content[0].text).toContain('first-value');
  });

  it('groups the catalog by category', () => {
    const result = runLookupUtil({ topic: 'catalog' });
    expect(result.content[0].text).toContain('## array');
    expect(result.content[0].text).toContain('## date');
  });

  it('matches by slug', () => {
    const result = runLookupUtil({ topic: 'expiration-details' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# expirationDetails');
    expect(result.content[0].text).toContain('`function`');
    expect(result.content[0].text).toContain('`date/expires`');
  });

  it('matches by exported name', () => {
    const result = runLookupUtil({ topic: 'isThrottled' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# isThrottled');
  });

  it('matches by case-insensitive name', () => {
    const result = runLookupUtil({ topic: 'isthrottled' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# isThrottled');
  });

  it('renders params table when params are present', () => {
    const result = runLookupUtil({ topic: 'expiration-details' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('## Params');
    expect(result.content[0].text).toContain('`input`');
  });

  it('omits params section when params are empty', () => {
    const result = runLookupUtil({ topic: 'is-throttled' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).not.toContain('## Params');
  });

  it('respects depth=brief', () => {
    const result = runLookupUtil({ topic: 'expiration-details', depth: 'brief' });
    expect(result.content[0].text).not.toContain('## Params');
    expect(result.content[0].text).toContain('depth="full"');
  });

  it('returns fuzzy candidates on miss', () => {
    const result = runLookupUtil({ topic: 'expir' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No utility matched');
    expect(result.content[0].text).toContain('expiration-details');
  });

  it('returns a not-found pointer to the catalog when no candidates score', () => {
    const result = runLookupUtil({ topic: 'totallyUnrelatedTopicXYZ' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Try `dbx_util_lookup topic="list"`');
  });
});
