import { type Maybe } from '@dereekb/util';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type TwilioPhoneNumber } from '../twilio.type';
import { TwilioLookupApi } from './lookup.api';
import { type TwilioLookupCarrierInfo, type TwilioLookupResult } from './lookup.type';

export interface TwilioLookupInput {
  /**
   * Phone number to look up. Can be in any format Twilio accepts.
   */
  readonly phoneNumber: string;
  /**
   * When true, requests the `line_type_intelligence` data set so that carrier info is included
   * in the result. NOTE: Twilio charges per-lookup for this data set; do not enable in hot paths
   * without an explicit need.
   */
  readonly includeCarrier?: Maybe<boolean>;
  /**
   * ISO 3166-1 alpha-2 country code Twilio uses when interpreting nationally-formatted numbers.
   */
  readonly countryCode?: Maybe<string>;
}

@Injectable()
export class TwilioLookupService {
  private readonly logger = new Logger('TwilioLookupService');
  private readonly _twilioLookupApi: TwilioLookupApi;

  constructor(@Inject(TwilioLookupApi) twilioLookupApi: TwilioLookupApi) {
    this._twilioLookupApi = twilioLookupApi;
  }

  get twilioLookupApi(): TwilioLookupApi {
    return this._twilioLookupApi;
  }

  /**
   * Validates and normalizes a phone number via Twilio Lookup v2. Optionally returns carrier
   * information when `includeCarrier` is set (additional Twilio charges apply).
   *
   * @param input - Phone number to look up plus optional carrier / country-code flags.
   * @returns The lookup result, with `valid: false` when Twilio cannot resolve the number.
   */
  async lookup(input: TwilioLookupInput): Promise<TwilioLookupResult> {
    const phoneNumberInstance = this._twilioLookupApi.phoneNumbers(input.phoneNumber);
    const fetchInput: { fields?: string; countryCode?: string } = {};

    if (input.includeCarrier) {
      fetchInput.fields = 'line_type_intelligence';
    }

    if (input.countryCode) {
      fetchInput.countryCode = input.countryCode;
    }

    let result: TwilioLookupResult;

    try {
      const lookup = await phoneNumberInstance.fetch(fetchInput);
      let carrier: Maybe<TwilioLookupCarrierInfo>;

      if (input.includeCarrier && lookup.lineTypeIntelligence) {
        const lti = lookup.lineTypeIntelligence as Record<string, unknown>;
        carrier = {
          carrierName: lti['carrier_name'] as string | undefined,
          type: lti['type'] as string | undefined,
          mobileCountryCode: lti['mobile_country_code'] as string | undefined,
          mobileNetworkCode: lti['mobile_network_code'] as string | undefined
        };
      }

      result = {
        valid: Boolean(lookup.valid),
        phoneNumber: lookup.phoneNumber as TwilioPhoneNumber,
        countryCode: lookup.countryCode,
        nationalFormat: lookup.nationalFormat,
        carrier
      };
    } catch (e) {
      this.logger.warn(`Failed to lookup phone number ${input.phoneNumber}: ${e instanceof Error ? e.message : String(e)}`);
      result = {
        valid: false,
        phoneNumber: input.phoneNumber as TwilioPhoneNumber
      };
    }

    return result;
  }
}

/**
 * Provides a reference to a TwilioLookupService instance.
 */
export interface TwilioLookupServiceRef {
  readonly twilioLookupService: TwilioLookupService;
}
