import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Request } from 'express';
import { type UntypedVapiAiWebhookEvent, vapiaiEventHandlerConfigurerFactory, vapiaiEventHandlerFactory, type VapiAiWebhookEvent, type VapiAiWebhookEventType, type VapiAiWebhookResult } from './webhook.vapiai';
import { type Handler  } from '@dereekb/util';
import { vapiAiWebhookEventVerifier, type VapiAiWebhookEventVerifier } from './webhook.vapiai.verify';
import { VapiAiWebhookServiceConfig } from './webhook.vapi.config';

export interface UpdateForVapiAiWebhookResponse extends VapiAiWebhookResult {
  readonly valid: boolean;
  readonly event: UntypedVapiAiWebhookEvent;
}

/**
 * Service that makes system changes based on VapiAi webhook events.
 */
@Injectable()
export class VapiAiWebhookService {
  private readonly logger = new Logger('VapiAiWebhookService');

  private readonly _verifier: VapiAiWebhookEventVerifier;

  readonly handler: Handler<VapiAiWebhookEvent, VapiAiWebhookEventType, VapiAiWebhookResult> = vapiaiEventHandlerFactory();
  readonly configure = vapiaiEventHandlerConfigurerFactory(this.handler);

  constructor(@Inject(VapiAiWebhookServiceConfig) vapiAiWebhookServiceConfig: VapiAiWebhookServiceConfig) {
    this._verifier = vapiAiWebhookEventVerifier(vapiAiWebhookServiceConfig.webhookConfig);
  }

  public async updateForWebhook(req: Request, rawBody: Buffer): Promise<UpdateForVapiAiWebhookResponse> {
    const { valid, event } = await this._verifier(req, rawBody);
    let result: VapiAiWebhookResult = {
      handled: false
    };

    if (!valid) {
      this.logger.warn('Received invalid Vapi.ai event: ', event);
    } else {
      result = await this.updateForVapiAiEvent(event);
    }

    const response: UpdateForVapiAiWebhookResponse = {
      valid,
      event,
      ...result
    };

    return response;
  }

  async updateForVapiAiEvent(event: UntypedVapiAiWebhookEvent): Promise<VapiAiWebhookResult> {
    const result: VapiAiWebhookResult = await this.handler(event);

    if (!result.handled) {
      this.logger.warn('Received unexpected/unhandled Vapi.ai event: ', event);
    }

    return result;
  }
}
