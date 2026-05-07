import { type ZohoCliConfig, type ZohoCliResolvedProductCredentials, getTokenCachePath, resolveProductCredentials } from '../config/cli.config';
import { ZohoAccountsApi, ZohoRecruitApi, ZohoCrmApi, ZohoDeskApi, type ZohoAccountsServiceConfig, type ZohoRecruitServiceConfig, type ZohoCrmServiceConfig, type ZohoDeskServiceConfig, memoryZohoAccountsAccessTokenCacheService, fileZohoAccountsAccessTokenCacheService, mergeZohoAccountsAccessTokenCacheServices } from '@dereekb/zoho/nestjs';
import type { Maybe } from '@dereekb/util';

export interface ZohoCliContext {
  readonly recruitApi: Maybe<ZohoRecruitApi>;
  readonly crmApi: Maybe<ZohoCrmApi>;
  readonly deskApi: Maybe<ZohoDeskApi>;
}

/**
 * Cache of ZohoAccountsApi instances keyed by credential identity.
 * When multiple products share the same clientId+refreshToken, they reuse the same accounts API.
 *
 * @param creds - Resolved product credentials whose identity is used to derive the cache key.
 * @returns A `clientId:refreshToken` string used as the deduplication key for accounts-API caching.
 */
function credentialKey(creds: ZohoCliResolvedProductCredentials): string {
  return `${creds.clientId}:${creds.refreshToken}`;
}

/**
 * Constructs the per-invocation {@link ZohoCliContext} containing the Recruit, CRM, and Desk API clients that the user has credentials for.
 *
 * Shares a single token cache (memory + on-disk JSON) across all products and reuses one {@link ZohoAccountsApi} per unique `clientId:refreshToken` pair so token refreshes don't multiply across products.
 *
 * @param config - Loaded CLI configuration; products without resolvable credentials produce `undefined` API entries on the returned context.
 * @returns A {@link ZohoCliContext} with `recruitApi`/`crmApi`/`deskApi` populated only for configured products.
 */
export function createCliContext(config: ZohoCliConfig): ZohoCliContext {
  const cacheService = mergeZohoAccountsAccessTokenCacheServices([memoryZohoAccountsAccessTokenCacheService(), fileZohoAccountsAccessTokenCacheService(getTokenCachePath())]);

  const accountsApiCache = new Map<string, ZohoAccountsApi>();

  function getAccountsApi(creds: ZohoCliResolvedProductCredentials, serviceKey: string): ZohoAccountsApi {
    const key = credentialKey(creds);
    const existing = accountsApiCache.get(key);

    if (existing) {
      return existing;
    }

    const accountsConfig: ZohoAccountsServiceConfig = {
      zohoAccounts: {
        serviceAccessTokenKey: serviceKey,
        refreshToken: creds.refreshToken,
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        apiUrl: creds.region ?? 'us'
      }
    };

    const api = new ZohoAccountsApi(accountsConfig, cacheService);
    accountsApiCache.set(key, api);
    return api;
  }

  // Recruit
  let recruitApi: Maybe<ZohoRecruitApi>;
  const recruitCreds = resolveProductCredentials(config, 'recruit');

  if (recruitCreds) {
    const accountsApi = getAccountsApi(recruitCreds, 'recruit');
    const recruitConfig = { zohoRecruit: { apiUrl: recruitCreds.apiMode } } as ZohoRecruitServiceConfig;
    recruitApi = new ZohoRecruitApi(recruitConfig, accountsApi);
  }

  // CRM
  let crmApi: Maybe<ZohoCrmApi>;
  const crmCreds = resolveProductCredentials(config, 'crm');

  if (crmCreds) {
    const accountsApi = getAccountsApi(crmCreds, 'crm');
    const crmConfig = { zohoCrm: { apiUrl: crmCreds.apiMode } } as ZohoCrmServiceConfig;
    crmApi = new ZohoCrmApi(crmConfig, accountsApi);
  }

  // Desk
  let deskApi: Maybe<ZohoDeskApi>;
  const deskCreds = resolveProductCredentials(config, 'desk');

  if (deskCreds?.orgId) {
    const accountsApi = getAccountsApi(deskCreds, 'desk');
    const deskConfig = { zohoDesk: { apiUrl: deskCreds.apiMode, orgId: deskCreds.orgId } } as ZohoDeskServiceConfig;
    deskApi = new ZohoDeskApi(deskConfig, accountsApi);
  }

  return { recruitApi, crmApi, deskApi };
}
