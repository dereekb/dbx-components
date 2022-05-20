import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CLIENT_WEB_APP_URL_ENV_VAR } from "./client";
import { ClientAppServiceConfig } from "./client.config";
import { ClientAppService } from "./client.service";

export function clientAppConfigFactory(configService: ConfigService): ClientAppServiceConfig {
  const config: ClientAppServiceConfig = {
    client: {
      clientWebAppUrl: configService.get<string>(CLIENT_WEB_APP_URL_ENV_VAR)!
    }
  };

  ClientAppServiceConfig.assertValidConfig(config);
  return config;
};

@Module({
  imports: [
    ConfigModule
  ],
  providers: [
    {
      provide: ClientAppServiceConfig,
      inject: [ConfigService],
      useFactory: clientAppConfigFactory
    }
  ],
  exports: [ClientAppService],
})
export class ClientAppModule { }
