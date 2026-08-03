import { type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type UserExternalConnectionCredentials } from './userexternalconnection.private';

/**
 * Input for {@link UserExternalConnectionCredentialsRefresher.refreshUserExternalConnectionCredentials}.
 */
export interface UserExternalConnectionRefreshCredentialsInput {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The credentials currently stored for this provider.
   *
   * Passed whole rather than as a bare refresh token because a refresh can need more than that:
   * Zoho's refresh must be sent to the datacenter that issued the grant, which is only recorded on
   * `extra`.
   */
  readonly credentials: UserExternalConnectionCredentials;
}

/**
 * Exchanges a user's stored credentials for fresh ones.
 *
 * Declared here rather than beside the OAuth registry on purpose: {@link UserExternalConnectionReader}
 * takes a refresher as OPTIONAL configuration, and if the reader could only be configured with a
 * registry-backed one it would have to import the OAuth layer — whose provider services depend on the
 * accessor the reader is built over. Keeping this an interface in the middle is what keeps that graph
 * acyclic, and it also lets a caller supply a refresher that has nothing to do with OAuth.
 *
 * Implementations return the credentials the provider issued, and are NOT responsible for carrying
 * forward values the provider's response omits — see `mergeRefreshedUserExternalConnectionCredentials`,
 * which the reader applies to every result.
 */
export abstract class UserExternalConnectionCredentialsRefresher {
  /**
   * Refreshes one provider's credentials.
   *
   * @param input - The acting user, the provider, and the credentials currently stored.
   * @returns The refreshed credentials, or null when this provider has no refresh path at all.
   */
  abstract refreshUserExternalConnectionCredentials(input: UserExternalConnectionRefreshCredentialsInput): Promise<Maybe<UserExternalConnectionCredentials>>;
}

/**
 * Reference to a {@link UserExternalConnectionCredentialsRefresher} instance.
 */
export interface UserExternalConnectionCredentialsRefresherRef {
  readonly userExternalConnectionCredentialsRefresher: UserExternalConnectionCredentialsRefresher;
}
