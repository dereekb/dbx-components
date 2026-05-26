import { type Maybe } from '@dereekb/util';
import { type TwilioVerifyServiceSid } from '../twilio.type';

export const TWILIO_VERIFY_SERVICE_SID_ENV_VAR = 'TWILIO_VERIFY_SERVICE_SID';

export interface TwilioVerifyConfig {
  /**
   * Twilio Verify Service SID. Required.
   */
  readonly verifyServiceSid: TwilioVerifyServiceSid;
  /**
   * Default channel used when starting a verification.
   *
   * Defaults to `'sms'`.
   */
  readonly defaultChannel?: Maybe<'sms' | 'call' | 'email' | 'whatsapp'>;
}

/**
 * Configuration for {@link TwilioVerifyApi} and {@link TwilioVerifyService}.
 */
export abstract class TwilioVerifyServiceConfig {
  readonly twilioVerify!: TwilioVerifyConfig;

  static assertValidConfig(config: TwilioVerifyServiceConfig): void {
    if (!config.twilioVerify.verifyServiceSid) {
      throw new Error('TwilioVerifyServiceConfig: TWILIO_VERIFY_SERVICE_SID is required.');
    }
  }
}
