import { catchAllHandlerKey } from '@dereekb/util';
import { Injectable, Logger } from '@nestjs/common';
import { TypeformWebhookEvent, TypeformApi, TypeformWebhookService } from '@dereekb/nestjs/typeform';

@Injectable()
export class DemoApiTypeformWebhookService {
  private readonly _typeformApi: TypeformApi;
  private readonly _typeformWebhookService: TypeformWebhookService;

  private readonly logger = new Logger('DemoApiTypeformWebhookService');

  constructor(typeformApi: TypeformApi, typeformWebhookService: TypeformWebhookService) {
    this._typeformApi = typeformApi;
    this._typeformWebhookService = typeformWebhookService;

    typeformWebhookService.configure(this, (x) => {
      x.set(catchAllHandlerKey(), this.logHandledEvent);

      x.handleFormResponse(async (x) => {
        const { form_response } = x;

        this.logger.log('Recieved typeform form response event successfully.');

        console.log({
          formId: form_response.form_id,
          token: form_response.token
        });
      });
    });
  }

  get typeformApi() {
    return this._typeformApi;
  }

  get typeformWebhookService() {
    return this._typeformWebhookService;
  }

  logHandledEvent(event: TypeformWebhookEvent) {
    this.logger.log('Recieved typeform event successfully: ', event.event_type);
  }
}
