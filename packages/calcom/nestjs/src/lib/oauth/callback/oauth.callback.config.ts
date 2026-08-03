import { type CalcomOAuthScope } from '@dereekb/calcom';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type ConfigService } from '@nestjs/config';

/**
 * Controller path the Cal.com OAuth handoff endpoints are mounted at.
 *
 * Matches the external-connection registry's default authorize path of
 * `/oauth/<providerType>/authorize`. Shared with
 * {@link CALCOM_OAUTH_CALLBACK_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE} so the mounted path and the
 * global-prefix exclusion cannot drift apart.
 */
export const CALCOM_OAUTH_CALLBACK_CONTROLLER_PATH = 'oauth/calcom';

export const CALCOM_OAUTH_REDIRECT_URI_CONFIG_KEY = 'CALCOM_OAUTH_REDIRECT_URI';
export const CALCOM_OAUTH_SUCCESS_URL_CONFIG_KEY = 'CALCOM_OAUTH_SUCCESS_URL';
export const CALCOM_OAUTH_FAILURE_URL_CONFIG_KEY = 'CALCOM_OAUTH_FAILURE_URL';

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
 * An app whose integration genuinely does less can declare its own set via
 * {@link CalcomOAuthCallbackApiConfig.scopes}, in code where it is reviewable.
 */
export const DEFAULT_CALCOM_OAUTH_SCOPES: readonly CalcomOAuthScope[] = ['EVENT_TYPE_READ', 'SCHEDULE_READ', 'BOOKING_READ', 'BOOKING_WRITE'];

export interface CalcomOAuthCallbackApiConfig {
  /**
   * The redirect URI registered on the Cal.com OAuth client.
   *
   * Must match the registered value byte-for-byte, including the port, since it is sent on both the
   * authorize redirect and the token exchange.
   */
  readonly redirectUri: WebsiteUrl;
  /**
   * Where the user is sent after a connection succeeds.
   */
  readonly successUrl: WebsiteUrl;
  /**
   * Where the user is sent after a connection fails. Defaults to the `successUrl`.
   */
  readonly failureUrl?: Maybe<WebsiteUrl>;
  /**
   * The scopes to request. Defaults to {@link DEFAULT_CALCOM_OAUTH_SCOPES}.
   */
  readonly scopes?: Maybe<readonly CalcomOAuthScope[]>;
}

/**
 * Configuration for {@link CalcomOAuthCallbackService}.
 */
export abstract class CalcomOAuthCallbackServiceConfig {
  readonly calcomOAuthCallback!: CalcomOAuthCallbackApiConfig;

  static assertValidConfig(config: CalcomOAuthCallbackServiceConfig) {
    const { calcomOAuthCallback } = config;

    if (!calcomOAuthCallback) {
      throw new Error('CalcomOAuthCallbackServiceConfig.calcomOAuthCallback is required');
    }

    if (!calcomOAuthCallback.redirectUri) {
      throw new Error(`CalcomOAuthCallbackServiceConfig requires a redirectUri (${CALCOM_OAUTH_REDIRECT_URI_CONFIG_KEY}).`);
    }

    if (!calcomOAuthCallback.successUrl) {
      throw new Error(`CalcomOAuthCallbackServiceConfig requires a successUrl (${CALCOM_OAUTH_SUCCESS_URL_CONFIG_KEY}).`);
    }
  }
}

/**
 * Factory function that creates a {@link CalcomOAuthCallbackServiceConfig} from NestJS ConfigService
 * environment variables.
 *
 * @param configService - The NestJS ConfigService instance.
 * @returns A validated CalcomOAuthCallbackServiceConfig.
 */
export function calcomOAuthCallbackServiceConfigFactory(configService: ConfigService): CalcomOAuthCallbackServiceConfig {
  const redirectUri = configService.get<string>(CALCOM_OAUTH_REDIRECT_URI_CONFIG_KEY);
  const successUrl = configService.get<string>(CALCOM_OAUTH_SUCCESS_URL_CONFIG_KEY);
  const failureUrl = configService.get<string>(CALCOM_OAUTH_FAILURE_URL_CONFIG_KEY);

  const config: CalcomOAuthCallbackServiceConfig = {
    calcomOAuthCallback: {
      redirectUri: redirectUri as string,
      successUrl: successUrl as string,
      failureUrl: failureUrl || undefined
    }
  };

  CalcomOAuthCallbackServiceConfig.assertValidConfig(config);
  return config;
}
