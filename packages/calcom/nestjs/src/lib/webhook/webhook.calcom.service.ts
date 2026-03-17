import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Request } from 'express';
import { calcomEventHandlerConfigurerFactory, calcomEventHandlerFactory } from './webhook.calcom';
import { type Handler } from '@dereekb/util';
import { CalcomWebhookServiceConfig } from './webhook.calcom.config';
import { calcomWebhookEventVerifier, type CalcomWebhookEventVerifier } from './webhook.calcom.verify';
import { type UntypedCalcomWebhookEvent } from './webhook.calcom.type';

export interface CalcomUpdateForWebhookResponse {
  readonly valid: boolean;
  readonly handled: boolean;
  readonly event: UntypedCalcomWebhookEvent;
}

/**
 * Service that makes system changes based on Cal.com webhook events.
 */
@Injectable()
export class CalcomWebhookService {
  private readonly logger = new Logger('CalcomWebhookService');

  private readonly _verifier: CalcomWebhookEventVerifier;

  readonly handler: Handler<UntypedCalcomWebhookEvent> = calcomEventHandlerFactory();
  readonly configure = calcomEventHandlerConfigurerFactory(this.handler);

  constructor(@Inject(CalcomWebhookServiceConfig) config: CalcomWebhookServiceConfig) {
    this._verifier = calcomWebhookEventVerifier(config.webhookConfig.webhookSecret);
  }

  public async updateForWebhook(req: Request, rawBody: Buffer): Promise<CalcomUpdateForWebhookResponse> {
    const headers = req.headers as Record<string, string>;
    const { valid, event } = this._verifier(rawBody, headers);
    let handled: boolean = false;

    if (!valid) {
      this.logger.warn('Received invalid calcom event: ', event);
    } else {
      handled = await this.updateForCalcomEvent(event);
    }

    const result: CalcomUpdateForWebhookResponse = {
      valid,
      handled,
      event
    };

    return result;
  }

  async updateForCalcomEvent(event: UntypedCalcomWebhookEvent): Promise<boolean> {
    const handled: boolean = await this.handler(event);

    if (!handled) {
      this.logger.warn('Received unexpected/unhandled calcom event: ', event);
    }

    return handled;
  }
}
