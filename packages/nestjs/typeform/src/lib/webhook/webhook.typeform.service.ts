import { Inject, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { typeformEventHandlerConfigurerFactory, typeformEventHandlerFactory, TypeformWebhookEvent, TypeformWebhookEventType } from './webhook.typeform';
import { Handler } from '@dereekb/util';
import { TypeformWebhookServiceConfig } from './webhook.typeform.config';
import { typeFormWebhookEventVerifier, TypeformWebhookEventVerifier } from './webhook.typeform.verify';

/**
 * Service that makes system changes based on Typeform webhook events.
 */
@Injectable()
export class TypeformWebhookService {
  private readonly logger = new Logger('TypeformWebhookService');

  private readonly _verifier: TypeformWebhookEventVerifier;

  readonly handler: Handler<TypeformWebhookEvent, TypeformWebhookEventType> = typeformEventHandlerFactory();

  readonly configure = typeformEventHandlerConfigurerFactory(this.handler);

  constructor(@Inject(TypeformWebhookServiceConfig) typeFormWebhookServiceConfig: TypeformWebhookServiceConfig) {
    const { secretToken: webhookSecret } = typeFormWebhookServiceConfig.typeformWebhook;

    this._verifier = typeFormWebhookEventVerifier({
      secret: webhookSecret
    });
  }

  async updateForWebhook(req: Request, rawBody: Buffer): Promise<void> {
    const result = await this._verifier(req, rawBody);

    if (!result.valid) {
      this.logger.warn('Received invalid Typeform event.', req);
    } else {
      await this.updateForTypeformEvent(result.event as TypeformWebhookEvent);
    }
  }

  async updateForTypeformEvent(event: TypeformWebhookEvent): Promise<void> {
    const result = await this.handler(event);

    if (!result) {
      this.logger.warn('Received unexpected/unhandled Typeform event.', event);
    }
  }
}
