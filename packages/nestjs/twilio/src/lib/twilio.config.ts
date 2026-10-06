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

// MARK: Usable Config
/**
 * Values treated as unset by {@link usableTwilioServiceConfig}.
 *
 * These are the stand-in values a committed `.env` ships with, which are truthy and so pass
 * {@link TwilioServiceConfig.assertValidConfig}, but crash the `twilio` SDK constructor.
 */
export const TWILIO_PLACEHOLDER_CONFIG_VALUES: readonly string[] = ['', 'placeholder', 'xxx'];

/**
 * Returns true if the input is unset or one of the {@link TWILIO_PLACEHOLDER_CONFIG_VALUES}.
 *
 * @param value - Configured value to check.
 * @returns True if the value should be treated as unset.
 */
export function isPlaceholderTwilioConfigValue(value: Maybe<string>): boolean {
  return value == null || TWILIO_PLACEHOLDER_CONFIG_VALUES.includes(value.trim().toLowerCase());
}

/**
 * Returns a copy of the input config with its placeholder and malformed values removed, or
 * undefined if what remains cannot send SMS.
 *
 * A usable config has:
 * - an Account SID starting with `AC`
 * - an Auth Token, or an API Key SID starting with `SK` together with its secret
 * - a sender phone number starting with `+`, or a Messaging Service SID starting with `MG`
 *
 * Values that are unset, one of the {@link TWILIO_PLACEHOLDER_CONFIG_VALUES}, or missing their
 * expected prefix are dropped from the returned config, so a placeholder Messaging Service SID or
 * API key never shadows a real sender or auth token. A status callback URL that is not an
 * `http(s)` URL is dropped as well, since it does not affect whether the config can send.
 *
 * Use this to conditionally wire Twilio, rather than importing `TwilioModule`, which
 * constructs the SDK eagerly and throws on placeholder values.
 *
 * @param config - Config to check, typically read from the environment.
 * @returns The usable config, or undefined if the config cannot send SMS.
 *
 * @example
 * ```ts
 * const config = usableTwilioServiceConfig(twilioServiceConfigFromConfigService(configService));
 * const twilioService = config ? new TwilioService(new TwilioApi(config)) : undefined;
 * ```
 */
export function usableTwilioServiceConfig(config: Maybe<TwilioServiceConfig>): Maybe<TwilioServiceConfig> {
  const realValueWithPrefix = <T extends string>(value: Maybe<T>, prefix?: string): Maybe<T> => (!isPlaceholderTwilioConfigValue(value) && (prefix == null || (value as string).startsWith(prefix)) ? value : undefined);

  let result: Maybe<TwilioServiceConfig>;

  if (config) {
    const { twilio, messages } = config;

    const accountSid = realValueWithPrefix(twilio.accountSid, 'AC');
    const authToken = realValueWithPrefix(twilio.authToken);
    const apiKeySid = realValueWithPrefix(twilio.apiKeySid, 'SK');
    const apiKeySecret = realValueWithPrefix(twilio.apiKeySecret);
    const hasApiKey = apiKeySid != null && apiKeySecret != null;

    const defaultFrom = realValueWithPrefix(messages.defaultFrom, '+');
    const messagingServiceSid = realValueWithPrefix(messages.messagingServiceSid, 'MG');
    const defaultStatusCallback = realValueWithPrefix(messages.defaultStatusCallback, 'http');

    if (accountSid && (authToken || hasApiKey) && (defaultFrom || messagingServiceSid)) {
      result = {
        twilio: {
          accountSid,
          authToken,
          apiKeySid: hasApiKey ? apiKeySid : undefined,
          apiKeySecret: hasApiKey ? apiKeySecret : undefined
        },
        messages: {
          defaultFrom,
          messagingServiceSid,
          defaultStatusCallback,
          sandbox: messages.sandbox
        }
      };
    }
  }

  return result;
}

/**
 * Returns true if {@link usableTwilioServiceConfig} can build a usable config from the input.
 *
 * Note that a usable config may still carry placeholder values; pass the input through
 * {@link usableTwilioServiceConfig} to get a copy with them removed before using it.
 *
 * @param config - Config to check, typically read from the environment.
 * @returns True if the config can send SMS.
 */
export function isUsableTwilioServiceConfig(config: Maybe<TwilioServiceConfig>): config is TwilioServiceConfig {
  return usableTwilioServiceConfig(config) != null;
}
