import { Controller, Inject, type InjectionToken, type Type } from '@nestjs/common';
import { type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { AbstractUserExternalConnectionOAuthController } from './userexternalconnection.oauth.controller';
import { type AbstractUserExternalConnectionOAuthService } from './userexternalconnection.oauth.service';
import { userExternalConnectionOAuthControllerPath } from './userexternalconnection.oauth.config';

/**
 * Input for {@link userExternalConnectionOAuthServiceTokenForProviderType}.
 */
export interface UserExternalConnectionOAuthServiceTokenForProviderTypeInput {
  /**
   * The provider type of the connection instance. Defaults to `defaultProviderType`.
   */
  readonly providerType?: Maybe<UserExternalConnectionProviderType>;
  /**
   * The adapter's own provider type, which keeps the class token.
   */
  readonly defaultProviderType: UserExternalConnectionProviderType;
  /**
   * The adapter's service class.
   */
  readonly serviceClass: Type<AbstractUserExternalConnectionOAuthService>;
  /**
   * The prefix of every other instance's string token, e.g. `TrelloUserExternalConnectionOAuthService`.
   *
   * Explicit rather than `serviceClass.name`, which minification renames.
   */
  readonly tokenPrefix: string;
}

/**
 * Returns the injection token one instance of a multi-instance provider adapter exports its service
 * under.
 *
 * The default provider type keeps the class token. Any other gets `<tokenPrefix>:<providerType>`: an app
 * registering two instances imports both modules into the one declaring the OAuth provider registry, and
 * two modules exporting the same class token would leave that registry with only one of them.
 *
 * @param input - The provider type, the adapter's default type, its service class and token prefix.
 * @returns The token to list in `userExternalConnectionOAuthProviderRegistryProvider()`.
 */
export function userExternalConnectionOAuthServiceTokenForProviderType(input: UserExternalConnectionOAuthServiceTokenForProviderTypeInput): InjectionToken {
  const { defaultProviderType, serviceClass, tokenPrefix } = input;
  const providerType = input.providerType ?? defaultProviderType;
  return providerType === defaultProviderType ? serviceClass : `${tokenPrefix}:${providerType}`;
}

/**
 * Input for {@link userExternalConnectionOAuthControllerForProviderType}.
 */
export interface UserExternalConnectionOAuthControllerForProviderTypeInput {
  /**
   * The provider type the controller serves.
   */
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The adapter's own provider type, served by `defaultController`.
   */
  readonly defaultProviderType: UserExternalConnectionProviderType;
  /**
   * The adapter's statically-decorated controller, mounted at `/oauth/<defaultProviderType>`.
   */
  readonly defaultController: Type<AbstractUserExternalConnectionOAuthController>;
  /**
   * The adapter's service class, which every controller injects from its own module.
   */
  readonly serviceClass: Type<AbstractUserExternalConnectionOAuthService>;
}

/**
 * Returns the controller class serving one instance of a multi-instance provider adapter.
 *
 * The default provider type returns `defaultController`. Any other gets a fresh class mounted at
 * `/oauth/<providerType>`: the mount point is fixed when the class is decorated, so a second instance
 * cannot reuse the static class without both landing on the same path. Each class injects the service
 * from its OWN module, which is how two instances in one app each reach their own config.
 *
 * @param input - The provider type, the adapter's default type, its default controller and service class.
 * @returns The controller class to register on that instance's module.
 */
export function userExternalConnectionOAuthControllerForProviderType(input: UserExternalConnectionOAuthControllerForProviderTypeInput): Type<AbstractUserExternalConnectionOAuthController> {
  const { providerType, defaultProviderType, defaultController, serviceClass } = input;
  let result: Type<AbstractUserExternalConnectionOAuthController>;

  if (providerType === defaultProviderType) {
    result = defaultController;
  } else {
    @Controller(userExternalConnectionOAuthControllerPath(providerType))
    class UserExternalConnectionOAuthProviderTypeController extends AbstractUserExternalConnectionOAuthController {
      constructor(@Inject(serviceClass) readonly oauthService: AbstractUserExternalConnectionOAuthService) {
        super();
      }
    }

    result = UserExternalConnectionOAuthProviderTypeController;
  }

  return result;
}
