import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZohoRecruitApi } from './recruit.api';
import { ZohoRecruitServiceConfig } from './recruit.config';
import { readZohoConfigFromConfigService } from '../zoho.config';

export function zohoRecruitServiceConfigFactory(configService: ConfigService): ZohoRecruitServiceConfig {
  const config: ZohoRecruitServiceConfig = {
    zohoRecruit: {
      ...readZohoConfigFromConfigService(configService, 'ZOHO_RECRUIT')
    }
  };

  ZohoRecruitServiceConfig.assertValidConfig(config);
  return config;
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ZohoRecruitServiceConfig,
      inject: [ConfigService],
      useFactory: zohoRecruitServiceConfigFactory
    },
    ZohoRecruitApi
  ],
  exports: [ZohoRecruitApi]
})
export class ZohoRecruitModule {}
