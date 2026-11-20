import { catchAllHandlerKey } from '@dereekb/util';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type TwilioWebhookEvent, TwilioOptOutType, TwilioWebhookService } from '@dereekb/nestjs/twilio';
import { FirebaseServerAnalyticsService } from '@dereekb/firebase-server';
import { NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NotificationServerActions, type NotificationServerActionsContext } from '@dereekb/firebase-server/model';
import { type TwilioNotificationTextOptOutHandler, twilioNotificationTextOptOutHandler } from '@dereekb/firebase-server/twilio';
import { demoTwilioTextKeywordAnalyticsHandler } from './twilio.analytics';

@Injectable()
export class DemoApiTwilioWebhookService {
  private readonly _twilioWebhookService: TwilioWebhookService;
  private readonly _handleTextOptOut: TwilioNotificationTextOptOutHandler;

  private readonly logger = new Logger('DemoApiTwilioWebhookService');

  constructor(
    @Inject(TwilioWebhookService) twilioWebhookService: TwilioWebhookService,
    @Inject(NotificationServerActions) notificationServerActions: NotificationServerActions,
    @Inject(NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN) notificationServerActionsContext: NotificationServerActionsContext,
    @Inject(FirebaseServerAnalyticsService) analyticsService: FirebaseServerAnalyticsService
  ) {
    this._twilioWebhookService = twilioWebhookService;
    this._handleTextOptOut = twilioNotificationTextOptOutHandler({
      notificationServerActions,
      // sends a "Text Keyword" analytics event per NotificationUser that texts STOP, START or HELP
      onTextKeyword: demoTwilioTextKeywordAnalyticsHandler({ context: notificationServerActionsContext, analyticsService })
    });

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
        // sync STOP/START replies back to the NotificationUsers first, then report the keyword to analytics. Twilio's Advanced Opt-Out
        // already replies to STOP, START and HELP, so never reply to them, HELP included.
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
