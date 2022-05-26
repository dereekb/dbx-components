import { RawBody, RawBodyBuffer } from '@dereekb/nestjs';
import { Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { StripeWebhookService } from './webhook.stripe.service';

@Controller('/webhook/stripe')
export class StripeWebhookController {
  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

  @Post()
  async handleStripeWebhook(@Req() req: Request, @RawBody() rawBody: RawBodyBuffer) {
    await this.stripeWebhookService.updateForWebhook(req, rawBody);
  }
}
