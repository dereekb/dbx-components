import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServerEnvironmentService } from '@dereekb/nestjs';
import { TwilioApi, TwilioService, twilioServiceConfigFromConfigService, usableTwilioServiceConfig } from '@dereekb/nestjs/twilio';
import { type Maybe } from '@dereekb/util';

/**
 * Injection token for the demo app's optional {@link TwilioService}.
 *
 * Resolves to null when texts are not sent through Twilio. See {@link demoApiTwilioServiceFactory}.
 */
export const DEMO_API_TWILIO_SERVICE_TOKEN = 'DEMO_API_TWILIO_SERVICE_TOKEN';

/**
 * Builds the demo app's {@link TwilioService}, or null when Twilio should not be used.
 *
 * Returns null in the testing environment, so tests keep the ignore-texts path, and when the environment
 * has no usable Twilio config. The committed `.env` only holds placeholder values, so set real credentials
 * in the git-ignored `.env.local` to send texts locally, with `TWILIO_SANDBOX=true` to run the send path
 * without sending real SMS.
 *
 * This deliberately does not use `TwilioModule`, which constructs the SDK eagerly and throws on the
 * placeholder values.
 *
 * @param configService - Supplies the Twilio environment variables.
 * @param serverEnvironmentService - Used to detect the testing environment.
 * @returns The TwilioService, or null if texts are not sent through Twilio.
 */
export function demoApiTwilioServiceFactory(configService: ConfigService, serverEnvironmentService: ServerEnvironmentService): Maybe<TwilioService> {
  const logger = new Logger('DemoApiTwilioModule');
  let twilioService: Maybe<TwilioService> = null;

  if (!serverEnvironmentService.isTestingEnv) {
    const config = usableTwilioServiceConfig(twilioServiceConfigFromConfigService(configService));

    if (config) {
      twilioService = new TwilioService(new TwilioApi(config));
      logger.log(`Sending notification texts through Twilio${config.messages.sandbox ? ' in sandbox mode' : ''}.`);
    } else {
      logger.log('No usable Twilio config is set. Notification texts will be ignored.');
    }
  }

  return twilioService;
}

/**
 * Provides the demo app's optional {@link TwilioService} under {@link DEMO_API_TWILIO_SERVICE_TOKEN}.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DEMO_API_TWILIO_SERVICE_TOKEN,
      useFactory: demoApiTwilioServiceFactory,
      inject: [ConfigService, ServerEnvironmentService]
    }
  ],
  exports: [DEMO_API_TWILIO_SERVICE_TOKEN]
})
export class DemoApiTwilioModule {}
