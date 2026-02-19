import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZohoCrmApi } from './crm.api';
import { ZohoCrmServiceConfig } from './crm.config';
import { ZOHO_API_URL_CONFIG_KEY, zohoConfigServiceReaderFunction } from '../zoho.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';
import { ZohoAccountsServiceConfig, zohoAccountsServiceConfigFromConfigService } from '../accounts/accounts.config';
import { ZOHO_CRM_SERVICE_NAME } from '@dereekb/zoho';
import { type Maybe } from '@dereekb/util';

// MARK: Provider Factories
export function zohoCrmServiceConfigFactory(configService: ConfigService): ZohoCrmServiceConfig {
  const getFromConfigService = zohoConfigServiceReaderFunction(ZOHO_CRM_SERVICE_NAME, configService);

  const config: ZohoCrmServiceConfig = {
    zohoCrm: {
      apiUrl: getFromConfigService(ZOHO_API_URL_CONFIG_KEY)
    }
  };

  ZohoCrmServiceConfig.assertValidConfig(config);
  return config;
}

export function zohoCrmAccountServiceConfigFactory(configService: ConfigService): ZohoAccountsServiceConfig {
  return zohoAccountsServiceConfigFromConfigService({
    configService,
    serviceAccessTokenKey: 'crm'
  });
}

// MARK: App Zoho Crm Module
export interface ProvideAppZohoCrmMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The ZohoCrmModule requires the following dependencies in order to initialze properly:
   * - ZohoAccountsAccessTokenCacheService
   *
   * This module declaration makes it easier to import a module that exports those depenendencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's ZohoCrmModule.
 *
 * @param provide
 * @param useFactory
 * @returns
 */
export function appZohoCrmModuleMetadata(config: ProvideAppZohoCrmMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [ZohoCrmApi, ...(exports ?? [])],
    providers: [
      {
        provide: ZohoCrmServiceConfig,
        inject: [ConfigService],
        useFactory: zohoCrmServiceConfigFactory
      },
      ZohoCrmApi,
      // Accounts
      {
        provide: ZohoAccountsServiceConfig,
        inject: [ConfigService],
        useFactory: zohoCrmAccountServiceConfigFactory
      },
      ZohoAccountsApi,
      ...(providers ?? [])
    ]
  };
}
