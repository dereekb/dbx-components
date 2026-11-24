import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { fetchApiFetchService, type ConfiguredFetch } from '@dereekb/util/fetch';
import { DEFAULT_CALCOM_FETCH_TIMEOUT } from './calcom.config';
import { calcomFactory } from './calcom/calcom.factory';
import { calcomOAuthFactory } from './oauth/oauth.factory';
import { type CalcomOAuthContext } from './oauth/oauth.config';

interface TimeoutConfigInput {
  readonly timeout?: Maybe<Milliseconds>;
}

interface TimeoutFactoryCase {
  readonly name: string;
  /**
   * Builds the factory far enough for it to call fetchApiFetchService.makeFetch().
   */
  readonly build: (config: TimeoutConfigInput) => unknown;
}

/**
 * calcomFactory only reads the context's loadAccessToken when a request is sent, which these specs never do.
 */
const oauthContext = {
  loadAccessToken: () => Promise.reject(new Error('not called'))
} as unknown as CalcomOAuthContext;

/**
 * A fetch factory that stands in for the default authenticated fetch, without calling makeFetch().
 *
 * @returns A fetch that is never called.
 */
const customFetchFactory = () => (() => Promise.reject(new Error('not called'))) as unknown as ConfiguredFetch;

const FACTORY_CASES: TimeoutFactoryCase[] = [
  {
    name: 'calcomFactory',
    build: (config) => calcomFactory({ ...config, oauthContext })({})
  },
  {
    name: 'calcomFactory public context',
    build: (config) => calcomFactory({ ...config, oauthContext })({}).calcomServerContext.makePublicContext()
  },
  {
    name: 'calcomFactory public context with a custom fetchFactory',
    build: (config) => calcomFactory({ ...config, oauthContext, fetchFactory: customFetchFactory })({}).calcomServerContext.makePublicContext()
  },
  {
    name: 'calcomOAuthFactory',
    build: (config) => calcomOAuthFactory(config)({ client: { clientId: 'test-client-id', clientSecret: 'test-client-secret' } })
  }
];

describe('calcom fetch timeouts', () => {
  let makeFetchSpy: MockInstance<typeof fetchApiFetchService.makeFetch>;

  beforeEach(() => {
    makeFetchSpy = vi.spyOn(fetchApiFetchService, 'makeFetch');
  });

  afterEach(() => {
    makeFetchSpy.mockRestore();
  });

  it('keeps the default value', () => {
    expect(DEFAULT_CALCOM_FETCH_TIMEOUT).toBe(20_000);
  });

  describe.each(FACTORY_CASES)('$name', ({ build }) => {
    it('uses the default timeout when none is configured', () => {
      build({});
      expect(makeFetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ timeout: DEFAULT_CALCOM_FETCH_TIMEOUT, useTimeout: true }));
    });

    it('uses the configured timeout', () => {
      build({ timeout: 5_000 });
      expect(makeFetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ timeout: 5_000, useTimeout: true }));
    });

    it('passes a timeout of 0, which turns the timeout off', () => {
      build({ timeout: 0 });
      expect(makeFetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ timeout: 0, useTimeout: true }));
    });

    it('uses the default timeout when the timeout is null', () => {
      build({ timeout: null });
      expect(makeFetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ timeout: DEFAULT_CALCOM_FETCH_TIMEOUT, useTimeout: true }));
    });
  });

  it('times the default fetch and the public context with the same configured timeout', () => {
    const { calcomServerContext } = calcomFactory({ oauthContext, timeout: 7_000 })({});
    calcomServerContext.makePublicContext();

    expect(makeFetchSpy).toHaveBeenCalledTimes(2);
    expect(makeFetchSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ timeout: 7_000, useTimeout: true }));
    expect(makeFetchSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ timeout: 7_000, useTimeout: true }));
  });
});
