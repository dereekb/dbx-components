import { StripeWebhookService, StripeApi } from '@dereekb/nestjs/stripe';
import { catchAllHandlerKey } from '@dereekb/util';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class DemoApiStripeExampleService {
  private readonly _stripeApi: StripeApi;
  private readonly _stripeWebhookService: StripeWebhookService;

  private readonly logger = new Logger('DemoApiStripeExampleService');

  constructor(@Inject(StripeApi) stripeApi: StripeApi, @Inject(StripeWebhookService) stripeWebhookService: StripeWebhookService) {
    this._stripeApi = stripeApi;
    this._stripeWebhookService = stripeWebhookService;

    stripeWebhookService.configure(this, (x) => {
      x.set(catchAllHandlerKey(), this.logHandledEvent);
    });
  }

  get stripeApi() {
    return this._stripeApi;
  }

  get stripeWebhookService() {
    return this._stripeWebhookService;
  }

  logHandledEvent(event: Stripe.Event): boolean {
    const handled: boolean = true;

    this.logger.log('Recieved stripe event successfully: ', event);

    return handled;
  }
}
