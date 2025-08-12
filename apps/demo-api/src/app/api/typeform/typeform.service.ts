import { TypeformApi } from '@dereekb/nestjs/typeform';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class DemoTypeformService {
  private readonly _typeformApi: TypeformApi;

  constructor(@Inject(TypeformApi) typeformApi: TypeformApi) {
    this._typeformApi = typeformApi;
  }

  get typeformApi(): TypeformApi {
    return this._typeformApi;
  }
}

export interface DemoTypeformServiceRef {
  readonly typeformService: DemoTypeformService;
}
