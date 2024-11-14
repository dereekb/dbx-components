import { inject } from '@angular/core';
import { StripeWebhookService, StripeApi } from '@dereekb/nestjs/stripe';
import { catchAllHandlerKey } from '@dereekb/util';
import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class DemoApiStripeExampleService {
  private readonly stripeApi = inject(StripeApi);
  private readonly stripeWebhookService = inject(StripeWebhookService);

  private readonly logger = new Logger('DemoApiStripeExampleService');

  constructor() {
    this.stripeWebhookService.configure(this, (x) => {
      x.set(catchAllHandlerKey(), this.logHandledEvent);
    });
  }

  logHandledEvent(event: Stripe.Event): boolean {
    const handled: boolean = true;

    this.logger.log('Recieved stripe event successfully: ', event);

    return handled;
  }
}
