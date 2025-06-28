import { catchAllHandlerKey } from '@dereekb/util';
import { Injectable, Logger } from '@nestjs/common';
import { VapiAiApi } from '@dereekb/nestjs/vapiai';
import { UntypedVapiAiWebhookEvent, VapiAiWebhookService } from '@dereekb/nestjs/vapiai';

@Injectable()
export class DemoApiVapiAiWebhookService {
  private readonly _vapiAiApi: VapiAiApi;
  private readonly _vapiAiWebhookService: VapiAiWebhookService;

  private readonly logger = new Logger('DemoApiZoomWebhookService');

  constructor(vapiAiApi: VapiAiApi, vapiAiWebhookService: VapiAiWebhookService) {
    this._vapiAiApi = vapiAiApi;
    this._vapiAiWebhookService = vapiAiWebhookService;

    vapiAiWebhookService.configure(this, (x) => {
      x.set(catchAllHandlerKey(), this.logHandledEvent);

      x.handleEndOfCallReport(async (x) => {
        this.logger.log('Recieved vapi.ai end of call report event successfully', x);
      });
    });
  }

  get vapiAiApi() {
    return this._vapiAiApi;
  }

  get vapiAiWebhookService() {
    return this._vapiAiWebhookService;
  }

  logHandledEvent(event: UntypedVapiAiWebhookEvent): boolean {
    const handled: boolean = true;

    this.logger.log('Recieved vapi.ai event successfully: ', event);

    return handled;
  }
}
