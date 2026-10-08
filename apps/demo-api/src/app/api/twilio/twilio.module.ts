import { Module } from '@nestjs/common';
import { twilioWebhookUrlsConfigProvider } from '@dereekb/firebase-server/twilio';
import { TwilioWebhookUrlsConfig, appTwilioModuleMetadata } from '@dereekb/nestjs/twilio';

/**
 * Supplies the app's public Twilio webhook URLs, built from the server environment, to the Twilio modules.
 *
 * Outbound texts request status callbacks at `/api/webhook/twilio/status`, and webhook requests are verified against
 * the same URL. No URLs are supplied when the webhook URL is not reachable from the internet, such as `localhost`
 * during local development.
 */
@Module({
  providers: [twilioWebhookUrlsConfigProvider()],
  exports: [TwilioWebhookUrlsConfig]
})
export class DemoApiTwilioDependencyModule {}

/**
 * Provides `TwilioApi` and `TwilioService` for sending texts.
 *
 * The committed `.env` only holds placeholder values, so set real credentials in the git-ignored `.env.local` to
 * send texts locally, with `TWILIO_SANDBOX=true` to run the send path without sending real SMS.
 */
@Module(appTwilioModuleMetadata({ dependencyModule: DemoApiTwilioDependencyModule }))
export class DemoApiTwilioModule {}
