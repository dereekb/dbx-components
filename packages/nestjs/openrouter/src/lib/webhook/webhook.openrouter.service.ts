import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Request } from 'express';
import { type Handler } from '@dereekb/util';
import { openRouterEventHandlerConfigurerFactory, openRouterEventHandlerFactory, openRouterBroadcastSpansFromPayload, type OpenRouterBroadcastPayload, type OpenRouterBroadcastSpan, type OpenRouterBroadcastSpanName } from './webhook.openrouter';
import { OpenRouterWebhookServiceConfig } from './webhook.openrouter.config';
import { openRouterWebhookEventVerifier, type OpenRouterWebhookEventVerifier } from './webhook.openrouter.verify';

/**
 * Result of handling an incoming OpenRouter broadcast webhook request.
 */
export interface OpenRouterWebhookHandleResult {
  /**
   * Whether the request's secret token was valid.
   */
  readonly valid: boolean;
  /**
   * The total number of spans in the broadcast payload.
   */
  readonly totalSpans: number;
  /**
   * The number of spans that were matched and handled.
   */
  readonly handledSpans: number;
}

/**
 * Service that makes system changes based on OpenRouter broadcast webhook events.
 */
@Injectable()
export class OpenRouterWebhookService {
  private readonly logger = new Logger('OpenRouterWebhookService');

  private readonly _verifier: OpenRouterWebhookEventVerifier;

  readonly handler: Handler<OpenRouterBroadcastSpan, OpenRouterBroadcastSpanName> = openRouterEventHandlerFactory();
  readonly configure = openRouterEventHandlerConfigurerFactory(this.handler);

  constructor(@Inject(OpenRouterWebhookServiceConfig) openRouterWebhookServiceConfig: OpenRouterWebhookServiceConfig) {
    const { webhookSecret, header, scheme } = openRouterWebhookServiceConfig.openrouterWebhook;

    this._verifier = openRouterWebhookEventVerifier({
      secret: webhookSecret,
      header,
      scheme
    });
  }

  async updateForWebhook(req: Request, body: unknown): Promise<OpenRouterWebhookHandleResult> {
    const { valid } = this._verifier(req);

    let result: OpenRouterWebhookHandleResult;

    if (valid) {
      result = await this.updateForBroadcast(body as OpenRouterBroadcastPayload);
    } else {
      this.logger.warn('Received OpenRouter webhook with an invalid secret token.');
      result = { valid: false, totalSpans: 0, handledSpans: 0 };
    }

    return result;
  }

  async updateForBroadcast(payload: OpenRouterBroadcastPayload): Promise<OpenRouterWebhookHandleResult> {
    const spans = openRouterBroadcastSpansFromPayload(payload);

    let handledSpans = 0;

    for (const span of spans) {
      const handled = await this.handler(span);

      if (handled) {
        handledSpans += 1;
      }
    }

    return {
      valid: true,
      totalSpans: spans.length,
      handledSpans
    };
  }
}
