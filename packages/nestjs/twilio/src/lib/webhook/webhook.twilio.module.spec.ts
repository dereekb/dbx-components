import { describe, it, expect } from 'vitest';
import { type ConfigService } from '@nestjs/config';
import { twilioWebhookServiceConfigFactory } from './webhook.twilio.module';
import { twilioWebhookUrls } from './webhook.twilio.url';

function makeConfigService(env: Record<string, string>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

describe('twilioWebhookServiceConfigFactory()', () => {
  it('uses TWILIO_WEBHOOK_AUTH_TOKEN when it is set', () => {
    const config = twilioWebhookServiceConfigFactory(makeConfigService({ TWILIO_WEBHOOK_AUTH_TOKEN: 'webhook_token', TWILIO_AUTH_TOKEN: 'auth_token' }));
    expect(config.twilioWebhook.authToken).toBe('webhook_token');
  });

  it('falls back to TWILIO_AUTH_TOKEN when TWILIO_WEBHOOK_AUTH_TOKEN is unset', () => {
    const config = twilioWebhookServiceConfigFactory(makeConfigService({ TWILIO_AUTH_TOKEN: 'auth_token' }));
    expect(config.twilioWebhook.authToken).toBe('auth_token');
  });

  it('falls back to TWILIO_AUTH_TOKEN when TWILIO_WEBHOOK_AUTH_TOKEN is a placeholder', () => {
    const config = twilioWebhookServiceConfigFactory(makeConfigService({ TWILIO_WEBHOOK_AUTH_TOKEN: 'xxx', TWILIO_AUTH_TOKEN: 'auth_token' }));
    expect(config.twilioWebhook.authToken).toBe('auth_token');
  });

  it('keeps the placeholder when no real token is set', () => {
    const config = twilioWebhookServiceConfigFactory(makeConfigService({ TWILIO_WEBHOOK_AUTH_TOKEN: 'placeholder' }));
    expect(config.twilioWebhook.authToken).toBe('placeholder');
  });

  it('leaves the token unset when neither variable is set', () => {
    const config = twilioWebhookServiceConfigFactory(makeConfigService({}));
    expect(config.twilioWebhook.authToken).toBeUndefined();
  });

  it('reads the skip verify flag', () => {
    const config = twilioWebhookServiceConfigFactory(makeConfigService({ TWILIO_AUTH_TOKEN: 'auth_token', TWILIO_WEBHOOK_SKIP_VERIFY: 'true' }));
    expect(config.twilioWebhook.skipVerify).toBe(true);
  });

  it('uses the base url of the webhook urls config', () => {
    const config = twilioWebhookServiceConfigFactory(makeConfigService({ TWILIO_AUTH_TOKEN: 'auth_token' }), { twilioWebhookUrls: twilioWebhookUrls('https://app.example.com/api/webhook') });
    expect(config.twilioWebhook.baseUrl).toBe('https://app.example.com');
  });

  it('does not read a base url from the environment', () => {
    const config = twilioWebhookServiceConfigFactory(makeConfigService({ TWILIO_AUTH_TOKEN: 'auth_token', TWILIO_WEBHOOK_BASE_URL: 'https://api.example.com' }));
    expect(config.twilioWebhook.baseUrl).toBeUndefined();
  });
});
