import { describe, it, expect } from 'vitest';
import { TwilioServiceConfig } from './twilio.config';

function makeConfig(overrides: Partial<TwilioServiceConfig> = {}): TwilioServiceConfig {
  return {
    twilio: {
      accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      authToken: 'test_auth_token'
    },
    messages: {
      defaultFrom: '+15555550100'
    },
    ...overrides
  } as TwilioServiceConfig;
}

describe('TwilioServiceConfig.assertValidConfig()', () => {
  it('accepts a config with accountSid + authToken + defaultFrom', () => {
    expect(() => TwilioServiceConfig.assertValidConfig(makeConfig())).not.toThrow();
  });

  it('accepts a config with accountSid + API key pair + messagingServiceSid', () => {
    const config = makeConfig({
      twilio: {
        accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        authToken: undefined,
        apiKeySid: 'SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        apiKeySecret: 'secret_value'
      },
      messages: {
        defaultFrom: undefined,
        messagingServiceSid: 'MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      }
    });

    expect(() => TwilioServiceConfig.assertValidConfig(config)).not.toThrow();
  });

  it('throws when accountSid is missing', () => {
    const config = makeConfig({
      twilio: {
        accountSid: '',
        authToken: 'test_auth_token'
      }
    });

    expect(() => TwilioServiceConfig.assertValidConfig(config)).toThrow(/TWILIO_ACCOUNT_SID/);
  });

  it('throws when neither authToken nor API key pair is provided', () => {
    const config = makeConfig({
      twilio: {
        accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        authToken: undefined,
        apiKeySid: undefined,
        apiKeySecret: undefined
      }
    });

    expect(() => TwilioServiceConfig.assertValidConfig(config)).toThrow(/TWILIO_AUTH_TOKEN/);
  });

  it('throws when API key SID is provided without a secret', () => {
    const config = makeConfig({
      twilio: {
        accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        authToken: undefined,
        apiKeySid: 'SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        apiKeySecret: undefined
      }
    });

    expect(() => TwilioServiceConfig.assertValidConfig(config)).toThrow(/TWILIO_AUTH_TOKEN/);
  });

  it('throws when neither defaultFrom nor messagingServiceSid is provided', () => {
    const config = makeConfig({
      messages: {
        defaultFrom: undefined,
        messagingServiceSid: undefined
      }
    });

    expect(() => TwilioServiceConfig.assertValidConfig(config)).toThrow(/TWILIO_PHONE_NUMBER/);
  });
});
