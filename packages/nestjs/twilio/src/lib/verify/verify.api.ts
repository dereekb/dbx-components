import { Inject, Injectable } from '@nestjs/common';
import { TwilioApi } from '../twilio.api';
import { TwilioVerifyServiceConfig } from './verify.config';

@Injectable()
export class TwilioVerifyApi {
  private readonly _twilioApi: TwilioApi;
  private readonly _config: TwilioVerifyServiceConfig;

  constructor(@Inject(TwilioApi) twilioApi: TwilioApi, @Inject(TwilioVerifyServiceConfig) config: TwilioVerifyServiceConfig) {
    this._twilioApi = twilioApi;
    this._config = config;
  }

  get twilioApi(): TwilioApi {
    return this._twilioApi;
  }

  get verifyService() {
    return this._twilioApi.client.verify.v2.services(this._config.twilioVerify.verifyServiceSid);
  }

  get config(): TwilioVerifyServiceConfig {
    return this._config;
  }
}
