import { Controller, Inject, type Type } from '@nestjs/common';
import { MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { AbstractUserExternalConnectionOAuthController, userExternalConnectionOAuthControllerForProviderType } from '@dereekb/firebase-server/model';
import { MICROSOFT_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH } from './microsoft.oauth.connection.config';
import { MicrosoftUserExternalConnectionOAuthService } from './microsoft.oauth.connection.service';

/**
 * Endpoints for the default Microsoft external-connection authorization-code handoff.
 *
 * Mounted at `/oauth/microsoft`, matching the Angular registry's default authorize path of
 * `/oauth/<providerType>/authorize`. An app with a global API route prefix must ALSO exclude these
 * routes from it via {@link MICROSOFT_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE}, or
 * they no longer match the redirect URI registered on the Entra app registration.
 */
@Controller(MICROSOFT_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH)
export class MicrosoftUserExternalConnectionOAuthController extends AbstractUserExternalConnectionOAuthController {
  constructor(@Inject(MicrosoftUserExternalConnectionOAuthService) readonly oauthService: MicrosoftUserExternalConnectionOAuthService) {
    super();
  }
}

/**
 * Returns the controller class serving the Microsoft handoff for a provider type.
 *
 * The default provider type returns {@link MicrosoftUserExternalConnectionOAuthController}; any other gets
 * its own class mounted at `/oauth/<providerType>` that injects the service from its own module.
 *
 * @param providerType - The provider type the controller serves.
 * @returns The controller class to register on that connection's module.
 */
export function microsoftUserExternalConnectionOAuthControllerForProviderType(providerType: UserExternalConnectionProviderType): Type<AbstractUserExternalConnectionOAuthController> {
  return userExternalConnectionOAuthControllerForProviderType({ providerType, defaultProviderType: MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, defaultController: MicrosoftUserExternalConnectionOAuthController, serviceClass: MicrosoftUserExternalConnectionOAuthService });
}
