// MARK: OAuthClient

import { type Maybe } from '@dereekb/util';
import { type OidcEntryClientId } from './oidcmodel.id';
import { type OidcRedirectUri } from './oidcmodel.interaction';

/**
 * Corresponds with readable content from a OidcEntry's payload.
 */
export interface OidcEntryOAuthClientPayloadData {
  readonly client_id: OidcEntryClientId;
  readonly client_name?: Maybe<string>;
  readonly redirect_uris: OidcRedirectUri[];
  readonly grant_types: string[];
  readonly response_types?: Maybe<string[]>;
  readonly token_endpoint_auth_method?: Maybe<string>;
  readonly logo_uri?: Maybe<string>;
  readonly client_uri?: Maybe<string>;
  readonly created_at?: string;
}

// MARK: Grant
/**
 * Subset of an oidc-provider Grant adapter payload that is safe to expose to the
 * granting user when they manage their issued tokens.
 *
 * Mirrors the relevant fields of oidc-provider's `lib/models/grant.js` payload.
 */
export interface OidcEntryGrantPayloadData {
  readonly accountId?: Maybe<string>;
  readonly clientId?: Maybe<OidcEntryClientId>;
  readonly exp?: Maybe<number>;
  readonly iat?: Maybe<number>;
  /**
   * Space-delimited string of scopes that apply across all resources, e.g. `'openid email offline_access'`.
   */
  readonly openid?: Maybe<{
    readonly scope?: Maybe<string>;
    readonly claims?: Maybe<string[]>;
  }>;
}
