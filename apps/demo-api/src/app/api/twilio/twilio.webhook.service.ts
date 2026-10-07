import { catchAllHandlerKey } from '@dereekb/util';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type TwilioWebhookEvent, TwilioWebhookService } from '@dereekb/nestjs/twilio';

@Injectable()
export class DemoApiTwilioWebhookService {
  private readonly _twilioWebhookService: TwilioWebhookService;

  private readonly logger = new Logger('DemoApiTwilioWebhookService');

  constructor(@Inject(TwilioWebhookService) twilioWebhookService: TwilioWebhookService) {
    this._twilioWebhookService = twilioWebhookService;

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
        this.logger.log('Received Twilio incoming message successfully.');

        console.log({
          messageSid: payload.MessageSid,
          numMedia: payload.NumMedia
        });
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
