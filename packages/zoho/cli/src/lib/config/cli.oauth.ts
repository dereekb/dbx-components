import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { parsePastedRedirect, SUGGESTED_CLI_LOOPBACK_REDIRECT_PORT } from '@dereekb/dbx-cli';
import {
  ZOHO_ACCOUNTS_API_URLS,
  ZOHO_ACCOUNTS_PROFILE_READ_SCOPE,
  zohoAccountsApiUrlKeyForApiUrl,
  zohoAccountsOAuthClientFactory,
  zohoAccountsRefreshTokenFromAuthorizationCode,
  zohoAccountsUserInfo,
  type ZohoAccountsApiUrlKey,
  type ZohoAccountsRefreshTokenFromAuthorizationCodeResponse,
  type ZohoOAuthScope
} from '@dereekb/zoho';
import { ZOHO_CLI_PRODUCTS, type ZohoCliProduct } from './cli.config';

// MARK: Scopes
/**
 * OAuth scopes requested for each product.
 */
export const ZOHO_CLI_PRODUCT_SCOPES: Readonly<Record<ZohoCliProduct, readonly ZohoOAuthScope[]>> = {
  recruit: ['ZohoRecruit.modules.ALL', 'ZohoRecruit.settings.all', 'ZohoRecruit.functions.execute.READ', 'ZohoRecruit.functions.execute.CREATE'],
  crm: ['ZohoCRM.modules.ALL', 'ZohoCRM.settings.ALL', 'ZohoCRM.functions.execute.READ', 'ZohoCRM.functions.execute.CREATE'],
  desk: ['Desk.tickets.ALL', 'Desk.tasks.ALL', 'Desk.contacts.ALL', 'Desk.settings.ALL', 'Desk.events.ALL', 'Desk.search.READ', 'Desk.articles.READ', 'Desk.basic.READ'],
  sign: ['ZohoSign.documents.ALL', 'ZohoSign.templates.ALL'],
  analytics: ['ZohoAnalytics.data.all', 'ZohoAnalytics.metadata.all', 'ZohoAnalytics.modeling.all']
};

/**
 * Returns the scopes an authorization request for the given products should carry.
 *
 * Always includes {@link ZOHO_ACCOUNTS_PROFILE_READ_SCOPE}, so a login can report the account it
 * authorized. Unknown product names are skipped.
 *
 * @param products - Product keys whose scopes should be requested.
 * @returns The de-duplicated scopes.
 * @throws {Error} When none of the given products is a known one.
 */
export function zohoCliScopesForProducts(products: readonly string[]): ZohoOAuthScope[] {
  const productScopes = products.flatMap((product) => (ZOHO_CLI_PRODUCTS.includes(product as ZohoCliProduct) ? ZOHO_CLI_PRODUCT_SCOPES[product as ZohoCliProduct] : []));

  if (productScopes.length === 0) {
    throw new Error(`No valid products specified. Choose from: ${ZOHO_CLI_PRODUCTS.join(', ')}`);
  }

  return Array.from(new Set([...productScopes, ZOHO_ACCOUNTS_PROFILE_READ_SCOPE]));
}

// MARK: Redirect
/**
 * Redirect URI `auth login` uses when none is given or stored.
 *
 * A loopback URI with a fixed port, so the CLI can bind it and read the code straight out of the
 * browser redirect. It must be registered as an Authorized Redirect URI on the Zoho API-console client.
 */
export const DEFAULT_AUTH_LOGIN_REDIRECT_URI: WebsiteUrl = `http://localhost:${SUGGESTED_CLI_LOOPBACK_REDIRECT_PORT}/callback`;

/**
 * Every Zoho datacenter the CLI accepts for `--region`.
 */
export const ZOHO_CLI_REGION_CHOICES = Object.keys(ZOHO_ACCOUNTS_API_URLS) as ZohoAccountsApiUrlKey[];

// MARK: Code Exchange
export interface ExchangeZohoAuthorizationCodeInput {
  readonly clientId: string;
  readonly clientSecret: string;
  /**
   * Datacenter key (or Accounts URL) to exchange the code against — the one that issued it.
   */
  readonly region: string;
  readonly code: string;
  /**
   * Must be identical to the `redirect_uri` sent in the authorization request.
   */
  readonly redirectUri: string;
}

/**
 * A code exchange response that is guaranteed to carry a refresh token.
 */
export type ZohoCliAuthorizationCodeExchangeResponse = ZohoAccountsRefreshTokenFromAuthorizationCodeResponse & { readonly refresh_token: string };

/**
 * Exchanges an authorization code for tokens.
 *
 * Goes through `@dereekb/zoho`'s client-credentials-only client, which turns Zoho's HTTP-200
 * `{ "error": … }` bodies into thrown errors.
 *
 * @param input - The client, datacenter, code, and redirect URI.
 * @returns The token response.
 * @throws {Error} When the exchange fails, or succeeds without a refresh token.
 */
export async function exchangeZohoAuthorizationCode(input: ExchangeZohoAuthorizationCodeInput): Promise<ZohoCliAuthorizationCodeExchangeResponse> {
  const { clientId, clientSecret, region, code, redirectUri } = input;
  const { oauthClientContext } = zohoAccountsOAuthClientFactory({})({ clientId, clientSecret, apiUrl: region });
  const response = await zohoAccountsRefreshTokenFromAuthorizationCode(oauthClientContext)({ code, redirectUri });

  if (!response.refresh_token) {
    throw new Error('No refresh_token in the token response. The authorization code may have expired (valid for 2 minutes), or the request lacked access_type=offline/prompt=consent. Run the login again.');
  }

  return response as ZohoCliAuthorizationCodeExchangeResponse;
}

export interface LoadZohoAuthUserEmailInput {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly region: string;
  readonly accessToken: string;
}

/**
 * Reads the email of the account an access token was issued to, for reporting which account a login authorized.
 *
 * Best effort: needs {@link ZOHO_ACCOUNTS_PROFILE_READ_SCOPE}, and any failure resolves `undefined`
 * rather than failing a login that already succeeded.
 *
 * @param input - The client, datacenter, and access token.
 * @returns The account email, or `undefined` when it could not be read.
 */
export async function loadZohoAuthUserEmail(input: LoadZohoAuthUserEmailInput): Promise<Maybe<string>> {
  const { clientId, clientSecret, region, accessToken } = input;
  let result: Maybe<string>;

  try {
    const { oauthClientContext } = zohoAccountsOAuthClientFactory({})({ clientId, clientSecret, apiUrl: region });
    const userInfo = await zohoAccountsUserInfo(oauthClientContext)({ accessToken });
    result = userInfo.Email ?? undefined;
  } catch {
    result = undefined;
  }

  return result;
}

// MARK: Redirect Parsing
export interface ParseZohoAuthRedirectInput {
  /**
   * The redirect URL (or bare authorization code) captured or pasted.
   */
  readonly pasted: string;
  /**
   * The `state` sent with the authorization request, checked against the one in a redirect URL.
   */
  readonly expectedState?: Maybe<string>;
  /**
   * Datacenter to use when the input does not name the issuing one.
   */
  readonly fallbackRegion: string;
}

export interface ParsedZohoAuthRedirect {
  readonly code: string;
  /**
   * Datacenter that issued the code, which the exchange must be sent to.
   */
  readonly region: string;
}

/**
 * Parses the authorization code and issuing datacenter out of a Zoho OAuth redirect.
 *
 * The datacenter comes from the `accounts-server` param Zoho echoes back, else its `location` key,
 * else `fallbackRegion`. An `accounts-server` that is not a known Zoho Accounts host is REJECTED: it
 * becomes the host the client secret is posted to, and anyone can compose a redirect URL.
 *
 * @param input - The pasted value, expected state, and fallback datacenter.
 * @returns The code and datacenter.
 * @throws {Error} When no code is present, the provider returned an `error`, the state does not match, or `accounts-server` is not a known Zoho Accounts host.
 */
export function parseZohoAuthRedirect(input: ParseZohoAuthRedirectInput): ParsedZohoAuthRedirect {
  const { pasted, expectedState, fallbackRegion } = input;
  const { code } = parsePastedRedirect({ pasted, expectedState: expectedState ?? undefined });
  const trimmed = pasted.trim();
  let region = fallbackRegion;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const params = new URL(trimmed).searchParams;
    const accountsServer = params.get('accounts-server');
    const location = params.get('location');

    if (accountsServer) {
      const accountsServerRegion = zohoAccountsApiUrlKeyForApiUrl(accountsServer);

      if (!accountsServerRegion) {
        throw new Error(`Refusing to exchange the authorization code: accounts-server "${accountsServer}" is not a known Zoho Accounts host.`);
      }

      region = accountsServerRegion;
    } else if (location && ZOHO_CLI_REGION_CHOICES.includes(location as ZohoAccountsApiUrlKey)) {
      region = location;
    }
  }

  return { code, region };
}
