import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { fetchApiFetchService } from '@dereekb/util/fetch';
import { DEFAULT_ZOOM_FETCH_TIMEOUT } from './zoom.config';
import { zoomFactory } from './zoom/zoom.factory';
import { zoomOAuthFactory } from './oauth/oauth.factory';
import { type ZoomOAuthContext } from './oauth/oauth.config';

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
 * zoomFactory only reads the context's loadAccessToken when a request is sent, which these specs never do.
 */
const oauthContext = {
  loadAccessToken: () => Promise.reject(new Error('not called'))
} as unknown as ZoomOAuthContext;

const FACTORY_CASES: TimeoutFactoryCase[] = [
  {
    name: 'zoomFactory',
    build: (config) => zoomFactory({ ...config, oauthContext })({})
  },
  {
    name: 'zoomOAuthFactory',
    build: (config) => zoomOAuthFactory(config)({ clientId: 'test-client-id', clientSecret: 'test-client-secret', accountId: 'test-account-id' })
  }
];

describe('zoom fetch timeouts', () => {
  let makeFetchSpy: MockInstance<typeof fetchApiFetchService.makeFetch>;

  beforeEach(() => {
    makeFetchSpy = vi.spyOn(fetchApiFetchService, 'makeFetch');
  });

  afterEach(() => {
    makeFetchSpy.mockRestore();
  });

  it('keeps the default value', () => {
    expect(DEFAULT_ZOOM_FETCH_TIMEOUT).toBe(20_000);
  });

  describe.each(FACTORY_CASES)('$name', ({ build }) => {
    it('uses the default timeout when none is configured', () => {
      build({});
      expect(makeFetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ timeout: DEFAULT_ZOOM_FETCH_TIMEOUT, useTimeout: true }));
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
      expect(makeFetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ timeout: DEFAULT_ZOOM_FETCH_TIMEOUT, useTimeout: true }));
    });
  });
});
