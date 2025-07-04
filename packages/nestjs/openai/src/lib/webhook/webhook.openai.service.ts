import { Inject, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { openaiEventHandlerConfigurerFactory, openaiEventHandlerFactory, OpenAIWebhookEvent, OpenAIWebhookEventType } from './webhook.openai';
import { Handler } from '@dereekb/util';
import { OpenAIWebhookServiceConfig } from './webhook.openai.config';
import { OpenAIApi } from '../openai.api';
import { openAIWebhookEventVerifier, OpenAIWebhookEventVerifier } from './webhook.openai.verify';

/**
 * Service that makes system changes based on OpenAI webhook events.
 */
@Injectable()
export class OpenAIWebhookService {
  private readonly logger = new Logger('OpenAIWebhookService');

  private readonly _verifier: OpenAIWebhookEventVerifier;

  readonly handler: Handler<OpenAIWebhookEvent, OpenAIWebhookEventType> = openaiEventHandlerFactory();
  readonly configure = openaiEventHandlerConfigurerFactory(this.handler);

  constructor(@Inject(OpenAIApi) openAiApi: OpenAIApi, @Inject(OpenAIWebhookServiceConfig) openAIWebhookServiceConfig: OpenAIWebhookServiceConfig) {
    const { webhookSecret } = openAIWebhookServiceConfig.openaiWebhook;

    this._verifier = openAIWebhookEventVerifier({
      secret: webhookSecret,
      client: openAiApi.openAIClient
    });
  }

  async updateForWebhook(req: Request, rawBody: Buffer): Promise<void> {
    const result = await this._verifier(req, rawBody);

    if (!result.valid) {
      this.logger.warn('Received invalid OpenAI event.', req);
    } else {
      await this.updateForOpenAIEvent(result.event as OpenAIWebhookEvent);
    }
  }

  async updateForOpenAIEvent(event: OpenAIWebhookEvent): Promise<void> {
    const result = await this.handler(event);

    if (!result) {
      this.logger.warn('Received unexpected/unhandled OpenAI event.', event);
    }
  }
}
