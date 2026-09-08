import { MS_IN_HOUR } from '@dereekb/util';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CLI_DATA_CACHE_MAX_AGE_HOURS, checkCliDataCacheArgv, resolveCliDataCacheOptions } from './data-cache.options';

describe('resolveCliDataCacheOptions()', () => {
  it('records but does not read when no flag is passed', () => {
    // the whole opt-in posture: "when was this last built" is always accurate, and no plain command
    // ever hands back data that is not live
    expect(resolveCliDataCacheOptions({})).toEqual({ read: false, write: true });
  });

  it('reads with the default window for a bare --cache', () => {
    // yargs hands a bare `--cache` back as an empty string
    expect(resolveCliDataCacheOptions({ cache: '' })).toEqual({ read: true, write: true, maxAgeMs: DEFAULT_CLI_DATA_CACHE_MAX_AGE_HOURS * MS_IN_HOUR });
  });

  it('reads with an explicit window for --cache=<hours>', () => {
    expect(resolveCliDataCacheOptions({ cache: '6' })).toEqual({ read: true, write: true, maxAgeMs: 6 * MS_IN_HOUR });
  });

  it('accepts a fractional window', () => {
    expect(resolveCliDataCacheOptions({ cache: '0.5' })).toEqual({ read: true, write: true, maxAgeMs: 0.5 * MS_IN_HOUR });
  });

  it('treats --cache=0 as any age, mirroring --timeout 0', () => {
    expect(resolveCliDataCacheOptions({ cache: '0' })).toEqual({ read: true, write: true, maxAgeMs: undefined });
  });

  it('neither reads nor records for --no-cache', () => {
    // yargs boolean negation lands `--no-cache` on the same key as `false`
    expect(resolveCliDataCacheOptions({ cache: false })).toEqual({ read: false, write: false });
  });

  it('lets --refresh beat --cache, so a script that always caches can still be forced fresh', () => {
    expect(resolveCliDataCacheOptions({ cache: '6', refresh: true })).toEqual({ read: false, write: true });
  });
});

describe('checkCliDataCacheArgv()', () => {
  it('passes on the accepted shapes', () => {
    expect(checkCliDataCacheArgv({})).toBe(true);
    expect(checkCliDataCacheArgv({ cache: '' })).toBe(true);
    expect(checkCliDataCacheArgv({ cache: '12' })).toBe(true);
    expect(checkCliDataCacheArgv({ cache: false })).toBe(true);
  });

  it('rejects a non-numeric value, which is what a swallowed positional looks like', () => {
    // `firestore-query --cache workers-query` parses the slug INTO --cache; failing loudly here is
    // the difference between a clear message and a mysteriously empty result
    expect(() => checkCliDataCacheArgv({ cache: 'workers-query' })).toThrow(/--cache takes an optional number of hours/);
  });

  it('rejects a negative window', () => {
    expect(() => checkCliDataCacheArgv({ cache: '-1' })).toThrow(/--cache takes an optional number of hours/);
  });
});
