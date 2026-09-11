import { describe, expect, it } from 'vitest';
import { canonicalCliCacheJson, cliCacheFingerprint, cliDataCacheKey, cliDataCachePathSegment, normalizeCliCacheFilter } from './data-cache.fingerprint';

const BASE = { dataset: 'worker.lineDetails', datasetVersion: 1, env: 'prod' };

describe('normalizeCliCacheFilter()', () => {
  it('drops the empty shapes so every unfiltered spelling agrees', () => {
    // the case that matters most: an export run with no flags, run again with a flag left explicitly
    // undefined, has to be ONE recorded build
    expect(normalizeCliCacheFilter({})).toBeUndefined();
    expect(normalizeCliCacheFilter({ agentId: undefined, tg: [], ga: null, note: '' })).toBeUndefined();
  });

  it('keeps false and zero, which are real filter values', () => {
    expect(normalizeCliCacheFilter({ ga: false, limit: 0 })).toEqual({ ga: false, limit: 0 });
  });

  it('is invariant to object key order', () => {
    expect(canonicalCliCacheJson(normalizeCliCacheFilter({ b: 1, a: 2 }))).toBe(canonicalCliCacheJson(normalizeCliCacheFilter({ a: 2, b: 1 })));
  });

  it('is invariant to array order, because a filter array names a set', () => {
    expect(normalizeCliCacheFilter({ tg: ['b', 'a', 'c'] })).toEqual({ tg: ['a', 'b', 'c'] });
  });

  it('renders a Date as its ISO string', () => {
    expect(normalizeCliCacheFilter({ start: new Date('2026-09-08T00:00:00.000Z') })).toEqual({ start: '2026-09-08T00:00:00.000Z' });
  });

  it('normalizes nested objects and drops the ones that empty out', () => {
    expect(normalizeCliCacheFilter({ outer: { inner: undefined }, kept: { a: 1 } })).toEqual({ kept: { a: 1 } });
  });
});

describe('cliCacheFingerprint()', () => {
  it('is deterministic', () => {
    expect(cliCacheFingerprint({ ...BASE, filter: { tg: ['a'] } })).toBe(cliCacheFingerprint({ ...BASE, filter: { tg: ['a'] } }));
  });

  it('agrees across every spelling of an empty filter', () => {
    const omitted = cliCacheFingerprint(BASE);
    expect(cliCacheFingerprint({ ...BASE, filter: undefined })).toBe(omitted);
    expect(cliCacheFingerprint({ ...BASE, filter: {} })).toBe(omitted);
    expect(cliCacheFingerprint({ ...BASE, filter: { agentId: undefined, tg: [] } })).toBe(omitted);
  });

  it('ignores key and array order', () => {
    expect(cliCacheFingerprint({ ...BASE, filter: { tg: ['b', 'a'], ga: true } })).toBe(cliCacheFingerprint({ ...BASE, filter: { ga: true, tg: ['a', 'b'] } }));
  });

  it('changes when the filter changes', () => {
    expect(cliCacheFingerprint({ ...BASE, filter: { limit: 10 } })).not.toBe(cliCacheFingerprint({ ...BASE, filter: { limit: 11 } }));
  });

  it('changes when the env changes, because the same filter names different data per env', () => {
    expect(cliCacheFingerprint({ ...BASE, env: 'prod' })).not.toBe(cliCacheFingerprint({ ...BASE, env: 'staging' }));
  });

  it('changes when the dataset version is bumped, invalidating every entry for the stage', () => {
    // the invalidation lever: a stage rebuilt by newer code must not be satisfied by a build its
    // older code produced
    expect(cliCacheFingerprint({ ...BASE, datasetVersion: 1 })).not.toBe(cliCacheFingerprint({ ...BASE, datasetVersion: 2 }));
  });

  it('changes when the dataset changes', () => {
    expect(cliCacheFingerprint({ ...BASE, dataset: 'worker.source' })).not.toBe(cliCacheFingerprint(BASE));
  });

  it('is a short hex digest', () => {
    expect(cliCacheFingerprint(BASE)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('cliDataCacheKey()', () => {
  it('joins env, dataset, and fingerprint', () => {
    expect(cliDataCacheKey({ env: 'prod', dataset: 'worker.source', fingerprint: 'abc' })).toBe('prod/worker.source/abc');
  });
});

describe('cliDataCachePathSegment()', () => {
  it('replaces the characters a filename cannot carry', () => {
    expect(cliDataCachePathSegment('firestore-query:workers-query')).toBe('firestore-query_workers-query');
  });

  it('leaves an ordinary dataset id alone', () => {
    expect(cliDataCachePathSegment('worker.lineDetails')).toBe('worker.lineDetails');
  });
});
