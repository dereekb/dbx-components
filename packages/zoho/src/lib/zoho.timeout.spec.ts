import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { fetchApiFetchService } from '@dereekb/util/fetch';
import { DEFAULT_ZOHO_FETCH_TIMEOUT } from './zoho.config';
import { zohoAccountsFactory, zohoAccountsOAuthClientFactory } from './accounts/accounts.factory';
import { type ZohoAccountsContext } from './accounts/accounts.config';
import { zohoCrmFactory } from './crm/crm.factory';
import { zohoRecruitFactory } from './recruit/recruit.factory';
import { zohoSignFactory } from './sign/sign.factory';
import { zohoDeskFactory } from './desk/desk.factory';
import { zohoAnalyticsFactory } from './analytics/analytics.factory';

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
 * The service factories only read the context's loadAccessToken when a request is sent, which these specs never do.
 */
const accountsContext = {
  loadAccessToken: () => Promise.reject(new Error('not called'))
} as unknown as ZohoAccountsContext;

const FACTORY_CASES: TimeoutFactoryCase[] = [
  {
    name: 'zohoAccountsFactory',
    build: (config) => zohoAccountsFactory(config)({ refreshToken: 'token', clientId: 'id', clientSecret: 'secret' })
  },
  {
    name: 'zohoAccountsOAuthClientFactory',
    build: (config) => zohoAccountsOAuthClientFactory(config)({ clientId: 'id', clientSecret: 'secret' })
  },
  {
    name: 'zohoCrmFactory',
    build: (config) => zohoCrmFactory({ ...config, accountsContext })({ apiUrl: 'sandbox' })
  },
  {
    name: 'zohoRecruitFactory',
    build: (config) => zohoRecruitFactory({ ...config, accountsContext })({ apiUrl: 'sandbox' })
  },
  {
    name: 'zohoSignFactory',
    build: (config) => zohoSignFactory({ ...config, accountsContext })({ apiUrl: 'sandbox' })
  },
  {
    name: 'zohoDeskFactory',
    build: (config) => zohoDeskFactory({ ...config, accountsContext })({ apiUrl: 'sandbox', orgId: 'org' })
  },
  {
    name: 'zohoAnalyticsFactory',
    build: (config) => zohoAnalyticsFactory({ ...config, accountsContext })({ apiUrl: 'sandbox', orgId: 'org' })
  }
];

describe('zoho fetch timeouts', () => {
  let makeFetchSpy: MockInstance<typeof fetchApiFetchService.makeFetch>;

  beforeEach(() => {
    makeFetchSpy = vi.spyOn(fetchApiFetchService, 'makeFetch');
  });

  afterEach(() => {
    makeFetchSpy.mockRestore();
  });

  it('keeps the default value', () => {
    expect(DEFAULT_ZOHO_FETCH_TIMEOUT).toBe(20_000);
  });

  describe.each(FACTORY_CASES)('$name', ({ build }) => {
    it('uses the default timeout when none is configured', () => {
      build({});
      expect(makeFetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ timeout: DEFAULT_ZOHO_FETCH_TIMEOUT, useTimeout: true }));
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
      expect(makeFetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ timeout: DEFAULT_ZOHO_FETCH_TIMEOUT, useTimeout: true }));
    });
  });
});
