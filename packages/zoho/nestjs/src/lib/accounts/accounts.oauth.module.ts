import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZohoAccountsOAuthApi } from './accounts.oauth.api';
import { ZohoAccountsOAuthServiceConfig, zohoAccountsOAuthServiceConfigFactory } from './accounts.oauth.config';

export type ZohoAccountsOAuthServiceConfigFactory = (configService: ConfigService) => ZohoAccountsOAuthServiceConfig;

// MARK: App Zoho Accounts OAuth Module
export interface ProvideAppZohoAccountsOAuthMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Optional override for the ZohoAccountsOAuthServiceConfigFactory.
   *
   * @default zohoAccountsOAuthServiceConfigFactory
   */
  readonly zohoAccountsOAuthServiceConfigFactory?: ZohoAccountsOAuthServiceConfigFactory;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's ZohoAccountsOAuthModule.
 *
 * Unlike `appZohoCrmModuleMetadata`, this needs no `ZohoAccountsAccessTokenCacheService` and
 * therefore no dependency module: a per-user connect flow has no server token to cache.
 *
 * @param config - The module metadata configuration including an optional config factory.
 * @returns NestJS ModuleMetadata for registering the ZohoAccountsOAuthApi.
 */
export function appZohoAccountsOAuthModuleMetadata(config: ProvideAppZohoAccountsOAuthMetadataConfig): ModuleMetadata {
  const { imports, exports, providers } = config;

  return {
    imports: [ConfigModule, ...(imports ?? [])],
    exports: [ZohoAccountsOAuthApi, ...(exports ?? [])],
    providers: [
      {
        provide: ZohoAccountsOAuthServiceConfig,
        inject: [ConfigService],
        useFactory: config.zohoAccountsOAuthServiceConfigFactory ?? zohoAccountsOAuthServiceConfigFactory
      },
      ZohoAccountsOAuthApi,
      ...(providers ?? [])
    ]
  };
}
