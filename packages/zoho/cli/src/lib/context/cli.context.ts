import { type ZohoCliConfig, type ZohoCliProduct, type ZohoCliResolvedProductCredentials, getTokenCachePath, resolveProductCredentials, zohoCliProductOrgId } from '../config/cli.config';
import { type ZohoCliResolvedTokenSource, zohoCliTokenSourceTokenRefresher } from '../config/token.source';
import {
  ZohoAccountsApi,
  ZohoRecruitApi,
  ZohoCrmApi,
  ZohoDeskApi,
  ZohoSignApi,
  ZohoAnalyticsApi,
  type ZohoAccountsServiceConfig,
  type ZohoRecruitServiceConfig,
  type ZohoCrmServiceConfig,
  type ZohoDeskServiceConfig,
  type ZohoSignServiceConfig,
  type ZohoAnalyticsServiceConfig,
  memoryZohoAccountsAccessTokenCacheService,
  fileZohoAccountsAccessTokenCacheService,
  mergeZohoAccountsAccessTokenCacheServices
} from '@dereekb/zoho/nestjs';
import { zohoProductConfigApiUrlForDatacenter } from '@dereekb/zoho';
import type { Maybe } from '@dereekb/util';

export interface ZohoCliContext {
  readonly recruitApi: Maybe<ZohoRecruitApi>;
  readonly crmApi: Maybe<ZohoCrmApi>;
  readonly deskApi: Maybe<ZohoDeskApi>;
  readonly signApi: Maybe<ZohoSignApi>;
  readonly analyticsApi: Maybe<ZohoAnalyticsApi>;
  /**
   * The active token source the context was built with, if any. The products it covers authenticate
   * through it instead of their own credentials.
   */
  readonly tokenSource?: Maybe<ZohoCliResolvedTokenSource>;
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
 * How one product's API client is built: the accounts API that supplies its tokens, its API url, and its org id.
 */
interface ZohoCliProductApiSetup {
  readonly accountsApi: ZohoAccountsApi;
  readonly apiUrl: string;
  readonly orgId: Maybe<string>;
}

/**
 * Constructs the per-invocation {@link ZohoCliContext} containing the Recruit, CRM, Desk, Sign, and Analytics API clients that the user has credentials for.
 *
 * Shares a single token cache (memory + on-disk JSON) across all products and reuses one {@link ZohoAccountsApi} per unique `clientId:refreshToken` pair so token refreshes don't multiply across products. Sign uses a dedicated OAuth client, so it naturally gets its own cached accounts API keyed by its distinct `clientId:refreshToken`.
 *
 * When a token source is given, every product its token covers is built through ONE accounts API whose
 * `tokenRefresher` is the token source — overriding that product's own credentials — with its API url
 * for the token's datacenter and its org id from the config, else the token source's hints. Products
 * the token does not cover keep their own credentials. The token-source accounts API keeps its tokens
 * in memory only: the token source caches them itself, and the per-product entries of the token file
 * stay those of the products' own credentials.
 *
 * @param config - Loaded CLI configuration; products without resolvable credentials produce `undefined` API entries on the returned context.
 * @param tokenSource - The active token source, resolved, when one is active.
 * @returns A {@link ZohoCliContext} with `recruitApi`/`crmApi`/`deskApi`/`signApi`/`analyticsApi` populated only for configured products.
 */
export function createCliContext(config: ZohoCliConfig, tokenSource?: Maybe<ZohoCliResolvedTokenSource>): ZohoCliContext {
  const cacheService = mergeZohoAccountsAccessTokenCacheServices([memoryZohoAccountsAccessTokenCacheService(), fileZohoAccountsAccessTokenCacheService(getTokenCachePath())]);

  const accountsApiCache = new Map<string, ZohoAccountsApi>();
  let tokenSourceAccountsApi: Maybe<ZohoAccountsApi>;

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

  function getTokenSourceAccountsApi(resolved: ZohoCliResolvedTokenSource): ZohoAccountsApi {
    if (!tokenSourceAccountsApi) {
      const accountsConfig: ZohoAccountsServiceConfig = {
        zohoAccounts: {
          serviceAccessTokenKey: 'tokenSource',
          refreshToken: '',
          clientId: '',
          clientSecret: '',
          apiUrl: resolved.datacenter,
          tokenRefresher: zohoCliTokenSourceTokenRefresher(resolved.source)
        }
      };

      tokenSourceAccountsApi = new ZohoAccountsApi(accountsConfig, memoryZohoAccountsAccessTokenCacheService());
    }

    return tokenSourceAccountsApi;
  }

  function productApiSetup(product: ZohoCliProduct): Maybe<ZohoCliProductApiSetup> {
    let result: Maybe<ZohoCliProductApiSetup>;

    if (tokenSource?.products.includes(product)) {
      result = {
        accountsApi: getTokenSourceAccountsApi(tokenSource),
        apiUrl: zohoProductConfigApiUrlForDatacenter({ product, datacenter: tokenSource.datacenter }),
        orgId: zohoCliProductOrgId({ config, product, tokenSource })
      };
    } else {
      const creds = resolveProductCredentials(config, product);

      if (creds) {
        result = { accountsApi: getAccountsApi(creds, product), apiUrl: creds.apiMode, orgId: zohoCliProductOrgId({ config, product }) };
      }
    }

    return result;
  }

  // Recruit
  let recruitApi: Maybe<ZohoRecruitApi>;
  const recruitSetup = productApiSetup('recruit');

  if (recruitSetup) {
    const recruitConfig = { zohoRecruit: { apiUrl: recruitSetup.apiUrl } } as ZohoRecruitServiceConfig;
    recruitApi = new ZohoRecruitApi(recruitConfig, recruitSetup.accountsApi);
  }

  // CRM
  let crmApi: Maybe<ZohoCrmApi>;
  const crmSetup = productApiSetup('crm');

  if (crmSetup) {
    const crmConfig = { zohoCrm: { apiUrl: crmSetup.apiUrl } } as ZohoCrmServiceConfig;
    crmApi = new ZohoCrmApi(crmConfig, crmSetup.accountsApi);
  }

  // Desk (every request is org-scoped, so no client without an org id)
  let deskApi: Maybe<ZohoDeskApi>;
  const deskSetup = productApiSetup('desk');

  if (deskSetup?.orgId) {
    const deskConfig = { zohoDesk: { apiUrl: deskSetup.apiUrl, orgId: deskSetup.orgId } } as ZohoDeskServiceConfig;
    deskApi = new ZohoDeskApi(deskConfig, deskSetup.accountsApi);
  }

  // Sign (dedicated OAuth client — resolveProductCredentials requires its own credentials)
  let signApi: Maybe<ZohoSignApi>;
  const signSetup = productApiSetup('sign');

  if (signSetup) {
    const signConfig = { zohoSign: { apiUrl: signSetup.apiUrl } } as ZohoSignServiceConfig;
    signApi = new ZohoSignApi(signConfig, signSetup.accountsApi);
  }

  // Analytics (dedicated OAuth client — resolveProductCredentials requires its own credentials; the org id may be found on demand)
  let analyticsApi: Maybe<ZohoAnalyticsApi>;
  const analyticsSetup = productApiSetup('analytics');

  if (analyticsSetup) {
    const analyticsConfig = { zohoAnalytics: { apiUrl: analyticsSetup.apiUrl, orgId: analyticsSetup.orgId } } as ZohoAnalyticsServiceConfig;
    analyticsApi = new ZohoAnalyticsApi(analyticsConfig, analyticsSetup.accountsApi);
  }

  return { recruitApi, crmApi, deskApi, signApi, analyticsApi, tokenSource };
}
