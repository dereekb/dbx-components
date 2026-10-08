import { describe, it, expect } from 'vitest';
import { TwilioServiceConfig, isPlaceholderTwilioConfigValue, isUsableTwilioServiceConfig, usableTwilioServiceConfig } from './twilio.config';

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

describe('isPlaceholderTwilioConfigValue()', () => {
  it('treats unset, empty, "placeholder" and "xxx" values as placeholders', () => {
    expect(isPlaceholderTwilioConfigValue(undefined)).toBe(true);
    expect(isPlaceholderTwilioConfigValue(null)).toBe(true);
    expect(isPlaceholderTwilioConfigValue('')).toBe(true);
    expect(isPlaceholderTwilioConfigValue('placeholder')).toBe(true);
    expect(isPlaceholderTwilioConfigValue(' PLACEHOLDER ')).toBe(true);
    expect(isPlaceholderTwilioConfigValue('xxx')).toBe(true);
  });

  it('does not treat real values as placeholders', () => {
    expect(isPlaceholderTwilioConfigValue('AC123')).toBe(false);
  });
});

describe('usableTwilioServiceConfig()', () => {
  it('returns undefined for an unset config', () => {
    expect(usableTwilioServiceConfig(undefined)).toBeUndefined();
  });

  it('returns a copy of a usable config', () => {
    const config = makeConfig();
    const result = usableTwilioServiceConfig(config);

    expect(result).toBeDefined();
    expect(result).not.toBe(config);
    expect(result?.twilio.accountSid).toBe(config.twilio.accountSid);
    expect(result?.twilio.authToken).toBe(config.twilio.authToken);
    expect(result?.messages.defaultFrom).toBe(config.messages.defaultFrom);
  });

  it('returns undefined for the placeholder values shipped in the committed .env', () => {
    const config = makeConfig({
      twilio: {
        accountSid: 'placeholder',
        apiKeySid: 'xxx',
        apiKeySecret: 'xxx'
      },
      messages: {
        messagingServiceSid: 'xxx',
        defaultStatusCallback: 'placeholder',
        sandbox: false
      }
    });

    expect(usableTwilioServiceConfig(config)).toBeUndefined();
    expect(isUsableTwilioServiceConfig(config)).toBe(false);
  });

  it('returns undefined when the Account SID does not start with AC', () => {
    const config = makeConfig({
      twilio: {
        accountSid: 'not_an_account_sid',
        authToken: 'test_auth_token'
      }
    });

    expect(usableTwilioServiceConfig(config)).toBeUndefined();
  });

  it('returns undefined when there is no usable auth token or API key pair', () => {
    const config = makeConfig({
      twilio: {
        accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        authToken: 'placeholder',
        apiKeySid: 'SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        apiKeySecret: 'xxx'
      }
    });

    expect(usableTwilioServiceConfig(config)).toBeUndefined();
  });

  it('returns undefined when there is no usable sender', () => {
    const config = makeConfig({
      messages: {
        defaultFrom: '5555550100',
        messagingServiceSid: 'xxx'
      }
    });

    expect(usableTwilioServiceConfig(config)).toBeUndefined();
  });

  it('accepts an API key pair with a Messaging Service SID', () => {
    const config = makeConfig({
      twilio: {
        accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        apiKeySid: 'SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        apiKeySecret: 'secret_value'
      },
      messages: {
        messagingServiceSid: 'MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      }
    });

    const result = usableTwilioServiceConfig(config);

    expect(result?.twilio.apiKeySid).toBe('SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    expect(result?.twilio.apiKeySecret).toBe('secret_value');
    expect(result?.messages.messagingServiceSid).toBe('MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  });

  it('drops a placeholder API key pair that would shadow a real auth token', () => {
    const config = makeConfig({
      twilio: {
        accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        authToken: 'test_auth_token',
        apiKeySid: 'xxx',
        apiKeySecret: 'xxx'
      }
    });

    const result = usableTwilioServiceConfig(config);

    expect(result?.twilio.authToken).toBe('test_auth_token');
    expect(result?.twilio.apiKeySid).toBeUndefined();
    expect(result?.twilio.apiKeySecret).toBeUndefined();
  });

  it('drops a placeholder Messaging Service SID that would shadow a real sender number', () => {
    const config = makeConfig({
      messages: {
        defaultFrom: '+15555550100',
        messagingServiceSid: 'xxx'
      }
    });

    const result = usableTwilioServiceConfig(config);

    expect(result?.messages.defaultFrom).toBe('+15555550100');
    expect(result?.messages.messagingServiceSid).toBeUndefined();
  });

  it('drops a placeholder status callback and keeps a real one', () => {
    const placeholderResult = usableTwilioServiceConfig(makeConfig({ messages: { defaultFrom: '+15555550100', defaultStatusCallback: 'placeholder' } }));
    expect(placeholderResult).toBeDefined();
    expect(placeholderResult?.messages.defaultStatusCallback).toBeUndefined();

    const realResult = usableTwilioServiceConfig(makeConfig({ messages: { defaultFrom: '+15555550100', defaultStatusCallback: 'https://example.com/webhook/twilio/status' } }));
    expect(realResult?.messages.defaultStatusCallback).toBe('https://example.com/webhook/twilio/status');
  });

  it('keeps the sandbox flag', () => {
    const result = usableTwilioServiceConfig(makeConfig({ messages: { defaultFrom: '+15555550100', sandbox: true } }));
    expect(result?.messages.sandbox).toBe(true);
  });
});
