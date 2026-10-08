import { describe, it, expect } from 'vitest';
import { type ConfigService } from '@nestjs/config';
import { TwilioApi } from './twilio.api';
import { twilioServiceConfigFactory } from './twilio.module';
import { twilioWebhookUrls } from './webhook/webhook.twilio.url';

function makeConfigService(env: Record<string, string>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

const PLACEHOLDER_ENV = {
  TWILIO_ACCOUNT_SID: 'placeholder',
  TWILIO_API_KEY_SID: 'xxx',
  TWILIO_API_KEY_SECRET: 'xxx',
  TWILIO_MESSAGING_SERVICE_SID: 'xxx'
};

const REAL_ENV = {
  ...PLACEHOLDER_ENV,
  TWILIO_ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  TWILIO_AUTH_TOKEN: 'test_auth_token',
  TWILIO_PHONE_NUMBER: '+15555550100'
};

describe('twilioServiceConfigFactory()', () => {
  it('keeps the placeholder values when the environment has no usable config', () => {
    const config = twilioServiceConfigFactory(makeConfigService(PLACEHOLDER_ENV));
    expect(config.twilio.accountSid).toBe('placeholder');
  });

  it('removes placeholder values from a usable config', () => {
    const config = twilioServiceConfigFactory(makeConfigService(REAL_ENV));
    expect(config.messages.defaultFrom).toBe('+15555550100');
    expect(config.messages.messagingServiceSid).toBeUndefined();
    expect(config.twilio.apiKeySid).toBeUndefined();
  });

  it('uses the status callback url of the webhook urls config', () => {
    const config = twilioServiceConfigFactory(makeConfigService(REAL_ENV), { twilioWebhookUrls: twilioWebhookUrls('https://app.example.com/api/webhook') });
    expect(config.messages.defaultStatusCallback).toBe('https://app.example.com/api/webhook/twilio/status');
  });

  it('sets no status callback when the webhook urls config has no urls', () => {
    const config = twilioServiceConfigFactory(makeConfigService(REAL_ENV), { twilioWebhookUrls: undefined });
    expect(config.messages.defaultStatusCallback).toBeUndefined();
  });
});

describe('TwilioApi', () => {
  it('can be created with a placeholder config', () => {
    const api = new TwilioApi(twilioServiceConfigFactory(makeConfigService(PLACEHOLDER_ENV)));
    expect(api).toBeDefined();
  });

  it('throws when the client of a placeholder config is used', () => {
    const api = new TwilioApi(twilioServiceConfigFactory(makeConfigService(PLACEHOLDER_ENV)));
    expect(() => api.client).toThrow();
  });
});
