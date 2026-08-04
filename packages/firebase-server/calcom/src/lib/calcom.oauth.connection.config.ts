import { type CalcomOAuthScope } from '@dereekb/calcom';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE } from '@dereekb/firebase';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { UserExternalConnectionOAuthServiceConfig, userExternalConnectionOAuthControllerPath, userExternalConnectionOAuthRoutesForGlobalRouteExclude, userExternalConnectionOAuthServiceConfigFactory } from '@dereekb/firebase-server/model';
import { type Maybe } from '@dereekb/util';

/**
 * Controller path the Cal.com external-connection OAuth endpoints are mounted at.
 *
 * Derived from the framework's path factory, the same expression the redirect URI and the
 * global-prefix exclusion are built from, so the three cannot drift apart.
 */
export const CALCOM_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH = userExternalConnectionOAuthControllerPath(CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);

/**
 * Routes to exclude from an app's global API route prefix so the Cal.com callback controller stays
 * mounted at `/oauth/calcom/*`.
 *
 * Spread this into the `exclude` list of the app's `globalApiRoutePrefix` config, alongside
 * `FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE`.
 */
export const CALCOM_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE: string[] = userExternalConnectionOAuthRoutesForGlobalRouteExclude(CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);

/**
 * The scopes requested when an app does not declare its own.
 *
 * Declared in code, deliberately NOT read from the environment: the set to request follows from what
 * the integration actually does, so it is a property of the code rather than of a deployment.
 * Requesting less than the code uses does not make it work — it moves the failure from the consent
 * screen to the first API call.
 *
 * Least privilege for a per-user calendar connect: read which meeting types exist, read the user's
 * availability, and read/write bookings. Excludes `EVENT_TYPE_WRITE` and `SCHEDULE_WRITE` —
 * connecting a calendar does not involve editing the user's meeting types or availability — and
 * `PROFILE_READ`, which is only needed to label the connection with the Cal.com account it belongs
 * to.
 *
 * Cal.com refuses the authorize request outright when the requested set exceeds what the OAuth
 * client is registered for ("Requested scope exceeds the client's registered scopes"). That is a
 * registration problem: register the scopes the code needs, rather than narrowing the request to fit.
 * An app whose integration genuinely does less can declare its own set on the module metadata, in
 * code where it is reviewable.
 */
export const DEFAULT_CALCOM_OAUTH_SCOPES: readonly CalcomOAuthScope[] = ['EVENT_TYPE_READ', 'SCHEDULE_READ', 'BOOKING_READ', 'BOOKING_WRITE'];

/**
 * Configuration for the {@link CalcomUserExternalConnectionOAuthService}.
 *
 * Extends the framework config with the one thing that is Cal.com's own — which scopes to request.
 */
export abstract class CalcomUserExternalConnectionOAuthServiceConfig extends UserExternalConnectionOAuthServiceConfig {
  readonly scopes!: readonly CalcomOAuthScope[];
}

export interface CalcomUserExternalConnectionOAuthServiceConfigFactoryConfig {
  readonly envService: FirebaseServerEnvService;
  /**
   * Path on the app URL the user is returned to after connecting, e.g. `/app/settings`.
   */
  readonly successPath: string;
  /**
   * Path on the app URL the user is returned to after a failed connect. Defaults to `successPath`.
   */
  readonly failurePath?: Maybe<string>;
  /**
   * The scopes to request. Defaults to {@link DEFAULT_CALCOM_OAUTH_SCOPES}.
   */
  readonly scopes?: Maybe<readonly CalcomOAuthScope[]>;
}

/**
 * Builds the Cal.com connect flow's configuration from the app's configured origins.
 *
 * Nothing here is read from the environment as a value: the redirect URI is derived from the app's
 * OAuth origin plus the mounted controller path, and the return URLs from the app URL plus
 * code-declared paths. Registering Cal.com therefore adds no deployment configuration beyond the
 * client credentials themselves.
 *
 * @param config - The env service, the return paths, and the optional scope override.
 * @returns The validated service configuration.
 */
export function calcomUserExternalConnectionOAuthServiceConfigFactory(config: CalcomUserExternalConnectionOAuthServiceConfigFactoryConfig): CalcomUserExternalConnectionOAuthServiceConfig {
  const { envService, successPath, failurePath, scopes } = config;

  const baseConfig = userExternalConnectionOAuthServiceConfigFactory({
    envService,
    providerType: CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
    successPath,
    failurePath
  });

  return {
    ...baseConfig,
    scopes: scopes ?? DEFAULT_CALCOM_OAUTH_SCOPES
  };
}
