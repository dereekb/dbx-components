import { type Maybe } from '@dereekb/util';
import { type ZohoApiUrl } from './zoho.config';
import { type ZohoAccessTokenScopesString, type ZohoDatacenterApiUrlInput, type ZohoOAuthScope, zohoOAuthScopesFromScopeString } from './accounts';
import { zohoCrmConfigApiUrlForDatacenter } from './crm/crm.config';
import { zohoRecruitConfigApiUrlForDatacenter } from './recruit/recruit.config';
import { zohoDeskConfigApiUrlForDatacenter } from './desk/desk.config';
import { zohoSignConfigApiUrlForDatacenter } from './sign/sign.config';
import { zohoAnalyticsConfigApiUrlForDatacenter } from './analytics/analytics.config';

/**
 * A Zoho product this package has an API client for.
 *
 * Each value matches the product's `ZOHO_*_SERVICE_NAME`.
 */
export type ZohoProduct = 'crm' | 'recruit' | 'desk' | 'sign' | 'analytics';

/**
 * Every {@link ZohoProduct}.
 */
export const ZOHO_PRODUCTS: readonly ZohoProduct[] = ['crm', 'recruit', 'desk', 'sign', 'analytics'];

/**
 * The OAuth scope namespace of each product, e.g. `ZohoCRM.modules.ALL` belongs to `crm`.
 */
export const ZOHO_PRODUCT_OAUTH_SCOPE_PREFIXES: Readonly<Record<ZohoProduct, string>> = {
  crm: 'ZohoCRM.',
  recruit: 'ZohoRecruit.',
  desk: 'Desk.',
  sign: 'ZohoSign.',
  analytics: 'ZohoAnalytics.'
};

/**
 * Returns the product an OAuth scope grants access to.
 *
 * Matches the scope's namespace from {@link ZOHO_PRODUCT_OAUTH_SCOPE_PREFIXES} case-insensitively.
 * Scopes that belong to no product client (e.g. `AaaServer.profile.READ`) yield undefined.
 *
 * @param scope - The scope to classify.
 * @returns The product, or undefined when the scope is not a product scope.
 *
 * @example
 * ```typescript
 * zohoProductForOAuthScope('ZohoCRM.modules.ALL'); // 'crm'
 * zohoProductForOAuthScope('AaaServer.profile.READ'); // undefined
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zohoProductForOAuthScope(scope: ZohoOAuthScope): Maybe<ZohoProduct> {
  const normalized = scope.trim().toLowerCase();
  return ZOHO_PRODUCTS.find((product) => normalized.startsWith(ZOHO_PRODUCT_OAUTH_SCOPE_PREFIXES[product].toLowerCase()));
}

/**
 * Returns the products a set of granted OAuth scopes covers.
 *
 * The reverse of choosing scopes per product: used to work out which product clients a token minted
 * elsewhere can be used for. A product is covered when ANY of its scopes is granted.
 *
 * @param scopes - The granted scopes, as a list or as Zoho's comma-delimited scope string.
 * @returns The covered products, unique and in {@link ZOHO_PRODUCTS} order.
 *
 * @example
 * ```typescript
 * zohoProductsForOAuthScopes(['ZohoCRM.modules.ALL', 'Desk.tickets.ALL']); // ['crm', 'desk']
 * zohoProductsForOAuthScopes('ZohoRecruit.modules.ALL,AaaServer.profile.READ'); // ['recruit']
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zohoProductsForOAuthScopes(scopes: Maybe<readonly ZohoOAuthScope[] | ZohoAccessTokenScopesString>): ZohoProduct[] {
  const scopeList = typeof scopes === 'string' ? (zohoOAuthScopesFromScopeString(scopes) ?? []) : (scopes ?? []);
  const covered = new Set<ZohoProduct>();

  scopeList.forEach((scope) => {
    const product = zohoProductForOAuthScope(scope);

    if (product != null) {
      covered.add(product);
    }
  });

  return ZOHO_PRODUCTS.filter((product) => covered.has(product));
}

/**
 * Input for {@link zohoProductConfigApiUrlForDatacenter}.
 */
export interface ZohoProductConfigApiUrlForDatacenterInput extends ZohoDatacenterApiUrlInput {
  readonly product: ZohoProduct;
}

/**
 * Resolves a product's API URL for a datacenter and mode, dispatching to that product's
 * `zoho*ConfigApiUrlForDatacenter()` helper.
 *
 * @param input - The product, datacenter (default `us`), and mode (default `production`).
 * @returns The product's full API base URL.
 *
 * @example
 * ```typescript
 * zohoProductConfigApiUrlForDatacenter({ product: 'desk', datacenter: 'eu' }); // 'https://desk.zoho.eu/api/v1'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zohoProductConfigApiUrlForDatacenter(input: ZohoProductConfigApiUrlForDatacenterInput): ZohoApiUrl {
  let result: ZohoApiUrl;

  switch (input.product) {
    case 'crm':
      result = zohoCrmConfigApiUrlForDatacenter(input);
      break;
    case 'recruit':
      result = zohoRecruitConfigApiUrlForDatacenter(input);
      break;
    case 'desk':
      result = zohoDeskConfigApiUrlForDatacenter(input);
      break;
    case 'sign':
      result = zohoSignConfigApiUrlForDatacenter(input);
      break;
    case 'analytics':
      result = zohoAnalyticsConfigApiUrlForDatacenter(input);
      break;
  }

  return result;
}
