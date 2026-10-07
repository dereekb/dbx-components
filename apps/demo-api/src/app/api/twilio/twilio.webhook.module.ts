import { Module } from '@nestjs/common';
import { appTwilioWebhookModuleMetadata } from '@dereekb/nestjs/twilio';
import { DemoApiTwilioDependencyModule } from './twilio.module';
import { DemoApiTwilioWebhookService } from './twilio.webhook.service';
import { NotificationModule } from '../../common/model/notification/notification.module';

/**
 * Receives Twilio message status callbacks and incoming messages at `/api/webhook/twilio/status` and `/api/webhook/twilio/incoming`.
 *
 * Requests are verified against the public webhook URL built from the app's environment.
 *
 * Kept apart from `DemoApiTwilioModule`, which the notification module imports for sending texts. Imports the notification module
 * to sync STOP/START replies back to the NotificationUsers. There is no cycle, since the notification module imports `DemoApiTwilioModule`,
 * not this module. It imports it from `twilio.module` directly rather than the `./index` barrel, which would load this file mid-cycle.
 */
@Module(
  appTwilioWebhookModuleMetadata({
    dependencyModule: DemoApiTwilioDependencyModule,
    imports: [NotificationModule],
    providers: [DemoApiTwilioWebhookService],
    exports: [DemoApiTwilioWebhookService]
  })
)
export class DemoApiTwilioWebhookModule {}
