import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZohoAccountsApi } from './accounts.api';
import { ZohoAccountsServiceConfig } from './recruit.config';
import { readZohoConfigFromConfigService } from '../zoho.config';

export function zohoAccountsServiceConfigFactory(configService: ConfigService): ZohoAccountsServiceConfig {
  const config: ZohoAccountsServiceConfig = {
    zohoAccounts: {
      ...readZohoConfigFromConfigService(configService, 'ZOHO_RECRUIT')
    }
  };

  ZohoAccountsServiceConfig.assertValidConfig(config);
  return config;
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ZohoAccountsServiceConfig,
      inject: [ConfigService],
      useFactory: zohoAccountsServiceConfigFactory
    },
    ZohoAccountsApi
  ],
  exports: [ZohoAccountsApi]
})
export class ZohoAccountsModule {}
