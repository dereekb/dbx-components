// MARK: OAuthClient

import { Maybe } from '@dereekb/util';
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
