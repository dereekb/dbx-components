import { type InjectionToken, type Provider } from '@nestjs/common';
import { type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { userExternalConnectionProviderNotAllowedError } from '../userexternalconnection.error';
import { type AbstractUserExternalConnectionOAuthService } from './userexternalconnection.oauth.service';

/**
 * The providers an app has an OAuth authorize/callback flow mounted for.
 *
 * Built FROM the registered services rather than from a hand-maintained list, so it cannot disagree
 * with which provider modules the app actually imported. A provider absent from it has no endpoint
 * to send the user to, so minting a state for it would hand back something unusable.
 */
export abstract class UserExternalConnectionOAuthProviderRegistry {
  abstract readonly providerTypes: ReadonlySet<UserExternalConnectionProviderType>;
  /**
   * Whether the app can begin an OAuth handoff for this provider.
   */
  abstract hasAuthorizeFlowForProviderType(providerType: UserExternalConnectionProviderType): boolean;
  /**
   * Throws when the app has no OAuth handoff for this provider.
   *
   * @throws A precondition-conflict HttpsError.
   */
  abstract assertHasAuthorizeFlowForProviderType(providerType: UserExternalConnectionProviderType): void;
  /**
   * The registered service for a provider, when there is one.
   */
  abstract serviceForProviderType(providerType: UserExternalConnectionProviderType): Maybe<AbstractUserExternalConnectionOAuthService>;
}

/**
 * Creates the registry from the app's registered OAuth services.
 *
 * @param services - Every {@link AbstractUserExternalConnectionOAuthService} the app has mounted.
 * @returns The registry.
 * @throws {Error} When two services claim the same provider type.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionOAuthProviderRegistry(services: AbstractUserExternalConnectionOAuthService[]): UserExternalConnectionOAuthProviderRegistry {
  const servicesMap = new Map<UserExternalConnectionProviderType, AbstractUserExternalConnectionOAuthService>();

  services.forEach((service) => {
    const { providerType } = service;

    if (servicesMap.has(providerType)) {
      throw new Error(`userExternalConnectionOAuthProviderRegistry: two services are registered for the provider "${providerType}".`);
    }

    servicesMap.set(providerType, service);
  });

  const providerTypes: ReadonlySet<UserExternalConnectionProviderType> = new Set(servicesMap.keys());

  function hasAuthorizeFlowForProviderType(providerType: UserExternalConnectionProviderType): boolean {
    return servicesMap.has(providerType);
  }

  function assertHasAuthorizeFlowForProviderType(providerType: UserExternalConnectionProviderType): void {
    if (!servicesMap.has(providerType)) {
      throw userExternalConnectionProviderNotAllowedError(providerType);
    }
  }

  function serviceForProviderType(providerType: UserExternalConnectionProviderType): Maybe<AbstractUserExternalConnectionOAuthService> {
    return servicesMap.get(providerType);
  }

  return { providerTypes, hasAuthorizeFlowForProviderType, assertHasAuthorizeFlowForProviderType, serviceForProviderType };
}

/**
 * Creates the NestJS provider for the {@link UserExternalConnectionOAuthProviderRegistry}.
 *
 * Declared by the app rather than by the UserExternalConnection module, because each provider module
 * imports that module for its actions and state coder — so the registry must live somewhere that can
 * import the provider modules without a cycle.
 *
 * Registering a provider is then one module import plus one token here.
 *
 * @param oauthServiceTokens - Tokens of the registered `AbstractUserExternalConnectionOAuthService`
 *   providers, whose modules must be imported by the declaring module.
 * @returns The NestJS provider.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionOAuthProviderRegistryProvider(oauthServiceTokens: InjectionToken[]): Provider {
  return {
    provide: UserExternalConnectionOAuthProviderRegistry,
    useFactory: (...services: AbstractUserExternalConnectionOAuthService[]) => userExternalConnectionOAuthProviderRegistry(services),
    inject: oauthServiceTokens
  };
}
