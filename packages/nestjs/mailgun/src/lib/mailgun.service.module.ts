import { ServerEnvironmentService } from '@dereekb/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { convertMailgunRecipientToString } from './mailgun';
import { MailgunApi } from './mailgun.api';
import { MailgunServiceConfig } from './mailgun.config';
import { MailgunService } from './mailgun.service';

export function mailgunServiceConfigFactory(configService: ConfigService, serverEnvironmentService: ServerEnvironmentService): MailgunServiceConfig {
  const useSandbox = configService.get<boolean>('USE_MAILGUN_SANDBOX') ?? false;

  let key = configService.get<string>('MAILGUN_API_KEY');
  let domain = configService.get<string>('MAILGUN_DOMAIN');

  if (useSandbox) {
    key = configService.get<string>('MAILGUN_SANDBOX_API_KEY');
    domain = configService.get<string>('MAILGUN_SANDBOX_DOMAIN');

    if (!key || !domain) {
      throw new Error('USE_MAILGUN_SANDBOX is set to "true", but no sandbox variables (MAILGUN_SANDBOX_API_KEY, MAILGUN_SANDBOX_DOMAIN) are provided.');
    } else if (!serverEnvironmentService.isTestingEnv) {
      console.log('Using Mailgun Sandbox Domain: ', domain);
    }
  } else if (!serverEnvironmentService.isTestingEnv) {
    console.log('Using Mailgun Production Domain: ', domain);
  }

  const name = configService.get<string>('MAILGUN_SENDER_NAME');
  const email = configService.get<string>('MAILGUN_SENDER_EMAIL');
  const url = configService.get<string>('MAILGUN_API_URL');
  const recipientVariablePrefix = configService.get<string | false | undefined>('MAILGUN_MESSAGES_RECIPIENT_VARIABLE_PREFIX') ?? undefined;

  if (!email) {
    throw new Error('MAILGUN_SENDER_EMAIL is required but was not configured.');
  } else if (!key) {
    throw new Error('MAILGUN_API_KEY is required but was not configured.');
  } else if (!domain) {
    throw new Error('MAILGUN_DOMAIN is required but was not configured.');
  }

  const config: MailgunServiceConfig = {
    mailgun: {
      username: configService.get<string>('MAILGUN_USERNAME') ?? 'api',
      key,
      url
    },
    domain,
    sender: convertMailgunRecipientToString({
      name,
      email
    }),
    messages: {
      recipientVariablePrefix
    }
  };

  MailgunServiceConfig.assertValidConfig(config);
  return config;
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MailgunServiceConfig,
      inject: [ConfigService, ServerEnvironmentService],
      useFactory: mailgunServiceConfigFactory
    },
    MailgunApi,
    MailgunService
  ],
  exports: [MailgunApi, MailgunService]
})
export class MailgunServiceModule {}
