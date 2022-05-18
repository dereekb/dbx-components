import Stripe from 'stripe';
import { Injectable } from "@nestjs/common";
import { Request } from 'express';
import { stripeEventHandlerConfigurerFactory, stripeEventHandlerFactory } from './webhook.stripe';
import { StripeApi } from '../stripe.api';
import { Handler } from '@dereekb/util';

/**
 * Service that makes system changes based on Stripe webhook events.
 */
@Injectable()
export class StripeWebhookService {

  readonly handler: Handler<Stripe.Event> = stripeEventHandlerFactory();
  readonly configure = stripeEventHandlerConfigurerFactory(this.handler);

  constructor(
    private readonly stripeApi: StripeApi
  ) { }

  public async updateForWebhook(req: Request, rawbody: Buffer): Promise<any> {
    const event = this.stripeApi.readStripeEventFromWebhookRequest(req, rawbody);
    return this.updateForStripeEvent(event);
  }

  async updateForStripeEvent(event: Stripe.Event): Promise<boolean> {
    let handled: boolean = await this.handler(event);

    if (!handled) {
      console.log('Received unexpected/unhandled subscription event: ', event);
    }

    return handled;
  }

}
