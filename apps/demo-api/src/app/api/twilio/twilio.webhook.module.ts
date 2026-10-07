import { Module } from '@nestjs/common';
import { appTwilioWebhookModuleMetadata } from '@dereekb/nestjs/twilio';
import { DemoApiTwilioDependencyModule } from './twilio.module';
import { DemoApiTwilioWebhookService } from './twilio.webhook.service';

/**
 * Receives Twilio message status callbacks and incoming messages at `/api/webhook/twilio/status` and `/api/webhook/twilio/incoming`.
 *
 * Requests are verified against the public webhook URL built from the app's environment.
 *
 * Kept apart from `DemoApiTwilioModule`, which the notification module imports for sending texts.
 */
@Module(
  appTwilioWebhookModuleMetadata({
    dependencyModule: DemoApiTwilioDependencyModule,
    providers: [DemoApiTwilioWebhookService],
    exports: [DemoApiTwilioWebhookService]
  })
)
export class DemoApiTwilioWebhookModule {}
