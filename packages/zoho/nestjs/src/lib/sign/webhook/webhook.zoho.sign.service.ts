import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Request } from 'express';
import { zohoSignEventHandlerConfigurerFactory, zohoSignEventHandlerFactory, type ZohoSignWebhookEvent, type ZohoSignWebhookOperationType } from './webhook.zoho.sign';
import { zohoSignWebhookEventVerifier, type ZohoSignWebhookEventVerifier } from './webhook.zoho.sign.verify';
import { type Handler } from '@dereekb/util';
import { ZohoSignWebhookServiceConfig } from './webhook.zoho.sign.config';

/**
 * Service that handles Zoho Sign webhook events.
 */
@Injectable()
export class ZohoSignWebhookService {
  private readonly logger = new Logger('ZohoSignWebhookService');

  private readonly _verifier: ZohoSignWebhookEventVerifier;

  readonly handler: Handler<ZohoSignWebhookEvent, ZohoSignWebhookOperationType> = zohoSignEventHandlerFactory();
  readonly configure = zohoSignEventHandlerConfigurerFactory(this.handler);

  constructor(@Inject(ZohoSignWebhookServiceConfig) zohoSignWebhookServiceConfig: ZohoSignWebhookServiceConfig) {
    const { webhookSecret } = zohoSignWebhookServiceConfig.zohoSignWebhook;

    this._verifier = zohoSignWebhookEventVerifier({
      secret: webhookSecret
    });
  }

  async updateForWebhook(req: Request, rawBody: Buffer): Promise<void> {
    const result = await this._verifier(req, rawBody);

    if (!result.valid) {
      this.logger.warn('Received invalid Zoho Sign webhook event.', req);
    } else {
      await this.updateForZohoSignEvent(result.event);
    }
  }

  async updateForZohoSignEvent(event: ZohoSignWebhookEvent): Promise<void> {
    const result = await this.handler(event);

    if (!result) {
      this.logger.warn('Received unexpected/unhandled Zoho Sign webhook event.', event);
    }
  }
}
