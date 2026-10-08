import { Module, type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type Maybe } from '@dereekb/util';
import { TwilioApi } from './twilio.api';
import { TWILIO_ACCOUNT_SID_ENV_VAR, TWILIO_API_KEY_SECRET_ENV_VAR, TWILIO_API_KEY_SID_ENV_VAR, TWILIO_AUTH_TOKEN_ENV_VAR, TWILIO_MESSAGING_SERVICE_SID_ENV_VAR, TWILIO_PHONE_NUMBER_ENV_VAR, TWILIO_SANDBOX_ENV_VAR, TwilioServiceConfig, usableTwilioServiceConfig } from './twilio.config';
import { TwilioService } from './twilio.service';
import { type TwilioAccountSid, type TwilioApiKeySecret, type TwilioApiKeySid, type TwilioAuthToken, type TwilioMessagingServiceSid, type TwilioPhoneNumber } from './twilio.type';
import { TwilioWebhookUrlsConfig } from './webhook/webhook.twilio.url';

/**
 * Reads a {@link TwilioServiceConfig} from environment variables without validating it.
 *
 * {@link twilioServiceConfigFactory} builds the validated config from it.
 *
 * @param configService - NestJS config service for reading environment variables.
 * @returns The unvalidated {@link TwilioServiceConfig}.
 */
export function twilioServiceConfigFromConfigService(configService: ConfigService): TwilioServiceConfig {
  return {
    twilio: {
      accountSid: configService.get<TwilioAccountSid>(TWILIO_ACCOUNT_SID_ENV_VAR) as TwilioAccountSid,
      authToken: configService.get<TwilioAuthToken>(TWILIO_AUTH_TOKEN_ENV_VAR),
      apiKeySid: configService.get<TwilioApiKeySid>(TWILIO_API_KEY_SID_ENV_VAR),
      apiKeySecret: configService.get<TwilioApiKeySecret>(TWILIO_API_KEY_SECRET_ENV_VAR)
    },
    messages: {
      defaultFrom: configService.get<TwilioPhoneNumber>(TWILIO_PHONE_NUMBER_ENV_VAR),
      messagingServiceSid: configService.get<TwilioMessagingServiceSid>(TWILIO_MESSAGING_SERVICE_SID_ENV_VAR),
      sandbox: configService.get<string>(TWILIO_SANDBOX_ENV_VAR) === 'true'
    }
  };
}

/**
 * Factory that creates a {@link TwilioServiceConfig} from environment variables.
 *
 * When the environment holds a usable config, its placeholder values are removed (see
 * {@link usableTwilioServiceConfig}), so a placeholder Messaging Service SID or API key never shadows a real
 * sender or auth token. Otherwise the placeholder values are kept, which lets the app start; {@link TwilioApi}
 * only creates the SDK client when it is first used.
 *
 * @param configService - NestJS config service for reading environment variables.
 * @param webhookUrlsConfig - The app's public webhook URLs. When set, outbound texts request status callbacks at its status callback URL.
 * @returns A validated {@link TwilioServiceConfig}.
 */
export function twilioServiceConfigFactory(configService: ConfigService, webhookUrlsConfig?: Maybe<TwilioWebhookUrlsConfig>): TwilioServiceConfig {
  const envConfig = twilioServiceConfigFromConfigService(configService);
  const config = usableTwilioServiceConfig(envConfig) ?? envConfig;
  const defaultStatusCallback = webhookUrlsConfig?.twilioWebhookUrls?.statusCallbackUrl ?? config.messages.defaultStatusCallback;

  const result: TwilioServiceConfig = {
    ...config,
    messages: { ...config.messages, defaultStatusCallback }
  };

  TwilioServiceConfig.assertValidConfig(result);
  return result;
}

// MARK: App Twilio Module
export interface ProvideAppTwilioMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Optional module that exports a {@link TwilioWebhookUrlsConfig}. When provided, outbound texts request status
   * callbacks at the app's `/webhook/twilio/status` route.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's Twilio module, which provides
 * {@link TwilioApi} and {@link TwilioService} for sending SMS.
 *
 * Reads the Twilio credentials and default sender from environment variables.
 *
 * @param config - The module metadata configuration including the optional dependency module.
 * @returns NestJS ModuleMetadata for registering the Twilio module.
 */
export function appTwilioModuleMetadata(config?: Maybe<ProvideAppTwilioMetadataConfig>): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config ?? {};
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [TwilioApi, TwilioService, ...(exports ?? [])],
    providers: [
      {
        provide: TwilioServiceConfig,
        inject: [ConfigService, { token: TwilioWebhookUrlsConfig, optional: true }],
        useFactory: twilioServiceConfigFactory
      },
      TwilioApi,
      TwilioService,
      ...(providers ?? [])
    ]
  };
}

/**
 * NestJS module that provides the {@link TwilioApi} and {@link TwilioService} for sending SMS
 * via Twilio.
 *
 * Reads Twilio credentials and default sender configuration from environment variables. Use
 * {@link appTwilioModuleMetadata} to supply the app's webhook URLs.
 */
@Module(appTwilioModuleMetadata())
export class TwilioModule {}
