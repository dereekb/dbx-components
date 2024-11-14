import Stripe from 'stripe';
import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { stripeEventHandlerConfigurerFactory, stripeEventHandlerFactory } from './webhook.stripe';
import { StripeApi } from '../stripe.api';
import { Handler } from '@dereekb/util';

/**
 * Service that makes system changes based on Stripe webhook events.
 */
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger('StripeWebhookService');
  private readonly _stripeApi: StripeApi;

  readonly handler: Handler<Stripe.Event> = stripeEventHandlerFactory();
  readonly configure = stripeEventHandlerConfigurerFactory(this.handler);

  constructor(stripeApi: StripeApi) {
    this._stripeApi = stripeApi;
  }

  public async updateForWebhook(req: Request, rawBody: Buffer): Promise<boolean> {
    const event = this._stripeApi.readStripeEventFromWebhookRequest(req, rawBody);
    return this.updateForStripeEvent(event);
  }

  async updateForStripeEvent(event: Stripe.Event): Promise<boolean> {
    const handled: boolean = await this.handler(event);

    if (!handled) {
      this.logger.warn('Received unexpected/unhandled stripe event: ', event);
    }

    return handled;
  }
}
