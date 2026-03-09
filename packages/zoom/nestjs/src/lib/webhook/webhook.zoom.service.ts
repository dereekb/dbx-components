import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Request } from 'express';
import { zoomEventHandlerConfigurerFactory, zoomEventHandlerFactory } from './webhook.zoom';
import { type Handler, type Maybe } from '@dereekb/util';
import { ZoomWebhookServiceConfig } from './webhook.zoom.config';
import { zoomWebhookEventVerifier, type ZoomWebhookEventVerifier } from './webhook.zoom.verify';
import { type UntypedZoomWebhookEvent } from './webhook.zoom.type.common';
import { ZOOM_WEBHOOK_URL_VALIDATION_EVENT_TYPE, type ZoomWebhookUrlValidationEvent } from './webhook.zoom.type.validate';
import { type ZoomWebhookEventValidationFunction, zoomWebhookEventValidationFunction, type ZoomWebhookValidationResponse } from './webhook.zoom.validate';

export interface UpdateForWebhookResponse {
  readonly valid: boolean;
  readonly handled: boolean;
  readonly event: UntypedZoomWebhookEvent;
  readonly validationEventResponse?: Maybe<ZoomWebhookValidationResponse>;
}

/**
 * Service that makes system changes based on Zoom webhook events.
 */
@Injectable()
export class ZoomWebhookService {
  private readonly logger = new Logger('ZoomWebhookService');

  private readonly _verifier: ZoomWebhookEventVerifier;
  private readonly _validator: ZoomWebhookEventValidationFunction;

  readonly handler: Handler<UntypedZoomWebhookEvent> = zoomEventHandlerFactory();
  readonly configure = zoomEventHandlerConfigurerFactory(this.handler);

  constructor(@Inject(ZoomWebhookServiceConfig) config: ZoomWebhookServiceConfig) {
    this._verifier = zoomWebhookEventVerifier(config.webhookConfig.zoomSecretToken);
    this._validator = zoomWebhookEventValidationFunction(config.webhookConfig.zoomSecretToken);
  }

  public async updateForWebhook(req: Request, rawBody: Buffer): Promise<UpdateForWebhookResponse> {
    const { valid, event } = this._verifier(req, rawBody);
    let handled: boolean = false;
    let validationEventResponse: ZoomWebhookValidationResponse | undefined;

    if (!valid) {
      this.logger.warn('Received invalid zoom event: ', event);
    } else if (event.event === ZOOM_WEBHOOK_URL_VALIDATION_EVENT_TYPE) {
      validationEventResponse = this._validator(event as ZoomWebhookUrlValidationEvent);
      handled = true;
    } else {
      handled = await this.updateForZoomEvent(event);
    }

    const result: UpdateForWebhookResponse = {
      valid,
      handled,
      event,
      validationEventResponse
    };

    return result;
  }

  async updateForZoomEvent(event: UntypedZoomWebhookEvent): Promise<boolean> {
    const handled: boolean = await this.handler(event);

    if (!handled) {
      this.logger.warn('Received unexpected/unhandled zoom event: ', event);
    }

    return handled;
  }
}
