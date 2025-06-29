import { catchAllHandlerKey } from '@dereekb/util';
import { Injectable, Logger } from '@nestjs/common';
import { VapiAiApi,  UntypedVapiAiWebhookEvent, VapiAiWebhookService } from '@dereekb/nestjs/vapiai';

@Injectable()
export class DemoApiVapiAiWebhookService {
  private readonly _vapiAiApi: VapiAiApi;
  private readonly _vapiAiWebhookService: VapiAiWebhookService;

  private readonly logger = new Logger('DemoApiVapiAiWebhookService');

  constructor(vapiAiApi: VapiAiApi, vapiAiWebhookService: VapiAiWebhookService) {
    this._vapiAiApi = vapiAiApi;
    this._vapiAiWebhookService = vapiAiWebhookService;

    vapiAiWebhookService.configure(this, (x) => {
      x.set(catchAllHandlerKey(), this.logHandledEvent);

      x.handleEndOfCallReport(async (x) => {
        const { call } = x;

        this.logger.log('Recieved vapi.ai end of call report event successfully.');

        console.log({
          callId: call.id
        });
      });
    });
  }

  get vapiAiApi() {
    return this._vapiAiApi;
  }

  get vapiAiWebhookService() {
    return this._vapiAiWebhookService;
  }

  logHandledEvent(event: UntypedVapiAiWebhookEvent) {
    this.logger.log('Recieved vapi.ai event successfully: ', event.type);
  }
}
