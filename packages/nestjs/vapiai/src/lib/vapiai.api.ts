import { VapiClient } from '@vapi-ai/server-sdk';
import { Inject, Injectable } from '@nestjs/common';
import { VapiAiServiceConfig } from './vapiai.config';
import { VapiCallWithTranscript } from './vapiai.type';

@Injectable()
export class VapiAiApi {
  readonly vapiClient: VapiClient;

  constructor(@Inject(VapiAiServiceConfig) readonly config: VapiAiServiceConfig) {
    this.vapiClient = new VapiClient(config.vapiai.config);
  }

  // MARK: Accessors
  /**
   * Gets a call by ID.
   *
   * @param callId
   * @returns
   */
  getCall(callId: string) {
    return this.vapiClient.calls.get(callId) as Promise<VapiCallWithTranscript>;
  }
}
