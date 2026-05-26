import { type Maybe } from '@dereekb/util';
import { type TwilioAccountSid, type TwilioApiKeySecret, type TwilioApiKeySid, type TwilioAuthToken, type TwilioMessagingServiceSid, type TwilioPhoneNumber, type TwilioStatusCallbackUrl } from './twilio.type';

export const TWILIO_ACCOUNT_SID_ENV_VAR = 'TWILIO_ACCOUNT_SID';
export const TWILIO_AUTH_TOKEN_ENV_VAR = 'TWILIO_AUTH_TOKEN';
export const TWILIO_API_KEY_SID_ENV_VAR = 'TWILIO_API_KEY_SID';
export const TWILIO_API_KEY_SECRET_ENV_VAR = 'TWILIO_API_KEY_SECRET';
export const TWILIO_PHONE_NUMBER_ENV_VAR = 'TWILIO_PHONE_NUMBER';
export const TWILIO_MESSAGING_SERVICE_SID_ENV_VAR = 'TWILIO_MESSAGING_SERVICE_SID';
export const TWILIO_STATUS_CALLBACK_URL_ENV_VAR = 'TWILIO_STATUS_CALLBACK_URL';
export const TWILIO_SANDBOX_ENV_VAR = 'TWILIO_SANDBOX';

/**
 * Twilio client credentials. Either {@link authToken} or the {@link apiKeySid}/{@link apiKeySecret}
 * pair is required.
 */
export interface TwilioCredentials {
  /**
   * Twilio Account SID. Required.
   */
  readonly accountSid: TwilioAccountSid;
  /**
   * Twilio Auth Token. Required unless an API key SID + secret is provided.
   */
  readonly authToken?: Maybe<TwilioAuthToken>;
  /**
   * Twilio API Key SID. When provided together with `apiKeySecret`, this is used in place of the
   * raw auth token when authenticating SDK requests.
   */
  readonly apiKeySid?: Maybe<TwilioApiKeySid>;
  /**
   * Secret value paired with `apiKeySid`.
   */
  readonly apiKeySecret?: Maybe<TwilioApiKeySecret>;
}

/**
 * Default values for outbound message sends.
 */
export interface TwilioMessagesConfig {
  /**
   * Default sender phone number (E.164). Optional if `messagingServiceSid` is provided.
   */
  readonly defaultFrom?: Maybe<TwilioPhoneNumber>;
  /**
   * Default Twilio Messaging Service SID. When set, Twilio chooses the sender from the
   * messaging service's number pool.
   */
  readonly messagingServiceSid?: Maybe<TwilioMessagingServiceSid>;
  /**
   * Default status callback URL applied to outbound messages when the caller does not
   * supply one explicitly.
   */
  readonly defaultStatusCallback?: Maybe<TwilioStatusCallbackUrl>;
  /**
   * When true, suppresses real SDK calls and returns a synthetic result. Mirrors the
   * mailgun sandbox flag for local development and testing.
   */
  readonly sandbox?: Maybe<boolean>;
}

/**
 * Configuration for {@link TwilioApi} and {@link TwilioService}.
 */
export abstract class TwilioServiceConfig {
  /**
   * Client credentials.
   */
  readonly twilio!: TwilioCredentials;
  /**
   * Outbound message defaults.
   */
  readonly messages!: TwilioMessagesConfig;

  static assertValidConfig(config: TwilioServiceConfig): void {
    if (!config.twilio.accountSid) {
      throw new Error('TwilioServiceConfig: TWILIO_ACCOUNT_SID is required.');
    }

    const hasAuthToken = Boolean(config.twilio.authToken);
    const hasApiKey = Boolean(config.twilio.apiKeySid) && Boolean(config.twilio.apiKeySecret);

    if (!hasAuthToken && !hasApiKey) {
      throw new Error('TwilioServiceConfig: TWILIO_AUTH_TOKEN (or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET) is required.');
    }

    if (!config.messages.defaultFrom && !config.messages.messagingServiceSid) {
      throw new Error('TwilioServiceConfig: TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID is required.');
    }
  }
}
