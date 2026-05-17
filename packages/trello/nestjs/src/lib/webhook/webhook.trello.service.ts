import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Handler } from '@dereekb/util';
import { type Request } from 'express';
import { trelloEventHandlerConfigurerFactory, trelloEventHandlerFactory } from './webhook.trello';
import { TrelloWebhookServiceConfig } from './webhook.trello.config';
import { type UntypedTrelloWebhookEvent } from './webhook.trello.type';
import { trelloWebhookEventVerifier, type TrelloWebhookEventVerifier } from './webhook.trello.verify';

export interface UpdateForTrelloWebhookResponse {
  readonly valid: boolean;
  readonly handled: boolean;
  readonly event?: UntypedTrelloWebhookEvent;
}

/**
 * Service that processes Trello webhook events.
 *
 * Verifies the signature, then dispatches verified events through a {@link Handler}
 * configured via {@link TrelloEventHandlerConfigurer}.
 */
@Injectable()
export class TrelloWebhookService {
  private readonly logger = new Logger('TrelloWebhookService');

  private readonly _verifier: TrelloWebhookEventVerifier;

  readonly handler: Handler<UntypedTrelloWebhookEvent> = trelloEventHandlerFactory();
  readonly configure = trelloEventHandlerConfigurerFactory(this.handler);

  constructor(@Inject(TrelloWebhookServiceConfig) config: TrelloWebhookServiceConfig) {
    this._verifier = trelloWebhookEventVerifier({
      appSecret: config.webhookConfig.appSecret,
      callbackUrl: config.webhookConfig.callbackUrl
    });
  }

  public async updateForWebhook(req: Request, rawBody: Buffer): Promise<UpdateForTrelloWebhookResponse> {
    const { valid, event } = this._verifier(req, rawBody);
    let handled = false;

    if (!valid) {
      this.logger.warn('Received invalid Trello webhook event');
    } else if (event) {
      handled = await this.updateForTrelloEvent(event);
    }

    return { valid, handled, event };
  }

  async updateForTrelloEvent(event: UntypedTrelloWebhookEvent): Promise<boolean> {
    const handled: boolean = await this.handler(event);

    if (!handled) {
      this.logger.warn(`Unhandled Trello webhook action type: ${event.action.type}`);
    }

    return handled;
  }
}
