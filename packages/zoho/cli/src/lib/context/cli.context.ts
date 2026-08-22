import { type ZohoCliConfig, type ZohoCliProduct, type ZohoCliResolvedProductCredentials, getTokenCachePath, resolveProductCredentials } from '../config/cli.config';
import { ZohoAccountsApi, ZohoRecruitApi, ZohoCrmApi, ZohoDeskApi, ZohoSignApi, ZohoAnalyticsApi, type ZohoAccountsServiceConfig, type ZohoRecruitServiceConfig, type ZohoCrmServiceConfig, type ZohoDeskServiceConfig, type ZohoSignServiceConfig, type ZohoAnalyticsServiceConfig, memoryZohoAccountsAccessTokenCacheService, fileZohoAccountsAccessTokenCacheService, mergeZohoAccountsAccessTokenCacheServices } from '@dereekb/zoho/nestjs';
import type { Maybe } from '@dereekb/util';

export interface ZohoCliContext {
  readonly recruitApi: Maybe<ZohoRecruitApi>;
  readonly crmApi: Maybe<ZohoCrmApi>;
  readonly deskApi: Maybe<ZohoDeskApi>;
  readonly signApi: Maybe<ZohoSignApi>;
  readonly analyticsApi: Maybe<ZohoAnalyticsApi>;
}

/**
 * Any of the per-product API clients held by a {@link ZohoCliContext}.
 *
 * Every member exposes the {@link ZohoAccountsApi} that minted its token, so commands that only need
 * the OAuth grant (`auth check`, `doctor`) can read `zohoAccountsApi` off the union without a cast.
 */
export type ZohoCliProductApi = ZohoRecruitApi | ZohoCrmApi | ZohoDeskApi | ZohoSignApi | ZohoAnalyticsApi;

/**
 * Lookup from every {@link ZohoCliProduct} to its API client, `undefined` when unconfigured.
 */
export type ZohoCliProductApis = Record<ZohoCliProduct, Maybe<ZohoCliProductApi>>;

/**
 * Maps each {@link ZohoCliProduct} to the context API authenticated with that product's credentials.
 *
 * Every product in {@link ZOHO_CLI_PRODUCTS} MUST appear below, and must be paired with its own API.
 * The `Record<ZohoCliProduct, ...>` return type is the enforcement: a product added to the union but
 * left out here fails to compile. This replaced an if/else chain that had no such check, under which
 * `analytics` fell through to the desk branch — `auth check` and `doctor` reported Desk's granted
 * scope under the `analytics` key (or `Not configured` when desk had no credentials) while the
 * analytics credentials were never exercised at all.
 *
 * @param context - Per-invocation CLI context holding the configured product API clients.
 * @returns The product-keyed API lookup.
 */
export function toZohoCliProductApis(context: ZohoCliContext): ZohoCliProductApis {
  return {
    recruit: context.recruitApi,
    crm: context.crmApi,
    desk: context.deskApi,
    sign: context.signApi,
    analytics: context.analyticsApi
  };
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
 * Constructs the per-invocation {@link ZohoCliContext} containing the Recruit, CRM, Desk, Sign, and Analytics API clients that the user has credentials for.
 *
 * Shares a single token cache (memory + on-disk JSON) across all products and reuses one {@link ZohoAccountsApi} per unique `clientId:refreshToken` pair so token refreshes don't multiply across products. Sign uses a dedicated OAuth client, so it naturally gets its own cached accounts API keyed by its distinct `clientId:refreshToken`.
 *
 * @param config - Loaded CLI configuration; products without resolvable credentials produce `undefined` API entries on the returned context.
 * @returns A {@link ZohoCliContext} with `recruitApi`/`crmApi`/`deskApi`/`signApi`/`analyticsApi` populated only for configured products.
 */
export function createCliContext(config: ZohoCliConfig): ZohoCliContext {
  const cacheService = mergeZohoAccountsAccessTokenCacheServices([memoryZohoAccountsAccessTokenCacheService(), fileZohoAccountsAccessTokenCacheService(getTokenCachePath())]);

  const accountsApiCache = new Map<string, ZohoAccountsApi>();

  function getAccountsApi(creds: ZohoCliResolvedProductCredentials, serviceKey: string): ZohoAccountsApi {
    const key = credentialKey(creds);
    const existing = accountsApiCache.get(key);
    let api: ZohoAccountsApi;

    if (existing) {
      api = existing;
    } else {
      const accountsConfig: ZohoAccountsServiceConfig = {
        zohoAccounts: {
          serviceAccessTokenKey: serviceKey,
          refreshToken: creds.refreshToken,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          apiUrl: creds.region ?? 'us'
        }
      };

      api = new ZohoAccountsApi(accountsConfig, cacheService);
      accountsApiCache.set(key, api);
    }

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

  // Sign (dedicated OAuth client — resolveProductCredentials requires its own credentials)
  let signApi: Maybe<ZohoSignApi>;
  const signCreds = resolveProductCredentials(config, 'sign');

  if (signCreds) {
    const accountsApi = getAccountsApi(signCreds, 'sign');
    const signConfig = { zohoSign: { apiUrl: signCreds.apiMode } } as ZohoSignServiceConfig;
    signApi = new ZohoSignApi(signConfig, accountsApi);
  }

  // Analytics (dedicated OAuth client — resolveProductCredentials requires its own credentials)
  let analyticsApi: Maybe<ZohoAnalyticsApi>;
  const analyticsCreds = resolveProductCredentials(config, 'analytics');

  if (analyticsCreds) {
    const accountsApi = getAccountsApi(analyticsCreds, 'analytics');
    const analyticsConfig = { zohoAnalytics: { apiUrl: analyticsCreds.apiMode, orgId: analyticsCreds.orgId } } as ZohoAnalyticsServiceConfig;
    analyticsApi = new ZohoAnalyticsApi(analyticsConfig, accountsApi);
  }

  return { recruitApi, crmApi, deskApi, signApi, analyticsApi };
}
