import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TwilioApi } from './twilio.api';
import { TWILIO_ACCOUNT_SID_ENV_VAR, TWILIO_API_KEY_SECRET_ENV_VAR, TWILIO_API_KEY_SID_ENV_VAR, TWILIO_AUTH_TOKEN_ENV_VAR, TWILIO_MESSAGING_SERVICE_SID_ENV_VAR, TWILIO_PHONE_NUMBER_ENV_VAR, TWILIO_SANDBOX_ENV_VAR, TWILIO_STATUS_CALLBACK_URL_ENV_VAR, TwilioServiceConfig } from './twilio.config';
import { TwilioService } from './twilio.service';
import { type TwilioAccountSid, type TwilioApiKeySecret, type TwilioApiKeySid, type TwilioAuthToken, type TwilioMessagingServiceSid, type TwilioPhoneNumber, type TwilioStatusCallbackUrl } from './twilio.type';

/**
 * Factory that creates a {@link TwilioServiceConfig} from environment variables.
 *
 * @param configService - NestJS config service for reading environment variables.
 * @returns A validated {@link TwilioServiceConfig}.
 */
export function twilioServiceConfigFactory(configService: ConfigService): TwilioServiceConfig {
  const config: TwilioServiceConfig = {
    twilio: {
      accountSid: configService.get<TwilioAccountSid>(TWILIO_ACCOUNT_SID_ENV_VAR) as TwilioAccountSid,
      authToken: configService.get<TwilioAuthToken>(TWILIO_AUTH_TOKEN_ENV_VAR),
      apiKeySid: configService.get<TwilioApiKeySid>(TWILIO_API_KEY_SID_ENV_VAR),
      apiKeySecret: configService.get<TwilioApiKeySecret>(TWILIO_API_KEY_SECRET_ENV_VAR)
    },
    messages: {
      defaultFrom: configService.get<TwilioPhoneNumber>(TWILIO_PHONE_NUMBER_ENV_VAR),
      messagingServiceSid: configService.get<TwilioMessagingServiceSid>(TWILIO_MESSAGING_SERVICE_SID_ENV_VAR),
      defaultStatusCallback: configService.get<TwilioStatusCallbackUrl>(TWILIO_STATUS_CALLBACK_URL_ENV_VAR),
      sandbox: configService.get<string>(TWILIO_SANDBOX_ENV_VAR) === 'true'
    }
  };

  TwilioServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * NestJS module that provides the {@link TwilioApi} and {@link TwilioService} for sending SMS
 * via Twilio.
 *
 * Reads Twilio credentials and default sender configuration from environment variables.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: TwilioServiceConfig,
      inject: [ConfigService],
      useFactory: twilioServiceConfigFactory
    },
    TwilioApi,
    TwilioService
  ],
  exports: [TwilioApi, TwilioService]
})
export class TwilioModule {}
