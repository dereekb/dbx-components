import { ServerError } from '@dereekb/util';
import { VapiClient } from '@vapi-ai/server-sdk';
import { Request } from 'express';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { VapiAiServiceConfig } from './vapiai.config';

@Injectable()
export class VapiAiApi {
  readonly vapiClient: VapiClient;

  constructor(@Inject(VapiAiServiceConfig) readonly config: VapiAiServiceConfig) {
    this.vapiClient = new VapiClient(config.vapiai.config);
  }
}
