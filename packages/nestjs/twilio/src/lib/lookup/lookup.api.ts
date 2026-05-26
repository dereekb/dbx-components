import { Inject, Injectable } from '@nestjs/common';
import { TwilioApi } from '../twilio.api';

@Injectable()
export class TwilioLookupApi {
  private readonly _twilioApi: TwilioApi;

  constructor(@Inject(TwilioApi) twilioApi: TwilioApi) {
    this._twilioApi = twilioApi;
  }

  get twilioApi(): TwilioApi {
    return this._twilioApi;
  }

  get phoneNumbers() {
    return this._twilioApi.client.lookups.v2.phoneNumbers;
  }
}
