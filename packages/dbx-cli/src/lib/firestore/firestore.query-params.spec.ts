import { describe, expect, it } from 'vitest';
import { type CliFirestoreQueryManifestEntry, type CliFirestoreQueryParam } from '../manifest/types';
import { CliError } from '../util/output';
import { resolveCliFirestoreQueryArgs } from './firestore.query-params';

function entryWith(params: readonly CliFirestoreQueryParam[]): CliFirestoreQueryManifestEntry {
  return {
    slug: 'test-query',
    name: 'testQuery',
    module: 'demo-firebase',
    subpath: 'model/test/test.query',
    model: 'Test',
    collection: 'tst',
    isNested: false,
    scope: 'COLLECTION',
    signature: `testQuery(${params.map((p) => `${p.name}: ${p.type}`).join(', ')}): FirestoreQueryConstraint[]`,
    params
  };
}

const NO_PARAMS = entryWith([]);
const ONE_OBJECT_PARAM = entryWith([{ name: 'params', type: 'PublishedGuestbookEntriesQueryParams', optional: false }]);
const ONE_SCALAR_PARAM = entryWith([{ name: 'username', type: 'string', optional: false }]);
const TWO_POSITIONAL = entryWith([
  { name: 'state', type: 'string', optional: false },
  { name: 'limit', type: 'number', optional: true }
]);
const OPTIONAL_ONLY = entryWith([{ name: 'published', type: 'boolean', optional: true }]);
const DATE_PARAM = entryWith([{ name: 'before', type: 'Date', optional: false }]);
const MAYBE_DATE_PARAM = entryWith([{ name: 'cutoff', type: 'Maybe<Date>', optional: true }]);
const NESTED_OBJECT_PARAM = entryWith([{ name: 'params', type: 'SweepQueryParams', optional: false }]);

describe('resolveCliFirestoreQueryArgs()', () => {
  describe('omitted params', () => {
    it('calls with no args when the factory takes none', () => {
      expect(resolveCliFirestoreQueryArgs({ entry: NO_PARAMS })).toEqual([]);
    });

    it('calls with no args when every param is optional', () => {
      expect(resolveCliFirestoreQueryArgs({ entry: OPTIONAL_ONLY })).toEqual([]);
    });

    it('fails when a required param is missing, quoting the signature', () => {
      let error: unknown;
      try {
        resolveCliFirestoreQueryArgs({ entry: ONE_SCALAR_PARAM });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).code).toBe('INVALID_ARGUMENT');
      expect((error as CliError).suggestion).toContain('testQuery(username: string)');
    });
  });

  describe('JSON array form', () => {
    it('spreads positionally', () => {
      expect(resolveCliFirestoreQueryArgs({ entry: TWO_POSITIONAL, params: '["a", 5]' })).toEqual(['a', 5]);
    });

    it('accepts fewer than the total when the tail is optional', () => {
      expect(resolveCliFirestoreQueryArgs({ entry: TWO_POSITIONAL, params: '["a"]' })).toEqual(['a']);
    });

    it('rejects too few arguments', () => {
      expect(() => resolveCliFirestoreQueryArgs({ entry: TWO_POSITIONAL, params: '[]' })).toThrow(CliError);
    });

    it('rejects too many arguments', () => {
      expect(() => resolveCliFirestoreQueryArgs({ entry: TWO_POSITIONAL, params: '["a", 5, true]' })).toThrow(CliError);
    });
  });

  describe('JSON object form', () => {
    it('passes the whole object as arg 0 for a single params-object factory', () => {
      expect(resolveCliFirestoreQueryArgs({ entry: ONE_OBJECT_PARAM, params: '{"published":true}' })).toEqual([{ published: true }]);
    });

    it('binds by name when the object key set is exactly the single param name', () => {
      expect(resolveCliFirestoreQueryArgs({ entry: ONE_SCALAR_PARAM, params: '{"username":"bob"}' })).toEqual(['bob']);
    });

    it('maps by name into positional order for a multi-param factory', () => {
      expect(resolveCliFirestoreQueryArgs({ entry: TWO_POSITIONAL, params: '{"limit":5,"state":"a"}' })).toEqual(['a', 5]);
    });

    it('rejects an unknown key, listing the accepted names', () => {
      let error: unknown;
      try {
        resolveCliFirestoreQueryArgs({ entry: TWO_POSITIONAL, params: '{"state":"a","nope":1}' });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('"nope"');
      expect((error as CliError).suggestion).toContain('state, limit');
    });

    it('rejects a missing required name', () => {
      expect(() => resolveCliFirestoreQueryArgs({ entry: TWO_POSITIONAL, params: '{"limit":5}' })).toThrow(CliError);
    });
  });

  it('fails with a quoted parse error on unparseable JSON', () => {
    let error: unknown;
    try {
      resolveCliFirestoreQueryArgs({ entry: ONE_OBJECT_PARAM, params: '{published:true}' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).message).toContain('{published:true}');
  });

  describe('date coercion', () => {
    it('coerces a top-level Date param from a string', () => {
      const [value] = resolveCliFirestoreQueryArgs({ entry: DATE_PARAM, params: '["2026-08-19T12:00:00Z"]' });
      expect(value).toBeInstanceOf(Date);
      expect((value as Date).toISOString()).toBe('2026-08-19T12:00:00.000Z');
    });

    it('coerces a Maybe<Date> param', () => {
      const [value] = resolveCliFirestoreQueryArgs({ entry: MAYBE_DATE_PARAM, params: '["2026-08-19"]' });
      expect(value).toBeInstanceOf(Date);
    });

    it('fails on an unparsable date for a date-typed param', () => {
      expect(() => resolveCliFirestoreQueryArgs({ entry: DATE_PARAM, params: '["not-a-date"]' })).toThrow(CliError);
    });

    it('coerces a strict ISO datetime nested inside an object param', () => {
      const [value] = resolveCliFirestoreQueryArgs({ entry: NESTED_OBJECT_PARAM, params: '{"before":"2026-08-19T12:00:00Z"}' });
      expect((value as { before: unknown }).before).toBeInstanceOf(Date);
    });

    it('leaves a bare YYYY-MM-DD nested string alone', () => {
      const [value] = resolveCliFirestoreQueryArgs({ entry: NESTED_OBJECT_PARAM, params: '{"day":"2026-08-19"}' });
      expect((value as { day: unknown }).day).toBe('2026-08-19');
    });

    it('leaves a nested non-date string alone', () => {
      const [value] = resolveCliFirestoreQueryArgs({ entry: NESTED_OBJECT_PARAM, params: '{"name":"bob"}' });
      expect((value as { name: unknown }).name).toBe('bob');
    });

    it('applies no coercion at all under rawParams', () => {
      const [top] = resolveCliFirestoreQueryArgs({ entry: DATE_PARAM, params: '["2026-08-19T12:00:00Z"]', rawParams: true });
      expect(top).toBe('2026-08-19T12:00:00Z');

      const [nested] = resolveCliFirestoreQueryArgs({ entry: NESTED_OBJECT_PARAM, params: '{"before":"2026-08-19T12:00:00Z"}', rawParams: true });
      expect((nested as { before: unknown }).before).toBe('2026-08-19T12:00:00Z');
    });
  });
});
