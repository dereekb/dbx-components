
export class TwilioServiceConfig {

  // Twilio Config
  twilio!: {
    accountSid: string;
    authToken: string;
  };

  static assertValidConfig(config: TwilioServiceConfig) {
    if (!config.twilio.accountSid) {
      throw new Error('No twilio accountSID specified.');
    } else if (!config.twilio.authToken) {
      throw new Error('No twilio auth token specified.');
    }
  }

}
