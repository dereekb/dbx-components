import { type FirebaseAuthUserId, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
import { type UserExternalConnectionCredentialsRefresher, type UserExternalConnectionRefreshCredentialsInput } from '../userexternalconnection.refresh.service';
import { type UserExternalConnectionOAuthProviderRegistry } from './userexternalconnection.oauth.registry';

/**
 * Configuration for {@link userExternalConnectionOAuthRegistryCredentialsRefresher}.
 */
export interface UserExternalConnectionOAuthRegistryCredentialsRefresherConfig {
  readonly registry: UserExternalConnectionOAuthProviderRegistry;
}

/**
 * Creates a {@link UserExternalConnectionCredentialsRefresher} that renews credentials through the
 * app's registered OAuth provider services.
 *
 * The bridge between the two layers: the reader knows it needs a refresh but nothing about providers,
 * and each provider service knows how to refresh but nothing about who is asking. Dispatch is by
 * provider type, so a provider the app never registered — or registered without a `refreshCredentials`
 * implementation — resolves to null, which the reader reports as "cannot renew" rather than as a
 * failure of the provider.
 *
 * @param config - The provider registry to dispatch through.
 * @returns A refresher backed by the registry.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionOAuthRegistryCredentialsRefresher(config: UserExternalConnectionOAuthRegistryCredentialsRefresherConfig): UserExternalConnectionCredentialsRefresher {
  const { registry } = config;

  async function refreshUserExternalConnectionCredentials(input: UserExternalConnectionRefreshCredentialsInput): Promise<Maybe<UserExternalConnectionCredentials>> {
    const { uid, providerType, credentials } = input;
    const service = registry.serviceForProviderType(providerType);
    return service?.refreshCredentials?.({ uid, credentials }) ?? null;
  }

  return { refreshUserExternalConnectionCredentials };
}

/**
 * Input for a {@link UserExternalConnectionCredentialsRevoker}.
 */
export interface UserExternalConnectionRevokeCredentialsInput {
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  readonly credentials: UserExternalConnectionCredentials;
}

/**
 * Ends a provider's grant before the credentials are forgotten.
 */
export abstract class UserExternalConnectionCredentialsRevoker {
  abstract readonly revokeUserExternalConnectionCredentials: (input: UserExternalConnectionRevokeCredentialsInput) => Promise<void>;
}

/**
 * Creates a {@link UserExternalConnectionCredentialsRevoker} that revokes through the app's
 * registered OAuth provider services.
 *
 * The disconnect counterpart of {@link userExternalConnectionOAuthRegistryCredentialsRefresher}, and
 * declared beside it for the same reason: the paired write knows the credentials are being discarded
 * but nothing about providers, while a provider service knows how to revoke but nothing about who is
 * asking.
 *
 * Call this BEFORE `disconnectUserExternalConnection`, which is the last moment the credentials
 * still exist. A provider the app never registered — or one with no revocation endpoint — resolves to
 * a no-op, which matches the pre-existing behavior of simply deleting the stored credentials.
 *
 * @param config - The provider registry to dispatch through.
 * @returns A revoker backed by the registry.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionOAuthRegistryCredentialsRevoker(config: UserExternalConnectionOAuthRegistryCredentialsRefresherConfig): UserExternalConnectionCredentialsRevoker {
  const { registry } = config;

  async function revokeUserExternalConnectionCredentials(input: UserExternalConnectionRevokeCredentialsInput): Promise<void> {
    const { uid, providerType, credentials } = input;
    const service = registry.serviceForProviderType(providerType);
    await service?.revokeCredentials?.({ uid, credentials });
  }

  return { revokeUserExternalConnectionCredentials };
}
