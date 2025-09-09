import { VapiAiApi } from '@dereekb/nestjs/vapiai';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class DemoVapiAiService {
  private readonly _vapiAiApi: VapiAiApi;

  constructor(@Inject(VapiAiApi) vapiAiApi: VapiAiApi) {
    this._vapiAiApi = vapiAiApi;
  }

  get vapiAiApi(): VapiAiApi {
    return this._vapiAiApi;
  }

  // MARK: Accessors
  /**
   * Gets a call by ID.
   *
   * @param callId
   * @returns
   */
  getCall(callId: string) {
    return this.vapiAiApi.getCall(callId);
  }
}

export interface DemoVapiAiServiceRef {
  readonly vapiAiService: DemoVapiAiService;
}
