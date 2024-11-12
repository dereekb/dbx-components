import { Module, ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZohoRecruitApi } from './recruit.api';
import { ZohoRecruitServiceConfig } from './recruit.config';
import { ZOHO_API_URL_CONFIG_KEY, zohoConfigServiceReaderFunction } from '../zoho.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';
import { ZohoAccountsServiceConfig, zohoAccountsServiceConfigFromConfigService } from '../accounts/accounts.config';
import { ZOHO_RECRUIT_SERVICE_NAME } from '@dereekb/zoho';
import { Maybe } from '@dereekb/util';

// MARK: Provider Factories
export function zohoRecruitServiceConfigFactory(configService: ConfigService): ZohoRecruitServiceConfig {
  const getFromConfigService = zohoConfigServiceReaderFunction(ZOHO_RECRUIT_SERVICE_NAME, configService);

  const config: ZohoRecruitServiceConfig = {
    zohoRecruit: {
      apiUrl: getFromConfigService(ZOHO_API_URL_CONFIG_KEY)
    }
  };

  ZohoRecruitServiceConfig.assertValidConfig(config);
  return config;
}

export function zohoRecruitAccountServiceConfigFactory(configService: ConfigService): ZohoAccountsServiceConfig {
  return zohoAccountsServiceConfigFromConfigService({
    configService,
    serviceAccessTokenKey: 'recruit'
  });
}

// MARK: App Zoho Recruit Module
export interface ProvideAppZohoRecruitMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The ZohoRecruitModule requires the following dependencies in order to initialze properly:
   * - ZohoAccountsAccessTokenCacheService
   *
   * This module declaration makes it easier to import a module that exports those depenendencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's ZohoRecruitModule.
 *
 * @param provide
 * @param useFactory
 * @returns
 */
export function appZohoRecruitModuleMetadata(config: ProvideAppZohoRecruitMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [ZohoRecruitApi, ...(exports ?? [])],
    providers: [
      {
        provide: ZohoRecruitServiceConfig,
        inject: [ConfigService],
        useFactory: zohoRecruitServiceConfigFactory
      },
      ZohoRecruitApi,
      // Accounts
      {
        provide: ZohoAccountsServiceConfig,
        inject: [ConfigService],
        useFactory: zohoRecruitAccountServiceConfigFactory
      },
      ZohoAccountsApi,
      ...(providers ?? [])
    ]
  };
}
