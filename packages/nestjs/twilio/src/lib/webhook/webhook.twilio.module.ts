import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TwilioModule } from '../twilio.module';
import { TwilioWebhookController } from './webhook.twilio.controller';
import { TWILIO_WEBHOOK_AUTH_TOKEN_ENV_VAR, TWILIO_WEBHOOK_BASE_URL_ENV_VAR, TWILIO_WEBHOOK_SKIP_VERIFY_ENV_VAR, TwilioWebhookServiceConfig } from './webhook.twilio.config';
import { TwilioWebhookService } from './webhook.twilio.service';

/**
 * Factory that creates a {@link TwilioWebhookServiceConfig} from environment variables.
 *
 * @param configService - NestJS config service for reading environment variables.
 * @returns A populated {@link TwilioWebhookServiceConfig}.
 */
export function twilioWebhookServiceConfigFactory(configService: ConfigService): TwilioWebhookServiceConfig {
  const config: TwilioWebhookServiceConfig = {
    twilioWebhook: {
      authToken: configService.get<string>(TWILIO_WEBHOOK_AUTH_TOKEN_ENV_VAR),
      baseUrl: configService.get<string>(TWILIO_WEBHOOK_BASE_URL_ENV_VAR),
      skipVerify: configService.get<string>(TWILIO_WEBHOOK_SKIP_VERIFY_ENV_VAR) === 'true'
    }
  };

  return config;
}

/**
 * NestJS module that handles incoming Twilio webhook requests at:
 *   - `POST /webhook/twilio/status` (Message status callbacks)
 *   - `POST /webhook/twilio/incoming` (Incoming SMS / MMS messages)
 *
 * Webhook bodies are verified against the X-Twilio-Signature header before dispatch.
 *
 * Requires the consuming application to register the raw-body middleware from
 * `@dereekb/nestjs` for the `/webhook/twilio` path so that signature verification can read
 * the unparsed form body.
 */
@Module({
  imports: [ConfigModule, TwilioModule],
  controllers: [TwilioWebhookController],
  providers: [
    {
      provide: TwilioWebhookServiceConfig,
      inject: [ConfigService],
      useFactory: twilioWebhookServiceConfigFactory
    },
    TwilioWebhookService
  ],
  exports: [TwilioWebhookService]
})
export class TwilioWebhookModule {}
