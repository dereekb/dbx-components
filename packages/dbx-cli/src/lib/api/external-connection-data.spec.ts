import { describe, expect, it } from 'vitest';
import { passthroughCliExternalConnectionDataAdapter, summarizeCliExternalConnectionSettings } from './external-connection-data';

const ENV = { apiBaseUrl: 'http://localhost/api', oidcIssuer: 'http://localhost/oidc' };

describe('passthroughCliExternalConnectionDataAdapter()', () => {
  const adapter = passthroughCliExternalConnectionDataAdapter({ dataTypes: ['mail_signature'] });

  it('unpacks only the listed data types', () => {
    const settings = adapter.unpack({ providerType: 'microsoft', env: ENV, data: { mail_signature: { me: { html: '<p>Hi</p>' } }, other: { x: { y: 1 } } } });
    expect(settings).toEqual({ mail_signature: { me: { html: '<p>Hi</p>' } } });
  });

  it('unpacks nothing when no listed data type is stored', () => {
    expect(adapter.unpack({ providerType: 'microsoft', env: ENV, data: { other: { x: { y: 1 } } } })).toBeUndefined();
  });

  it('drops non-object items', () => {
    const settings = adapter.unpack({ providerType: 'microsoft', env: ENV, data: { mail_signature: { me: 'bad' as never, 'a@b.com': { text: 'Hi' } } } });
    expect(settings).toEqual({ mail_signature: { 'a@b.com': { text: 'Hi' } } });
  });

  it('packs the listed data types back out of settings', () => {
    const data = adapter.pack?.({ providerType: 'microsoft', settings: { mail_signature: { me: { text: 'Hi' } }, ignored: true } });
    expect(data).toEqual({ mail_signature: { me: { text: 'Hi' } } });
  });
});

describe('summarizeCliExternalConnectionSettings()', () => {
  it('lists item keys, never values', () => {
    const summary = summarizeCliExternalConnectionSettings({ mail_signature: { me: { html: 'secret-value' }, 'support@example.com': { text: 'x' } }, flag: 'on' });
    expect(summary).toEqual({ mail_signature: ['me', 'support@example.com'], flag: true });
    expect(JSON.stringify(summary)).not.toContain('secret-value');
  });

  it('returns undefined for no settings', () => {
    expect(summarizeCliExternalConnectionSettings(undefined)).toBeUndefined();
    expect(summarizeCliExternalConnectionSettings({})).toBeUndefined();
  });
});
