import { RawBody, type RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, Inject, Post, Req } from '@nestjs/common';
import { type Request } from 'express';
import { ZohoSignWebhookService } from './webhook.zoho.sign.service';

@Controller('/webhook/zoho/sign')
export class ZohoSignWebhookController {
  private readonly _zohoSignWebhookService: ZohoSignWebhookService;

  constructor(@Inject(ZohoSignWebhookService) zohoSignWebhookService: ZohoSignWebhookService) {
    this._zohoSignWebhookService = zohoSignWebhookService;
  }

  @Post()
  async handleZohoSignWebhook(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer) {
    await this._zohoSignWebhookService.updateForWebhook(req, rawBody);
  }
}
