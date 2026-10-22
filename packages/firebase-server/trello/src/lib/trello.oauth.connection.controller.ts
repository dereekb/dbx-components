import { Controller, Inject, type Type } from '@nestjs/common';
import { TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { AbstractUserExternalConnectionOAuthController, userExternalConnectionOAuthControllerForProviderType } from '@dereekb/firebase-server/model';
import { TRELLO_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH } from './trello.oauth.connection.config';
import { TrelloUserExternalConnectionOAuthService } from './trello.oauth.connection.service';

/**
 * Endpoints for the default Trello external-connection authorization-code handoff.
 *
 * Mounted at `/oauth/trello`, matching the Angular registry's default authorize path of
 * `/oauth/<providerType>/authorize`. An app with a global API route prefix must ALSO exclude these
 * routes from it via {@link TRELLO_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE}, or
 * they no longer match the callback URL registered on the Trello OAuth 2.0 client.
 */
@Controller(TRELLO_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH)
export class TrelloUserExternalConnectionOAuthController extends AbstractUserExternalConnectionOAuthController {
  constructor(@Inject(TrelloUserExternalConnectionOAuthService) readonly oauthService: TrelloUserExternalConnectionOAuthService) {
    super();
  }
}

/**
 * Returns the controller class serving the Trello handoff for a provider type.
 *
 * The default provider type returns {@link TrelloUserExternalConnectionOAuthController}; any other gets
 * its own class mounted at `/oauth/<providerType>` that injects the service from its own module.
 *
 * @param providerType - The provider type the controller serves.
 * @returns The controller class to register on that connection's module.
 */
export function trelloUserExternalConnectionOAuthControllerForProviderType(providerType: UserExternalConnectionProviderType): Type<AbstractUserExternalConnectionOAuthController> {
  return userExternalConnectionOAuthControllerForProviderType({ providerType, defaultProviderType: TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, defaultController: TrelloUserExternalConnectionOAuthController, serviceClass: TrelloUserExternalConnectionOAuthService });
}
