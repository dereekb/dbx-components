import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZohoRecruitApi } from './recruit.api';
import { ZohoRecruitServiceConfig } from './recruit.config';
import { ZOHO_API_URL_CONFIG_KEY, readZohoConfigFromConfigService, zohoConfigServiceReaderFunction } from '../zoho.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';
import { ZohoAccountsServiceConfig, zohoAccountsServiceConfigFromConfigService } from '../accounts/accounts.config';
import { ZOHO_ACCOUNTS_US_API_URL, ZOHO_RECRUIT_SERVICE_NAME } from '@dereekb/zoho';

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

@Module({
  imports: [ConfigModule],
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
    ZohoAccountsApi
  ],
  exports: [ZohoRecruitApi]
})
export class ZohoRecruitModule {}
