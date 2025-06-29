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
}

export interface DemoVapiAiServiceRef {
  readonly vapiAiService: DemoVapiAiService;
}
