import { RawBody, type RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, Inject, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { StripeWebhookService } from './webhook.stripe.service';

@Controller('/webhook/stripe')
export class StripeWebhookController {
  private readonly _stripeWebhookService: StripeWebhookService;

  constructor(@Inject(StripeWebhookService) stripeWebhookService: StripeWebhookService) {
    this._stripeWebhookService = stripeWebhookService;
  }

  @Post()
  async handleStripeWebhook(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer) {
    await this._stripeWebhookService.updateForWebhook(req, rawBody);
  }
}
