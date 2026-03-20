import { type ServerError } from '@dereekb/util';
import Stripe from 'stripe';
import { type Request } from 'express';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { StripeServiceConfig } from './stripe.config';

/**
 * Injectable service that wraps the Stripe SDK for payment operations.
 *
 * Provides methods for constructing and verifying Stripe webhook events.
 */
@Injectable()
export class StripeApi {
  readonly stripe: Stripe;

  constructor(@Inject(StripeServiceConfig) readonly config: StripeServiceConfig) {
    this.stripe = new Stripe(config.stripe.secret, config.stripe.config);
  }

  // MARK: Event
  /**
   * Verifies the Stripe signature and constructs a Stripe.Event from an incoming webhook request.
   *
   * @param req - the incoming Express request containing the stripe-signature header
   * @param rawBody - the raw request body buffer required for signature verification
   * @returns the verified and parsed Stripe.Event
   * @throws {BadRequestException} when the stripe-signature header is missing or verification fails
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
      throw new BadRequestException(`stripe signature read error: ${(e as ServerError).message}`);
    }

    return event;
  }
}
