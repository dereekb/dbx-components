import { type CalcomOAuthFactoryConfig } from '@dereekb/calcom';
import { type ConfigService } from '@nestjs/config';

export const CALCOM_SERVICE_NAME = 'calcom';
export const CALCOM_CLIENT_ID_CONFIG_KEY = 'CALCOM_CLIENT_ID';
export const CALCOM_CLIENT_SECRET_CONFIG_KEY = 'CALCOM_CLIENT_SECRET';
export const CALCOM_REFRESH_TOKEN_CONFIG_KEY = 'CALCOM_REFRESH_TOKEN';
export const CALCOM_API_KEY_CONFIG_KEY = 'CALCOM_API_KEY';

export interface CalcomOAuthServiceApiConfig {
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly refreshToken?: string;
  readonly apiKey?: string;
}

/**
 * Configuration for CalcomOAuthService
 */
export abstract class CalcomOAuthServiceConfig {
  readonly calcomOAuth!: CalcomOAuthServiceApiConfig;
  readonly factoryConfig?: CalcomOAuthFactoryConfig;

  static assertValidConfig(config: CalcomOAuthServiceConfig) {
    const { calcomOAuth } = config;

    if (!calcomOAuth) {
      throw new Error('CalcomOAuthServiceConfig.calcomOAuth is required');
    }

    const hasApiKey = !!calcomOAuth.apiKey;
    const hasOAuth = !!calcomOAuth.clientId && !!calcomOAuth.clientSecret;

    if (!hasApiKey && !hasOAuth) {
      throw new Error('CalcomOAuthServiceConfig requires either apiKey or clientId+clientSecret');
    }
  }
}

/**
 * Factory function that creates a {@link CalcomOAuthServiceConfig} from NestJS ConfigService environment variables.
 *
 * @param configService - the NestJS ConfigService instance
 * @returns a validated CalcomOAuthServiceConfig
 */
export function calcomOAuthServiceConfigFactory(configService: ConfigService): CalcomOAuthServiceConfig {
  const clientId = configService.get<string>(CALCOM_CLIENT_ID_CONFIG_KEY);
  const clientSecret = configService.get<string>(CALCOM_CLIENT_SECRET_CONFIG_KEY);
  const refreshToken = configService.get<string>(CALCOM_REFRESH_TOKEN_CONFIG_KEY);
  const apiKey = configService.get<string>(CALCOM_API_KEY_CONFIG_KEY);

  const config: CalcomOAuthServiceConfig = {
    calcomOAuth: {
      clientId: clientId || undefined,
      clientSecret: clientSecret || undefined,
      refreshToken: refreshToken || undefined,
      apiKey: apiKey || undefined
    }
  };

  CalcomOAuthServiceConfig.assertValidConfig(config);
  return config;
}
