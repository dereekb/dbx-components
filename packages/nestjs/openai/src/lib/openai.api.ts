import { Inject, Injectable } from '@nestjs/common';
import { OpenAIServiceConfig } from './openai.config';
import { OpenAI } from 'openai';

@Injectable()
export class OpenAIApi {
  readonly openAIClient: OpenAI;

  constructor(@Inject(OpenAIServiceConfig) readonly config: OpenAIServiceConfig) {
    this.openAIClient = new OpenAI(config.openai.config);
  }
}
