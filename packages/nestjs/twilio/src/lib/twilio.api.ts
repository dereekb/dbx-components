import { Inject, Injectable } from '@nestjs/common';
import { Twilio } from './twilio.interop';
import { TwilioServiceConfig } from './twilio.config';

@Injectable()
export class TwilioApi {
  private _client?: Twilio;

  constructor(@Inject(TwilioServiceConfig) readonly config: TwilioServiceConfig) {}

  /**
   * The Twilio SDK client, created on first access.
   *
   * Created lazily because the SDK constructor throws when the Account SID does not start with `AC`, so a
   * config holding the placeholder values of a committed `.env` can still be provided. Accessing the client
   * with such a config throws.
   *
   * @returns The Twilio SDK client.
   */
  get client(): Twilio {
    if (!this._client) {
      const { accountSid, authToken, apiKeySid, apiKeySecret } = this.config.twilio;
      this._client = apiKeySid && apiKeySecret ? new Twilio(apiKeySid, apiKeySecret, { accountSid }) : new Twilio(accountSid, authToken as string);
    }

    return this._client;
  }
}

/**
 * Provides a reference to a TwilioApi instance.
 */
export interface TwilioApiRef {
  readonly twilioApi: TwilioApi;
}
