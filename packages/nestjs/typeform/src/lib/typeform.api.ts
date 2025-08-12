import { Inject, Injectable } from '@nestjs/common';
import { TypeformServiceConfig } from './typeform.config';
import { createClient } from '@typeform/api-client';

@Injectable()
export class TypeformApi {
  readonly client: ReturnType<typeof createClient>;

  constructor(@Inject(TypeformServiceConfig) readonly config: TypeformServiceConfig) {
    this.client = createClient(config.typeform.config);
  }
}
