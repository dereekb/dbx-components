import { Inject, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { UntypedVapiAiWebhookEvent, vapiaiEventHandlerConfigurerFactory, vapiaiEventHandlerFactory, VapiAiWebhookEvent, VapiAiWebhookEventType } from './webhook.vapiai';
import { VapiAiApi } from '../vapiai.api';
import { Handler } from '@dereekb/util';
import { vapiAiWebhookEventVerifier, VapiAiWebhookEventVerifier } from './webhook.vapiai.verify';

export interface UpdateForVapiAiWebhookResponse {
  readonly valid: boolean;
  readonly handled: boolean;
  readonly event: UntypedVapiAiWebhookEvent;
}

/**
 * Service that makes system changes based on VapiAi webhook events.
 */
@Injectable()
export class VapiAiWebhookService {
  private readonly logger = new Logger('VapiAiWebhookService');

  private readonly _vapiaiApi: VapiAiApi;
  private readonly _verifier: VapiAiWebhookEventVerifier;

  readonly handler: Handler<VapiAiWebhookEvent, VapiAiWebhookEventType> = vapiaiEventHandlerFactory();
  readonly configure = vapiaiEventHandlerConfigurerFactory(this.handler);

  constructor(@Inject(VapiAiApi) vapiaiApi: VapiAiApi) {
    this._vapiaiApi = vapiaiApi;
    this._verifier = vapiAiWebhookEventVerifier(vapiaiApi.config.vapiai.config.token);
  }

  public async updateForWebhook(req: Request, rawBody: Buffer): Promise<UpdateForVapiAiWebhookResponse> {
    const { valid, event } = await this._verifier(req, rawBody);
    let handled: boolean = false;

    if (!valid) {
      this.logger.warn('Received invalid Vapi.ai event: ', event);
    } else {
      handled = await this.updateForVapiAiEvent(event);
    }

    const result: UpdateForVapiAiWebhookResponse = {
      valid,
      handled,
      event
    };

    return result;
  }

  async updateForVapiAiEvent(event: UntypedVapiAiWebhookEvent): Promise<boolean> {
    const handled: boolean = await this.handler(event);

    if (!handled) {
      this.logger.warn('Received unexpected/unhandled Vapi.ai event: ', event);
    }

    return handled;
  }
}
