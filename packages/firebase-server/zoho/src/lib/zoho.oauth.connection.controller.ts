import { Controller, Inject, type Type } from '@nestjs/common';
import { ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { AbstractUserExternalConnectionOAuthController, userExternalConnectionOAuthControllerPath } from '@dereekb/firebase-server/model';
import { ZOHO_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH } from './zoho.oauth.connection.config';
import { ZohoUserExternalConnectionOAuthService } from './zoho.oauth.connection.service';

/**
 * Endpoints for the Zoho external-connection authorization-code handoff.
 *
 * Mounted at `/oauth/zoho`, matching the Angular registry's default authorize path of
 * `/oauth/<providerType>/authorize`. Hosting rewrites do not strip the path, so this prefix is the
 * public path — but an app with a global API route prefix must ALSO exclude these routes from it via
 * {@link ZOHO_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE}, or they land under
 * that prefix instead and no longer match the redirect URI registered with Zoho.
 *
 * The `authorize` and `callback` routes come from the base class, so this declares only where they
 * mount and which service serves them.
 */
@Controller(ZOHO_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH)
export class ZohoUserExternalConnectionOAuthController extends AbstractUserExternalConnectionOAuthController {
  constructor(@Inject(ZohoUserExternalConnectionOAuthService) readonly oauthService: ZohoUserExternalConnectionOAuthService) {
    super();
  }
}

/**
 * Returns the controller class serving the Zoho handoff for a provider type.
 *
 * The default provider type returns {@link ZohoUserExternalConnectionOAuthController}. Any other gets
 * its own class mounted at `/oauth/<providerType>`: the mount point is fixed when the class is
 * decorated, so a second Zoho connection cannot reuse the static class without both landing on
 * `/oauth/zoho`. Each class injects the service from its OWN module, which is how two Zoho connections
 * in one app each reach their own config.
 *
 * @param providerType - The provider type the controller serves.
 * @returns The controller class to register on that connection's module.
 */
export function zohoUserExternalConnectionOAuthControllerForProviderType(providerType: UserExternalConnectionProviderType): Type<AbstractUserExternalConnectionOAuthController> {
  let result: Type<AbstractUserExternalConnectionOAuthController>;

  if (providerType === ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE) {
    result = ZohoUserExternalConnectionOAuthController;
  } else {
    @Controller(userExternalConnectionOAuthControllerPath(providerType))
    class ZohoUserExternalConnectionOAuthProviderTypeController extends AbstractUserExternalConnectionOAuthController {
      constructor(@Inject(ZohoUserExternalConnectionOAuthService) readonly oauthService: ZohoUserExternalConnectionOAuthService) {
        super();
      }
    }

    result = ZohoUserExternalConnectionOAuthProviderTypeController;
  }

  return result;
}
