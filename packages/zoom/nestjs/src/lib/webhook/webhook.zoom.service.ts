import { Inject, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { zoomEventHandlerConfigurerFactory, zoomEventHandlerFactory } from './webhook.zoom';
import { Handler } from '@dereekb/util';
import { RawZoomWebhookEvent } from './webhook.zoom.type';
import { ZoomWebhookServiceConfig } from './webhook.zoom.config';
import { zoomWebhookEventVerifier, ZoomWebhookEventVerifier } from './webhook.zoom.verify';

/**
 * Service that makes system changes based on Zoom webhook events.
 */
@Injectable()
export class ZoomWebhookService {
  private readonly logger = new Logger('ZoomWebhookService');
  private readonly _config: ZoomWebhookServiceConfig;
  private readonly _verifier: ZoomWebhookEventVerifier;

  readonly handler: Handler<RawZoomWebhookEvent> = zoomEventHandlerFactory();
  readonly configure = zoomEventHandlerConfigurerFactory(this.handler);

  constructor(@Inject(ZoomWebhookServiceConfig) config: ZoomWebhookServiceConfig) {
    this._config = config;
    this._verifier = zoomWebhookEventVerifier(config.webhookConfig.zoomSecretToken);
  }

  public async updateForWebhook(req: Request, rawBody: Buffer): Promise<boolean> {
    const event = this._verifier(req, rawBody);

    if (!event.valid) {
      this.logger.warn('Received invalid zoom event: ', event);
      return false;
    }

    return this.updateForZoomEvent(event.event);
  }

  async updateForZoomEvent(event: RawZoomWebhookEvent): Promise<boolean> {
    const handled: boolean = await this.handler(event);

    if (!handled) {
      this.logger.warn('Received unexpected/unhandled zoom event: ', event);
    }

    return handled;
  }
}
