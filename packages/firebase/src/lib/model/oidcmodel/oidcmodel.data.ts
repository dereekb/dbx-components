// MARK: OAuthClient

import { Maybe } from '@dereekb/util';
import { type OidcEntryClientId } from './oidcmodel.id';

/**
 * Corresponds with readable content from a OidcEntry's payload.
 */
export interface OidcEntryOAuthClientPayloadData {
  readonly client_id: OidcEntryClientId;
  readonly client_name?: Maybe<string>;
  readonly redirect_uris: string[];
  readonly grant_types: string[];
  readonly response_types?: Maybe<string[]>;
  readonly created_at?: string;
}
