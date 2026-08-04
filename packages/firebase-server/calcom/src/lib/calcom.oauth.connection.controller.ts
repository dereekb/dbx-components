import { Controller, Inject } from '@nestjs/common';
import { AbstractUserExternalConnectionOAuthController } from '@dereekb/firebase-server/model';
import { CALCOM_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH } from './calcom.oauth.connection.config';
import { CalcomUserExternalConnectionOAuthService } from './calcom.oauth.connection.service';

/**
 * Endpoints for the Cal.com external-connection authorization-code handoff.
 *
 * Mounted at `/oauth/calcom`, matching the Angular registry's default authorize path of
 * `/oauth/<providerType>/authorize`. Hosting rewrites do not strip the path, so this prefix is the
 * public path — but an app with a global API route prefix must ALSO exclude these routes from it via
 * {@link CALCOM_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE}, or they land under
 * that prefix instead and no longer match the redirect URI registered with Cal.com.
 *
 * The `authorize` and `callback` routes come from the base class, so this declares only where they
 * mount and which service serves them.
 */
@Controller(CALCOM_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH)
export class CalcomUserExternalConnectionOAuthController extends AbstractUserExternalConnectionOAuthController {
  constructor(@Inject(CalcomUserExternalConnectionOAuthService) readonly oauthService: CalcomUserExternalConnectionOAuthService) {
    super();
  }
}
