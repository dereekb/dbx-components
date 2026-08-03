import { type CalcomOAuthScope } from '@dereekb/calcom';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type ConfigService } from '@nestjs/config';

export const CALCOM_OAUTH_REDIRECT_URI_CONFIG_KEY = 'CALCOM_OAUTH_REDIRECT_URI';
export const CALCOM_OAUTH_SUCCESS_URL_CONFIG_KEY = 'CALCOM_OAUTH_SUCCESS_URL';
export const CALCOM_OAUTH_FAILURE_URL_CONFIG_KEY = 'CALCOM_OAUTH_FAILURE_URL';

/**
 * The scopes requested when an app does not configure its own.
 *
 * Covers reading the connected profile and reading/writing bookings and schedules, which is what a
 * per-user calendar connect needs.
 */
export const DEFAULT_CALCOM_OAUTH_SCOPES: readonly CalcomOAuthScope[] = ['PROFILE_READ', 'BOOKING_READ', 'BOOKING_WRITE', 'SCHEDULE_READ', 'EVENT_TYPE_READ'];

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
