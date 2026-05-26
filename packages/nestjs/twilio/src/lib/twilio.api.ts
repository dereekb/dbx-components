import { Inject, Injectable } from '@nestjs/common';
import { Twilio } from 'twilio';
import { TwilioServiceConfig } from './twilio.config';

@Injectable()
export class TwilioApi {
  readonly client: Twilio;

  constructor(@Inject(TwilioServiceConfig) readonly config: TwilioServiceConfig) {
    const { accountSid, authToken, apiKeySid, apiKeySecret } = config.twilio;

    let client: Twilio;

    if (apiKeySid && apiKeySecret) {
      client = new Twilio(apiKeySid, apiKeySecret, { accountSid });
    } else {
      client = new Twilio(accountSid, authToken as string);
    }

    this.client = client;
  }
}

/**
 * Provides a reference to a TwilioApi instance.
 */
export interface TwilioApiRef {
  readonly twilioApi: TwilioApi;
}
