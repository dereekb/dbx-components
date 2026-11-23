import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { fetchApiFetchService } from '@dereekb/util/fetch';
import { DEFAULT_MICROSOFT_GRAPH_FETCH_TIMEOUT, DEFAULT_MICROSOFT_OAUTH_FETCH_TIMEOUT } from './microsoft.config';
import { microsoftGraphFactory } from './graph/graph.factory';
import { microsoftOAuthFactory } from './oauth/oauth.factory';

interface TimeoutConfigInput {
  readonly timeout?: Maybe<Milliseconds>;
}

interface TimeoutFactoryCase {
  readonly name: string;
  readonly defaultTimeout: Milliseconds;
  /**
   * Builds the factory far enough for it to call fetchApiFetchService.makeFetch().
   */
  readonly build: (config: TimeoutConfigInput) => unknown;
}

const FACTORY_CASES: TimeoutFactoryCase[] = [
  {
    name: 'microsoftGraphFactory',
    defaultTimeout: DEFAULT_MICROSOFT_GRAPH_FETCH_TIMEOUT,
    build: (config) => microsoftGraphFactory(config)
  },
  {
    name: 'microsoftOAuthFactory',
    defaultTimeout: DEFAULT_MICROSOFT_OAUTH_FETCH_TIMEOUT,
    build: (config) => microsoftOAuthFactory(config)({ tenantId: 'contoso.onmicrosoft.com', clientId: 'test-client-id', clientSecret: 'test-client-secret' })
  }
];

describe('microsoft fetch timeouts', () => {
  let makeFetchSpy: MockInstance<typeof fetchApiFetchService.makeFetch>;

  beforeEach(() => {
    makeFetchSpy = vi.spyOn(fetchApiFetchService, 'makeFetch');
  });

  afterEach(() => {
    makeFetchSpy.mockRestore();
  });

  it('keeps the default values', () => {
    expect(DEFAULT_MICROSOFT_OAUTH_FETCH_TIMEOUT).toBe(20_000);
    expect(DEFAULT_MICROSOFT_GRAPH_FETCH_TIMEOUT).toBe(30_000);
  });

  describe.each(FACTORY_CASES)('$name', ({ defaultTimeout, build }) => {
    it('uses the default timeout when none is configured', () => {
      build({});
      expect(makeFetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ timeout: defaultTimeout, useTimeout: true }));
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
      expect(makeFetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ timeout: defaultTimeout, useTimeout: true }));
    });
  });
});
