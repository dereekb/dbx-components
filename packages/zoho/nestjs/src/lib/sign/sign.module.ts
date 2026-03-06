import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZohoSignApi } from './sign.api';
import { ZohoSignServiceConfig } from './sign.config';
import { ZOHO_API_URL_CONFIG_KEY, zohoConfigServiceReaderFunction } from '../zoho.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';
import { ZohoAccountsServiceConfig, zohoAccountsServiceConfigFromConfigService } from '../accounts/accounts.config';
import { ZOHO_SIGN_SERVICE_NAME } from '@dereekb/zoho';
import { type Maybe } from '@dereekb/util';

// MARK: Provider Factories
export function zohoSignServiceConfigFactory(configService: ConfigService): ZohoSignServiceConfig {
  const getFromConfigService = zohoConfigServiceReaderFunction(ZOHO_SIGN_SERVICE_NAME, configService);

  const config: ZohoSignServiceConfig = {
    zohoSign: {
      apiUrl: getFromConfigService(ZOHO_API_URL_CONFIG_KEY)
    }
  };

  ZohoSignServiceConfig.assertValidConfig(config);
  return config;
}

export function zohoSignAccountServiceConfigFactory(configService: ConfigService): ZohoAccountsServiceConfig {
  return zohoAccountsServiceConfigFromConfigService({
    configService,
    serviceAccessTokenKey: ZOHO_SIGN_SERVICE_NAME
  });
}

// MARK: App Zoho Sign Module
export interface ProvideAppZohoSignMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The ZohoSignModule requires the following dependencies in order to initialize properly:
   * - ZohoAccountsAccessTokenCacheService
   *
   * This module declaration makes it easier to import a module that exports those dependencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's ZohoSignModule.
 *
 * @param provide
 * @param useFactory
 * @returns
 */
export function appZohoSignModuleMetadata(config: ProvideAppZohoSignMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [ZohoSignApi, ...(exports ?? [])],
    providers: [
      {
        provide: ZohoSignServiceConfig,
        inject: [ConfigService],
        useFactory: zohoSignServiceConfigFactory
      },
      ZohoSignApi,
      // Accounts
      {
        provide: ZohoAccountsServiceConfig,
        inject: [ConfigService],
        useFactory: zohoSignAccountServiceConfigFactory
      },
      ZohoAccountsApi,
      ...(providers ?? [])
    ]
  };
}
