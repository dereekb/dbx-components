import { type ZohoCliConfig, type ZohoCliProduct, type ZohoCliResolvedProductCredentials, getTokenCachePath, resolveProductCredentials, zohoCliProductOrgId } from '../config/cli.config';
import { type ZohoCliResolvedTokenSource, zohoCliTokenSourceTokenRefresher } from '../config/token.source';
import { zohoCliServerErrorLogger } from '../util/output';
import { type ZohoAccessTokenCache, type ZohoAccounts, type ZohoAnalyticsContext, type ZohoCrmContext, type ZohoDeskContext, type ZohoRecruitContext, type ZohoSignContext, memoryZohoAccountsAccessTokenCacheService, mergeZohoAccountsAccessTokenCacheServices, zohoAccountsFactory, zohoAnalyticsFactory, zohoCrmFactory, zohoDeskFactory, zohoProductConfigApiUrlForDatacenter, zohoRecruitFactory, zohoSignFactory } from '@dereekb/zoho';
import { fileZohoAccountsAccessTokenCacheService } from '@dereekb/zoho/node';
import type { Maybe } from '@dereekb/util';

/**
 * Lookup from every {@link ZohoCliProduct} to the {@link ZohoAccounts} client that mints that product's tokens,
 * `undefined` when the product is unconfigured.
 */
export type ZohoCliProductAccounts = Readonly<Record<ZohoCliProduct, Maybe<ZohoAccounts>>>;

export interface ZohoCliContext {
  readonly recruitContext: Maybe<ZohoRecruitContext>;
  readonly crmContext: Maybe<ZohoCrmContext>;
  readonly deskContext: Maybe<ZohoDeskContext>;
  readonly signContext: Maybe<ZohoSignContext>;
  readonly analyticsContext: Maybe<ZohoAnalyticsContext>;
  /**
   * The accounts client minting each built product's token; products on one grant (or the token source) share one.
   *
   * Every product in `ZOHO_CLI_PRODUCTS` MUST appear here, paired with its own client. The `Record<ZohoCliProduct, ...>`
   * type is the enforcement: a product added to the union but left out fails to compile. This replaced an if/else chain
   * that had no such check, under which `analytics` fell through to the desk branch — `auth check` and `doctor` reported
   * Desk's granted scope under the `analytics` key (or `Not configured` when desk had no credentials) while the analytics
   * credentials were never exercised at all.
   */
  readonly productAccounts: ZohoCliProductAccounts;
  /**
   * The active token source the context was built with, if any. The products it covers authenticate
   * through it instead of their own credentials.
   */
  readonly tokenSource?: Maybe<ZohoCliResolvedTokenSource>;
  /**
   * Clears the cached access tokens behind the given products (memory + `~/.zoho-cli/.tokens.json`, or the token source's
   * entry), so the next run mints a new token after Zoho rejected one. Never throws.
   *
   * @param products - The products whose tokens Zoho rejected.
   */
  resetCachedTokens(products: readonly ZohoCliProduct[]): Promise<void>;
}

/**
 * Cache of ZohoAccounts instances keyed by credential identity.
 * When multiple products share the same clientId+refreshToken, they reuse the same accounts client.
 *
 * @param creds - Resolved product credentials whose identity is used to derive the cache key.
 * @returns A `clientId:refreshToken` string used as the deduplication key for accounts-client caching.
 */
function credentialKey(creds: ZohoCliResolvedProductCredentials): string {
  return `${creds.clientId}:${creds.refreshToken}`;
}

/**
 * One accounts client the context built, with the token cache it was given.
 */
interface ZohoCliAccountsHolder {
  readonly zohoAccounts: ZohoAccounts;
  /**
   * The memory + file cache of an own-credential grant. Undefined for the token-source client, whose `resetAccessToken()`
   * already clears its cache and the token source's entry.
   */
  readonly ownAccessTokenCache?: Maybe<ZohoAccessTokenCache>;
}

/**
 * How one product's client is built: the accounts client that supplies its tokens, its API url, and its org id.
 */
interface ZohoCliProductSetup {
  readonly accounts: ZohoCliAccountsHolder;
  readonly apiUrl: string;
  readonly orgId: Maybe<string>;
}

/**
 * Constructs the per-invocation {@link ZohoCliContext} containing the Recruit, CRM, Desk, Sign, and Analytics contexts that the user has credentials for.
 *
 * Built straight from the framework-agnostic `@dereekb/zoho` factories (no NestJS), like msgraph-cli and trello-cli. Shares a single token cache (memory + on-disk JSON) across all products and reuses one accounts client per unique `clientId:refreshToken` pair so token refreshes don't multiply across products. Sign uses a dedicated OAuth client, so it naturally gets its own cached accounts client keyed by its distinct `clientId:refreshToken`.
 *
 * When a token source is given, every product its token covers is built through ONE accounts client whose
 * `tokenRefresher` is the token source — overriding that product's own credentials — with its API url
 * for the token's datacenter and the source's api mode (production, or the product's sandbox), and
 * its org id from the config, else the token source's hints. Products
 * the token does not cover keep their own credentials. The token-source accounts client keeps its tokens
 * in memory only: the token source caches them itself, and the per-product entries of the token file
 * stay those of the products' own credentials.
 *
 * Every factory gets {@link zohoCliServerErrorLogger}, so a Zoho error never prints the library's stdout dump.
 *
 * @param config - Loaded CLI configuration; products without resolvable credentials produce `undefined` context entries on the returned context.
 * @param tokenSource - The active token source, resolved, when one is active.
 * @returns A {@link ZohoCliContext} with `recruitContext`/`crmContext`/`deskContext`/`signContext`/`analyticsContext` populated only for configured products.
 */
export function createCliContext(config: ZohoCliConfig, tokenSource?: Maybe<ZohoCliResolvedTokenSource>): ZohoCliContext {
  const cacheService = mergeZohoAccountsAccessTokenCacheServices([memoryZohoAccountsAccessTokenCacheService(), fileZohoAccountsAccessTokenCacheService(getTokenCachePath())]);
  const accountsFactory = zohoAccountsFactory({ logZohoServerErrorFunction: zohoCliServerErrorLogger('accounts') });

  const accountsCache = new Map<string, ZohoCliAccountsHolder>();
  let tokenSourceAccounts: Maybe<ZohoCliAccountsHolder>;

  function getAccounts(creds: ZohoCliResolvedProductCredentials, serviceKey: string): ZohoCliAccountsHolder {
    const key = credentialKey(creds);
    let holder = accountsCache.get(key);

    if (!holder) {
      const accessTokenCache = cacheService.loadZohoAccessTokenCache(serviceKey);
      const zohoAccounts = accountsFactory({
        accessTokenCache,
        refreshToken: creds.refreshToken,
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        apiUrl: creds.region ?? 'us'
      });

      holder = { zohoAccounts, ownAccessTokenCache: accessTokenCache };
      accountsCache.set(key, holder);
    }

    return holder;
  }

  function getTokenSourceAccounts(resolved: ZohoCliResolvedTokenSource): ZohoCliAccountsHolder {
    if (!tokenSourceAccounts) {
      const zohoAccounts = accountsFactory({
        accessTokenCache: memoryZohoAccountsAccessTokenCacheService().loadZohoAccessTokenCache('tokenSource'),
        refreshToken: '',
        clientId: '',
        clientSecret: '',
        apiUrl: resolved.datacenter,
        tokenRefresher: zohoCliTokenSourceTokenRefresher(resolved.source)
      });

      tokenSourceAccounts = { zohoAccounts };
    }

    return tokenSourceAccounts;
  }

  function productSetup(product: ZohoCliProduct): Maybe<ZohoCliProductSetup> {
    let result: Maybe<ZohoCliProductSetup>;

    if (tokenSource?.products.includes(product)) {
      result = {
        accounts: getTokenSourceAccounts(tokenSource),
        apiUrl: zohoProductConfigApiUrlForDatacenter({ product, datacenter: tokenSource.datacenter, mode: tokenSource.source.apiMode }),
        orgId: zohoCliProductOrgId({ config, product, tokenSource })
      };
    } else {
      const creds = resolveProductCredentials(config, product);

      if (creds) {
        result = { accounts: getAccounts(creds, product), apiUrl: creds.apiMode, orgId: zohoCliProductOrgId({ config, product }) };
      }
    }

    return result;
  }

  // Recruit
  let recruitContext: Maybe<ZohoRecruitContext>;
  const recruitSetup = productSetup('recruit');

  if (recruitSetup) {
    recruitContext = zohoRecruitFactory({ accountsContext: recruitSetup.accounts.zohoAccounts.accountsContext, logZohoServerErrorFunction: zohoCliServerErrorLogger('recruit') })({ apiUrl: recruitSetup.apiUrl }).recruitContext;
  }

  // CRM
  let crmContext: Maybe<ZohoCrmContext>;
  const crmSetup = productSetup('crm');

  if (crmSetup) {
    crmContext = zohoCrmFactory({ accountsContext: crmSetup.accounts.zohoAccounts.accountsContext, logZohoServerErrorFunction: zohoCliServerErrorLogger('crm') })({ apiUrl: crmSetup.apiUrl }).crmContext;
  }

  // Desk (every request is org-scoped, so no client without an org id)
  let deskContext: Maybe<ZohoDeskContext>;
  const deskSetup = productSetup('desk');
  const deskOrgId = deskSetup?.orgId;

  if (deskSetup && deskOrgId) {
    deskContext = zohoDeskFactory({ accountsContext: deskSetup.accounts.zohoAccounts.accountsContext, logZohoServerErrorFunction: zohoCliServerErrorLogger('desk') })({ apiUrl: deskSetup.apiUrl, orgId: deskOrgId }).deskContext;
  }

  // Sign (dedicated OAuth client — resolveProductCredentials requires its own credentials)
  let signContext: Maybe<ZohoSignContext>;
  const signSetup = productSetup('sign');

  if (signSetup) {
    signContext = zohoSignFactory({ accountsContext: signSetup.accounts.zohoAccounts.accountsContext, logZohoServerErrorFunction: zohoCliServerErrorLogger('sign') })({ apiUrl: signSetup.apiUrl }).signContext;
  }

  // Analytics (dedicated OAuth client — resolveProductCredentials requires its own credentials; the org id may be found on demand)
  let analyticsContext: Maybe<ZohoAnalyticsContext>;
  const analyticsSetup = productSetup('analytics');

  if (analyticsSetup) {
    analyticsContext = zohoAnalyticsFactory({ accountsContext: analyticsSetup.accounts.zohoAccounts.accountsContext, logZohoServerErrorFunction: zohoCliServerErrorLogger('analytics') })({ apiUrl: analyticsSetup.apiUrl, orgId: analyticsSetup.orgId }).analyticsContext;
  }

  // the accounts holder behind each BUILT product client (desk without an org id has no client, so nothing to report)
  const productHolders: Readonly<Record<ZohoCliProduct, Maybe<ZohoCliAccountsHolder>>> = {
    recruit: recruitSetup?.accounts,
    crm: crmSetup?.accounts,
    desk: deskContext ? deskSetup?.accounts : undefined,
    sign: signSetup?.accounts,
    analytics: analyticsSetup?.accounts
  };

  const productAccounts: ZohoCliProductAccounts = {
    recruit: productHolders.recruit?.zohoAccounts,
    crm: productHolders.crm?.zohoAccounts,
    desk: productHolders.desk?.zohoAccounts,
    sign: productHolders.sign?.zohoAccounts,
    analytics: productHolders.analytics?.zohoAccounts
  };

  async function resetCachedTokens(products: readonly ZohoCliProduct[]): Promise<void> {
    const holders = new Set<ZohoCliAccountsHolder>();

    for (const product of products) {
      const holder = productHolders[product];

      if (holder) {
        holders.add(holder);
      }
    }

    // sequential: the keyed file cache rewrites the whole .tokens.json on each write, so concurrent removals can lose one
    for (const holder of holders) {
      try {
        // on the token-source client this clears memory and calls source.resetToken(), which removes its file entry
        await holder.zohoAccounts.accountsContext.loadAccessToken.resetAccessToken();

        // an own-credential grant's reset only drops the in-memory token, so clear its memory + file cache entry too
        if (holder.ownAccessTokenCache) {
          await holder.ownAccessTokenCache.clearCachedToken();
        }
      } catch {
        // best effort: the failure being reported matters more than a failed cleanup
      }
    }
  }

  return { recruitContext, crmContext, deskContext, signContext, analyticsContext, productAccounts, tokenSource, resetCachedTokens };
}
