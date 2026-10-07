import { type Maybe } from '@dereekb/util';
import { type TwilioIncomingMessagePayload } from './webhook.twilio';

/**
 * The opt-out keyword type Twilio reports on an incoming message (`OptOutType`).
 *
 * https://help.twilio.com/articles/31560110671259
 */
export enum TwilioOptOutType {
  /**
   * The sender opted out. Twilio blocks every message to them until they opt back in.
   */
  STOP = 'STOP',
  /**
   * The sender opted back in.
   */
  START = 'START',
  /**
   * The sender asked for help.
   */
  HELP = 'HELP'
}

/**
 * Twilio's default opt-out keywords.
 */
export const DEFAULT_TWILIO_OPT_OUT_KEYWORDS: readonly string[] = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT'];

/**
 * Twilio's default opt-in keywords.
 */
export const DEFAULT_TWILIO_OPT_IN_KEYWORDS: readonly string[] = ['START', 'YES', 'UNSTOP'];

/**
 * Twilio's default help keywords.
 */
export const DEFAULT_TWILIO_HELP_KEYWORDS: readonly string[] = ['HELP', 'INFO'];

const DEFAULT_TWILIO_OPT_OUT_TYPE_BY_KEYWORD = new Map<string, TwilioOptOutType>([
  ...DEFAULT_TWILIO_OPT_OUT_KEYWORDS.map((x) => [x, TwilioOptOutType.STOP] as const),
  ...DEFAULT_TWILIO_OPT_IN_KEYWORDS.map((x) => [x, TwilioOptOutType.START] as const),
  ...DEFAULT_TWILIO_HELP_KEYWORDS.map((x) => [x, TwilioOptOutType.HELP] as const)
]);

/**
 * Reads a {@link TwilioOptOutType} from a string, case-insensitively.
 *
 * @param value - The value to read, such as Twilio's `OptOutType` parameter.
 * @returns The opt-out type, or undefined when the value is not one.
 */
export function twilioOptOutTypeFromString(value: Maybe<string>): Maybe<TwilioOptOutType> {
  const normalized = value?.trim().toUpperCase();
  let result: Maybe<TwilioOptOutType>;

  switch (normalized) {
    case TwilioOptOutType.STOP:
    case TwilioOptOutType.START:
    case TwilioOptOutType.HELP:
      result = normalized;
      break;
    default:
      // not an opt-out type
      break;
  }

  return result;
}

/**
 * Config for {@link twilioIncomingMessageOptOutType}.
 */
export interface TwilioIncomingMessageOptOutTypeConfig {
  /**
   * Only trust Twilio's `OptOutType` parameter, and never match the body against the default keywords.
   *
   * Use with Advanced Opt-Out and custom keywords, where the default keywords may not be keywords at all.
   */
  readonly optOutTypeOnly?: Maybe<boolean>;
}

/**
 * Returns the opt-out keyword type of an incoming message, if it is one.
 *
 * Twilio's `OptOutType` parameter wins when present. It is only sent for messages to a Messaging Service, or to a number with
 * Advanced Opt-Out. Otherwise the body is matched, trimmed and case-insensitively, against Twilio's default keywords. Only a whole-body
 * match counts, so "Stop please" is not a keyword, matching how Twilio itself handles keywords.
 *
 * @param payload - The incoming message.
 * @param config - Whether to skip the default keyword fallback.
 * @returns The opt-out type, or undefined when the message is not a keyword.
 */
export function twilioIncomingMessageOptOutType(payload: Pick<TwilioIncomingMessagePayload, 'OptOutType' | 'Body'>, config?: Maybe<TwilioIncomingMessageOptOutTypeConfig>): Maybe<TwilioOptOutType> {
  let result: Maybe<TwilioOptOutType> = payload.OptOutType;

  if (result == null && !config?.optOutTypeOnly) {
    result = DEFAULT_TWILIO_OPT_OUT_TYPE_BY_KEYWORD.get(payload.Body.trim().toUpperCase());
  }

  return result;
}
