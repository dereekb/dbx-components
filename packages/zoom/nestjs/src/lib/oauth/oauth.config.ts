import { characterPrefixSuffixInstance } from '@dereekb/util';
import { ZoomOAuthConfig, ZoomOAuthFactoryConfig } from '@dereekb/zoom';
import { ConfigService } from '@nestjs/config';

export interface ZoomOAuthServiceApiConfig extends Omit<ZoomOAuthConfig, 'userRefreshToken' | 'type'> {
  readonly authEntityType: 'account';
}

/**
 * Configuration for ZoomService
 */
export abstract class ZoomOAuthServiceConfig {
  readonly zoomOAuth!: ZoomOAuthServiceApiConfig;
  readonly factoryConfig?: ZoomOAuthFactoryConfig;

  static assertValidConfig(config: ZoomOAuthServiceConfig) {
    const { zoomOAuth } = config;

    if (!zoomOAuth) {
      throw new Error('ZoomOAuthServiceConfig.zoomOAuth is required');
    } else {
      if (!zoomOAuth.accountId) {
        throw new Error('ZoomOAuthServiceConfig.zoomOAuth.accountId is required');
      } else if (!zoomOAuth.clientSecret) {
        throw new Error('ZoomOAuthServiceConfig.zoomOAuth.clientSecret is required');
      } else if (!zoomOAuth.clientId) {
        throw new Error('ZoomOAuthServiceConfig.zoomOAuth.clientId is required');
      }
    }
  }
}

export function readZoomOAuthServiceConfigFromConfigService(configService: ConfigService, prefix?: string): ZoomOAuthServiceConfig {
  const prefixString = characterPrefixSuffixInstance({ suffix: '_', suffixEmptyString: false }).prefixSuffixString(prefix ?? '');

  const accountIdKey = `${prefixString}ZOOM_ACCOUNT_ID`;
  const clientIdKey = `${prefixString}ZOOM_CLIENT_ID`;
  const clientSecretKey = `${prefixString}ZOOM_CLIENT_SECRET`;

  const accountId = configService.getOrThrow<string>(accountIdKey);
  const clientId = configService.getOrThrow<string>(clientIdKey);
  const clientSecret = configService.getOrThrow<string>(clientSecretKey);

  const config: ZoomOAuthServiceConfig = {
    zoomOAuth: {
      authEntityType: 'account',
      accountId,
      clientId,
      clientSecret
    }
  };

  ZoomOAuthServiceConfig.assertValidConfig(config);
  return config;
}
