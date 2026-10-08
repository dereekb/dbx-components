import { catchAllHandlerKey } from '@dereekb/util';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type TwilioWebhookEvent, TwilioOptOutType, TwilioWebhookService } from '@dereekb/nestjs/twilio';
import { NotificationServerActions } from '@dereekb/firebase-server/model';
import { type TwilioNotificationTextOptOutHandler, twilioNotificationTextOptOutHandler } from '@dereekb/firebase-server/twilio';

@Injectable()
export class DemoApiTwilioWebhookService {
  private readonly _twilioWebhookService: TwilioWebhookService;
  private readonly _handleTextOptOut: TwilioNotificationTextOptOutHandler;

  private readonly logger = new Logger('DemoApiTwilioWebhookService');

  constructor(@Inject(TwilioWebhookService) twilioWebhookService: TwilioWebhookService, @Inject(NotificationServerActions) notificationServerActions: NotificationServerActions) {
    this._twilioWebhookService = twilioWebhookService;
    this._handleTextOptOut = twilioNotificationTextOptOutHandler({ notificationServerActions });

    twilioWebhookService.configure(this, (x) => {
      x.set(catchAllHandlerKey(), this.logHandledEvent);

      x.handleStatusCallback(async ({ payload }) => {
        this.logger.log('Received Twilio message status callback successfully.');

        console.log({
          messageSid: payload.MessageSid,
          messageStatus: payload.MessageStatus,
          errorCode: payload.ErrorCode
        });
      });

      x.handleIncomingMessage(async ({ payload }) => {
        // sync STOP/START replies back to the NotificationUsers first. Twilio already confirms keywords, so never reply to them.
        const { optOutType, applied } = await this._handleTextOptOut(payload);

        switch (optOutType) {
          case TwilioOptOutType.STOP:
          case TwilioOptOutType.START:
            this.logger.log(`Received Twilio ${optOutType} reply. Applied to ${applied?.notificationUserIds.length ?? 0} notification user(s).`);
            break;
          case TwilioOptOutType.HELP:
            this.logger.log('Received Twilio HELP reply.');
            break;
          default:
            // any other text. An app would handle the message content here.
            this.logger.log('Received Twilio incoming message successfully.');

            console.log({
              messageSid: payload.MessageSid,
              from: payload.From,
              body: payload.Body,
              numMedia: payload.NumMedia,
              mediaUrls: payload.mediaUrls
            });
            break;
        }
      });
    });
  }

  get twilioWebhookService() {
    return this._twilioWebhookService;
  }

  logHandledEvent(event: TwilioWebhookEvent) {
    this.logger.log('Received Twilio event successfully: ', event.type);
  }
}
