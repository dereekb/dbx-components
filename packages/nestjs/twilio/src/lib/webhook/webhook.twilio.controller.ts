import { DEFAULT_BASE_WEBHOOK_PATH, RawBody, type RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, ForbiddenException, Inject, Post, Req } from '@nestjs/common';
import { type Request } from 'express';
import { TwilioWebhookService } from './webhook.twilio.service';
import { TWILIO_WEBHOOK_INCOMING_PATH, TWILIO_WEBHOOK_PATH, TWILIO_WEBHOOK_STATUS_PATH } from './webhook.twilio.url';

@Controller(`${DEFAULT_BASE_WEBHOOK_PATH}${TWILIO_WEBHOOK_PATH}`)
export class TwilioWebhookController {
  private readonly _twilioWebhookService: TwilioWebhookService;

  constructor(@Inject(TwilioWebhookService) twilioWebhookService: TwilioWebhookService) {
    this._twilioWebhookService = twilioWebhookService;
  }

  @Post(TWILIO_WEBHOOK_STATUS_PATH)
  async handleStatus(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer): Promise<void> {
    if (!rawBody) {
      throw new ForbiddenException('Missing request body.');
    }

    await this._twilioWebhookService.handleStatusCallback(req, rawBody);
  }

  @Post(TWILIO_WEBHOOK_INCOMING_PATH)
  async handleIncoming(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer): Promise<void> {
    if (!rawBody) {
      throw new ForbiddenException('Missing request body.');
    }

    await this._twilioWebhookService.handleIncomingMessage(req, rawBody);
  }
}
