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
