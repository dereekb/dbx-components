import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TwilioModule } from '../twilio.module';
import { type TwilioVerifyServiceSid } from '../twilio.type';
import { TwilioVerifyApi } from './verify.api';
import { TWILIO_VERIFY_SERVICE_SID_ENV_VAR, TwilioVerifyServiceConfig } from './verify.config';
import { TwilioVerifyService } from './verify.service';

/**
 * Factory that creates a {@link TwilioVerifyServiceConfig} from environment variables.
 *
 * @param configService - NestJS config service for reading environment variables.
 * @returns A validated {@link TwilioVerifyServiceConfig}.
 */
export function twilioVerifyServiceConfigFactory(configService: ConfigService): TwilioVerifyServiceConfig {
  const config: TwilioVerifyServiceConfig = {
    twilioVerify: {
      verifyServiceSid: configService.get<TwilioVerifyServiceSid>(TWILIO_VERIFY_SERVICE_SID_ENV_VAR) as TwilioVerifyServiceSid
    }
  };

  TwilioVerifyServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * NestJS module that exposes Twilio Verify (OTP / 2FA) for starting verifications and
 * checking submitted codes.
 *
 * Imports {@link TwilioModule} for the underlying Twilio client.
 */
@Module({
  imports: [ConfigModule, TwilioModule],
  providers: [
    {
      provide: TwilioVerifyServiceConfig,
      inject: [ConfigService],
      useFactory: twilioVerifyServiceConfigFactory
    },
    TwilioVerifyApi,
    TwilioVerifyService
  ],
  exports: [TwilioVerifyApi, TwilioVerifyService]
})
export class TwilioVerifyModule {}
