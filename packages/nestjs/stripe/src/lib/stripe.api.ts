import { ServerError } from '@dereekb/util';
import Stripe from 'stripe';
import { Request } from 'express';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { StripeServiceConfig } from './stripe.config';

@Injectable()
export class StripeApi {
  readonly stripe: Stripe;

  constructor(@Inject(StripeServiceConfig) readonly config: StripeServiceConfig) {
    this.stripe = new Stripe(config.stripe.secret, config.stripe.config);
  }

  // MARK: Event
  /**
   * Verifies the event and reads the stripe signature from a request.
   */
  readStripeEventFromWebhookRequest(req: Request, rawBody: Buffer): Stripe.Event {
    const signature = req.get('stripe-signature');

    if (!signature) {
      throw new BadRequestException(`missing stripe-signature`);
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.config.stripe.webhookSecret);
    } catch (e) {
      throw new BadRequestException(`stripe signature read error: ${(e as ServerError)?.message}`);
    }

    return event;
  }
}
