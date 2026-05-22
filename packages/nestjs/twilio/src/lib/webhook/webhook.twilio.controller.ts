import { RawBody, type RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, ForbiddenException, Inject, Post, Req } from '@nestjs/common';
import { type Request } from 'express';
import { TwilioWebhookService } from './webhook.twilio.service';

@Controller('/webhook/twilio')
export class TwilioWebhookController {
  private readonly _twilioWebhookService: TwilioWebhookService;

  constructor(@Inject(TwilioWebhookService) twilioWebhookService: TwilioWebhookService) {
    this._twilioWebhookService = twilioWebhookService;
  }

  @Post('status')
  async handleStatus(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer): Promise<void> {
    if (!rawBody) {
      throw new ForbiddenException('Missing request body.');
    }

    await this._twilioWebhookService.handleStatusCallback(req, rawBody);
  }

  @Post('incoming')
  async handleIncoming(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer): Promise<void> {
    if (!rawBody) {
      throw new ForbiddenException('Missing request body.');
    }

    await this._twilioWebhookService.handleIncomingMessage(req, rawBody);
  }
}
