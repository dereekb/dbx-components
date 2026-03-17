import { CalcomWebhookController } from './webhook.calcom.controller';
import { Module, type ModuleMetadata } from '@nestjs/common';
import { CalcomWebhookService } from './webhook.calcom.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CALCOM_WEBHOOK_SECRET_CONFIG_KEY, CalcomWebhookServiceConfig } from './webhook.calcom.config';
import { type Maybe } from '@dereekb/util';

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
