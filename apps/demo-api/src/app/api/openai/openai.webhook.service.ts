import { catchAllHandlerKey } from '@dereekb/util';
import { Injectable, Logger } from '@nestjs/common';
import { OpenAIApi, OpenAIWebhookEvent, OpenAIWebhookService } from '@dereekb/nestjs/openai';

@Injectable()
export class DemoApiOpenAiWebhookService {
  private readonly _openAiApi: OpenAIApi;
  private readonly _openAiWebhookService: OpenAIWebhookService;

  private readonly logger = new Logger('DemoApiOpenAiWebhookService');

  constructor(openAiApi: OpenAIApi, openAiWebhookService: OpenAIWebhookService) {
    this._openAiApi = openAiApi;
    this._openAiWebhookService = openAiWebhookService;

    openAiWebhookService.configure(this, (x) => {
      x.set(catchAllHandlerKey(), this.logHandledEvent);

      x.handleEvalRunSucceeded(async (x) => {
        this.logger.log('Recieved OpenAI eval run succeeded event successfully.');

        console.log({
          evalRunId: x.id
        });
      });
    });
  }

  get openAiApi() {
    return this._openAiApi;
  }

  get openAiWebhookService() {
    return this._openAiWebhookService;
  }

  logHandledEvent(event: OpenAIWebhookEvent) {
    this.logger.log('Recieved OpenAI event successfully: ', event.type);
  }
}
