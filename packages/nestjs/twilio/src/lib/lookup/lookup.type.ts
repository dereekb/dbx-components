import { type Maybe } from '@dereekb/util';
import { type TwilioPhoneNumber } from '../twilio.type';

/**
 * Carrier information returned by the Twilio Lookup v2 API when the `line_type_intelligence`
 * data set is requested.
 */
export interface TwilioLookupCarrierInfo {
  readonly carrierName?: Maybe<string>;
  readonly type?: Maybe<string>;
  readonly mobileCountryCode?: Maybe<string>;
  readonly mobileNetworkCode?: Maybe<string>;
}

/**
 * Result of a Twilio Lookup v2 phone-number lookup.
 */
export interface TwilioLookupResult {
  /**
   * Whether Twilio could resolve the number to a valid phone number.
   */
  readonly valid: boolean;
  /**
   * The phone number in E.164 format, as normalized by Twilio.
   */
  readonly phoneNumber: TwilioPhoneNumber;
  /**
   * ISO country code (alpha-2) for the phone number.
   */
  readonly countryCode?: Maybe<string>;
  /**
   * National-format representation of the number.
   */
  readonly nationalFormat?: Maybe<string>;
  /**
   * Carrier information, populated only when `includeCarrier` was set on the lookup request.
   */
  readonly carrier?: Maybe<TwilioLookupCarrierInfo>;
}
