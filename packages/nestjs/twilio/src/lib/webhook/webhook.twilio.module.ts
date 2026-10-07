import { Module, type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type Maybe } from '@dereekb/util';
import { isPlaceholderTwilioConfigValue, TWILIO_AUTH_TOKEN_ENV_VAR } from '../twilio.config';
import { TwilioWebhookController } from './webhook.twilio.controller';
import { TWILIO_WEBHOOK_AUTH_TOKEN_ENV_VAR, TWILIO_WEBHOOK_SKIP_VERIFY_ENV_VAR, TwilioWebhookServiceConfig } from './webhook.twilio.config';
import { TwilioWebhookService } from './webhook.twilio.service';
import { TwilioWebhookUrlsConfig } from './webhook.twilio.url';

/**
 * Factory that creates a {@link TwilioWebhookServiceConfig} from environment variables.
 *
 * The auth token is read from `TWILIO_WEBHOOK_AUTH_TOKEN`, falling back to `TWILIO_AUTH_TOKEN`. A real
 * value is preferred over a placeholder one (see {@link isPlaceholderTwilioConfigValue}), so a placeholder
 * webhook token does not shadow a real auth token. When both are placeholders the placeholder is kept,
 * which lets the app start and rejects every request as unverified.
 *
 * Requests are verified against the app's public webhook URL when `webhookUrlsConfig` is set, and otherwise
 * against the URL rebuilt from the request headers.
 *
 * @param configService - NestJS config service for reading environment variables.
 * @param webhookUrlsConfig - The app's public webhook URLs.
 * @returns A populated {@link TwilioWebhookServiceConfig}.
 */
export function twilioWebhookServiceConfigFactory(configService: ConfigService, webhookUrlsConfig?: Maybe<TwilioWebhookUrlsConfig>): TwilioWebhookServiceConfig {
  const webhookAuthToken = configService.get<string>(TWILIO_WEBHOOK_AUTH_TOKEN_ENV_VAR);
  const accountAuthToken = configService.get<string>(TWILIO_AUTH_TOKEN_ENV_VAR);
  const authToken = [webhookAuthToken, accountAuthToken].find((x) => !isPlaceholderTwilioConfigValue(x)) ?? webhookAuthToken ?? accountAuthToken;

  const config: TwilioWebhookServiceConfig = {
    twilioWebhook: {
      authToken,
      baseUrl: webhookUrlsConfig?.twilioWebhookUrls?.baseUrl,
      skipVerify: configService.get<string>(TWILIO_WEBHOOK_SKIP_VERIFY_ENV_VAR) === 'true'
    }
  };

  return config;
}

// MARK: App Twilio Webhook Module
export interface ProvideAppTwilioWebhookMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Optional module that exports a {@link TwilioWebhookUrlsConfig}. When provided, requests are verified against
   * the app's public webhook URL.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's Twilio webhook module, which handles
 * incoming Twilio webhook requests at:
 *   - `POST /webhook/twilio/status` (Message status callbacks)
 *   - `POST /webhook/twilio/incoming` (Incoming SMS / MMS messages)
 *
 * Webhook bodies are verified against the X-Twilio-Signature header before dispatch. Only the auth
 * token is needed for that, so this module does not depend on the Twilio module and can be imported in
 * environments without a usable Twilio sending config.
 *
 * Requires the consuming application to register the raw-body middleware from
 * `@dereekb/nestjs` for the `/webhook/twilio` path so that signature verification can read
 * the unparsed form body.
 *
 * Register handlers by injecting the exported {@link TwilioWebhookService} into a provider passed in `providers`.
 *
 * @param config - The module metadata configuration including the optional dependency module.
 * @returns NestJS ModuleMetadata for registering the Twilio webhook module.
 */
export function appTwilioWebhookModuleMetadata(config?: Maybe<ProvideAppTwilioWebhookMetadataConfig>): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config ?? {};
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    controllers: [TwilioWebhookController],
    exports: [TwilioWebhookService, ...(exports ?? [])],
    providers: [
      {
        provide: TwilioWebhookServiceConfig,
        inject: [ConfigService, { token: TwilioWebhookUrlsConfig, optional: true }],
        useFactory: twilioWebhookServiceConfigFactory
      },
      TwilioWebhookService,
      ...(providers ?? [])
    ]
  };
}

/**
 * NestJS module that handles incoming Twilio webhook requests at `/webhook/twilio`. See
 * {@link appTwilioWebhookModuleMetadata}, which also lets the app supply its public webhook URLs.
 */
@Module(appTwilioWebhookModuleMetadata())
export class TwilioWebhookModule {}
