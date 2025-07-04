import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenAIApi } from './openai.api';
import { OPENAI_API_KEY_ENV_VAR, OPENAI_BASE_URL_ENV_VAR, OPENAI_ORGANIZATION_ID_ENV_VAR, OPENAI_PROJECT_ID_ENV_VAR, OpenAIServiceConfig } from './openai.config';
import { OpenAIApiKey, OpenAIOrganizationId, OpenAIProjectId } from './openai.type';

export function openAIServiceConfigFactory(configService: ConfigService): OpenAIServiceConfig {
  const config: OpenAIServiceConfig = {
    openai: {
      config: {
        apiKey: configService.get<OpenAIApiKey>(OPENAI_API_KEY_ENV_VAR) as OpenAIApiKey,
        baseURL: configService.get<string | undefined>(OPENAI_BASE_URL_ENV_VAR) ?? undefined,
        organization: configService.get<OpenAIOrganizationId>(OPENAI_ORGANIZATION_ID_ENV_VAR),
        project: configService.get<OpenAIProjectId>(OPENAI_PROJECT_ID_ENV_VAR)
      }
    }
  };

  OpenAIServiceConfig.assertValidConfig(config);
  return config;
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: OpenAIServiceConfig,
      inject: [ConfigService],
      useFactory: openAIServiceConfigFactory
    },
    OpenAIApi
  ],
  exports: [OpenAIApi]
})
export class OpenAIModule {}
