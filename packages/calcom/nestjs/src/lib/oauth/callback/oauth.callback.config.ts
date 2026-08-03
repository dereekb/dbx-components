import { type CalcomOAuthScope, isCalcomOAuthScope } from '@dereekb/calcom';
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
 * Overrides the requested scopes, as a space- or comma-delimited list.
 *
 * Exists because the acceptable set is a property of the OAuth CLIENT, not of the code: a client
 * registered for fewer scopes than {@link DEFAULT_CALCOM_OAUTH_SCOPES} has its authorize request
 * refused, and that should be fixable by configuration.
 */
export const CALCOM_OAUTH_SCOPES_CONFIG_KEY = 'CALCOM_OAUTH_SCOPES';

/**
 * The scopes requested when an app does not configure its own.
 *
 * Least privilege for a per-user calendar connect: read which meeting types exist, read the user's
 * availability, and read/write bookings. Deliberately does NOT include `EVENT_TYPE_WRITE` or
 * `SCHEDULE_WRITE` — connecting a calendar does not involve editing the user's meeting types or
 * their availability — nor `PROFILE_READ`, which is only needed to label the connection with the
 * Cal.com account it belongs to.
 *
 * Cal.com refuses the authorize request outright when the requested set exceeds what the OAuth
 * client is registered for ("Requested scope exceeds the client's registered scopes"), so an app
 * whose client is registered differently should override this via
 * {@link CALCOM_OAUTH_SCOPES_CONFIG_KEY} rather than discover it at the consent screen.
 */
export const DEFAULT_CALCOM_OAUTH_SCOPES: readonly CalcomOAuthScope[] = ['EVENT_TYPE_READ', 'SCHEDULE_READ', 'BOOKING_READ', 'BOOKING_WRITE'];

/**
 * Separators accepted when reading scopes from the environment, so either an OAuth-style
 * space-delimited list or a comma-delimited one works.
 */
const CALCOM_OAUTH_SCOPES_ENV_SEPARATOR_REGEX = /[\s,]+/;

/**
 * Parses a configured scope list from an environment value.
 *
 * Unknown tokens are dropped rather than forwarded, so a `.env` sentinel such as `placeholder` or a
 * typo cannot become a requested scope — which Cal.com would refuse the whole authorize request
 * over. Returns undefined when nothing valid remains, letting {@link DEFAULT_CALCOM_OAUTH_SCOPES}
 * apply.
 *
 * @param value - The raw environment value, space- or comma-delimited.
 * @returns The parsed scopes, or undefined when nothing usable was configured.
 */
export function calcomOAuthScopesFromEnvValue(value: Maybe<string>): Maybe<readonly CalcomOAuthScope[]> {
  const tokens = value?.trim() ? value.trim().split(CALCOM_OAUTH_SCOPES_ENV_SEPARATOR_REGEX) : [];
  const scopes = tokens.filter(isCalcomOAuthScope);
  return scopes.length ? scopes : undefined;
}

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
      failureUrl: failureUrl || undefined,
      scopes: calcomOAuthScopesFromEnvValue(configService.get<string>(CALCOM_OAUTH_SCOPES_CONFIG_KEY))
    }
  };

  CalcomOAuthCallbackServiceConfig.assertValidConfig(config);
  return config;
}
