import { type FactoryWithRequiredInput, type OidcClientAuthMethod, type WebsiteUrl, type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { MICROSOFT_LOGIN_URL, type MicrosoftEntraTenantId, type MicrosoftOAuthClientId, type MicrosoftOAuthClientSecret } from '../microsoft.config';

/**
 * The multi-tenant authorities the Microsoft identity platform accepts in place of a tenant id.
 *
 * Refused by this package: a connection is always made against one known tenant, so a token minted for
 * an arbitrary organization's (or a personal account's) user can never be accepted.
 */
export const MICROSOFT_MULTI_TENANT_AUTHORITIES = ['common', 'organizations', 'consumers'] as const;

/**
 * Returns whether the tenant id is one of the {@link MICROSOFT_MULTI_TENANT_AUTHORITIES}.
 *
 * @param tenantId - The tenant id to check.
 * @returns True when the value is a multi-tenant authority rather than a single tenant.
 */
export function isMicrosoftMultiTenantAuthority(tenantId: string): boolean {
  return (MICROSOFT_MULTI_TENANT_AUTHORITIES as readonly string[]).includes(tenantId.trim().toLowerCase());
}

/**
 * Asserts the tenant id names a single tenant.
 *
 * @param tenantId - The configured tenant id.
 * @returns The trimmed tenant id.
 * @throws {Error} When the tenant id is empty or a multi-tenant authority.
 */
export function assertMicrosoftSingleTenantId(tenantId: Maybe<string>): MicrosoftEntraTenantId {
  const trimmed = tenantId?.trim();

  if (!trimmed) {
    throw new Error('A Microsoft Entra tenant id is required.');
  } else if (isMicrosoftMultiTenantAuthority(trimmed)) {
    throw new Error(`The Microsoft authority "${trimmed}" is multi-tenant; only a single tenant id (a directory GUID or verified domain) is supported.`);
  }

  return trimmed;
}

/**
 * Returns the per-tenant OAuth 2.0 v2 base URL, serving `/authorize` and `/token`.
 *
 * @param tenantId - The single tenant to authorize against.
 * @returns The base URL, e.g. `https://login.microsoftonline.com/<tenant>/oauth2/v2.0`.
 */
export function microsoftOAuthTenantBaseUrl(tenantId: MicrosoftEntraTenantId): WebsiteUrl {
  return `${MICROSOFT_LOGIN_URL}/${encodeURIComponent(tenantId)}/oauth2/v2.0`;
}

/**
 * The authorize endpoint path, relative to {@link microsoftOAuthTenantBaseUrl}.
 */
export const MICROSOFT_OAUTH_AUTHORIZE_PATH = '/authorize';

/**
 * The token endpoint path, relative to {@link microsoftOAuthTenantBaseUrl}.
 */
export const MICROSOFT_OAUTH_TOKEN_PATH = '/token';

/**
 * How this client authenticates itself at the token endpoint. Entra accepts the secret in the form body.
 */
export const MICROSOFT_OAUTH_CLIENT_AUTH_METHOD: OidcClientAuthMethod = 'client_secret_post';

/**
 * Configuration for a single-tenant Microsoft OAuth client.
 */
export interface MicrosoftOAuthConfig {
  readonly tenantId: MicrosoftEntraTenantId;
  readonly clientId: MicrosoftOAuthClientId;
  readonly clientSecret: MicrosoftOAuthClientSecret;
}

export interface MicrosoftOAuthFetchFactoryInput {
  readonly config: MicrosoftOAuthConfig;
}

export type MicrosoftOAuthFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, MicrosoftOAuthFetchFactoryInput>;

/**
 * Context used for performing fetch() and fetchJson() calls with a configured fetch instance.
 */
export interface MicrosoftOAuthContext {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly config: MicrosoftOAuthConfig;
}

export interface MicrosoftOAuthContextRef {
  readonly oauthContext: MicrosoftOAuthContext;
}
