import { Inject, Injectable } from '@nestjs/common';
import { OpenRouterServiceConfig } from './openrouter.config';
import { OpenRouter } from '@openrouter/sdk';

@Injectable()
export class OpenRouterApi {
  readonly openRouterClient: OpenRouter;

  constructor(@Inject(OpenRouterServiceConfig) readonly config: OpenRouterServiceConfig) {
    const { apiKey, serverURL } = config.openrouter;
    this.openRouterClient = new OpenRouter({ apiKey, serverURL });
  }
}
