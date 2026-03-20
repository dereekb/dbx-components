import { CalcomWebhookController } from './webhook.calcom.controller';
import { Module, type ModuleMetadata } from '@nestjs/common';
import { CalcomWebhookService } from './webhook.calcom.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CALCOM_WEBHOOK_SECRET_CONFIG_KEY, CalcomWebhookServiceConfig } from './webhook.calcom.config';
import { type Maybe } from '@dereekb/util';

/**
 * Factory function that creates a {@link CalcomWebhookServiceConfig} from NestJS ConfigService environment variables.
 *
 * @param configService - the NestJS ConfigService instance
 * @returns a validated CalcomWebhookServiceConfig
 */
export function calcomWebhookServiceConfigFactory(configService: ConfigService): CalcomWebhookServiceConfig {
  const config: CalcomWebhookServiceConfig = {
    webhookConfig: {
      webhookSecret: configService.get<string>(CALCOM_WEBHOOK_SECRET_CONFIG_KEY) as string
    }
  };

  CalcomWebhookServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * Configures webhooks for the service.
 */
@Module({
  imports: [ConfigModule],
  controllers: [CalcomWebhookController],
  exports: [CalcomWebhookService],
  providers: [
    {
      provide: CalcomWebhookServiceConfig,
      inject: [ConfigService],
      useFactory: calcomWebhookServiceConfigFactory
    },
    CalcomWebhookService
  ]
})
export class CalcomWebhookModule {}

// MARK: App Calcom Webhook Module
export interface ProvideAppCalcomWebhookMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Optional dependency module that provides required services.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's CalcomWebhookModule.
 *
 * @param config - the module metadata configuration including optional dependency module
 * @returns NestJS ModuleMetadata for registering the CalcomWebhookModule
 */
export function appCalcomWebhookModuleMetadata(config: ProvideAppCalcomWebhookMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    controllers: [CalcomWebhookController],
    exports: [CalcomWebhookService, ...(exports ?? [])],
    providers: [
      {
        provide: CalcomWebhookServiceConfig,
        inject: [ConfigService],
        useFactory: calcomWebhookServiceConfigFactory
      },
      CalcomWebhookService,
      ...(providers ?? [])
    ]
  };
}
