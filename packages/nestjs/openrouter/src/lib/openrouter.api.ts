import { Inject, Injectable } from '@nestjs/common';
import { OpenRouterServiceConfig } from './openrouter.config';
import { OpenRouter } from '@openrouter/sdk';
import { filterUndefinedValues } from '@dereekb/util';

@Injectable()
export class OpenRouterApi {
  readonly openRouterClient: OpenRouter;

  constructor(@Inject(OpenRouterServiceConfig) readonly config: OpenRouterServiceConfig) {
    const { apiKey, serverURL, timeoutMs, retryConfig } = config.openrouter;
    // the SDK options are exact-optional: an unset field is omitted rather than passed as undefined
    this.openRouterClient = new OpenRouter({ apiKey, ...filterUndefinedValues({ serverURL, timeoutMs: timeoutMs ?? undefined, retryConfig: retryConfig ?? undefined }) });
  }
}
