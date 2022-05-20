import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TwilioApi } from './twilio.api';
import { TwilioServiceConfig } from './twilio.config';
import { TwilioConversationService } from './twilio.conversation.service';
import { TwilioUserService } from './twilio.user.service';

export function twilioServiceConfigFactory(configService: ConfigService): TwilioServiceConfig {
  const config: TwilioServiceConfig = {
    twilio: {
      accountSid: configService.get<string>('TWILIO_ACCOUNT_SID')!,
      authToken: configService.get<string>('TWILIO_AUTH_TOKEN')!,
    }
  };

  TwilioServiceConfig.assertValidConfig(config);
  return config;
};

@Module({
  imports: [
    ConfigModule
  ],
  providers: [
    {
      provide: TwilioServiceConfig,
      inject: [ConfigService],
      useFactory: twilioServiceConfigFactory
    },
    TwilioApi,
    TwilioUserService,
    TwilioConversationService
  ],
  exports: [TwilioApi, TwilioUserService, TwilioConversationService],
})
export class TwilioServiceModule { }
