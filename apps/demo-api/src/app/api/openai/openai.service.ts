import { OpenAIApi } from '@dereekb/nestjs/openai';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class DemoOpenAiService {
  private readonly _openAiApi: OpenAIApi;

  constructor(@Inject(OpenAIApi) openAiApi: OpenAIApi) {
    this._openAiApi = openAiApi;
  }

  get openAiApi(): OpenAIApi {
    return this._openAiApi;
  }
}

export interface DemoOpenAiServiceRef {
  readonly openAiService: DemoOpenAiService;
}
