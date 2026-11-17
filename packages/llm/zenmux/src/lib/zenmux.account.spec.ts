import { describe, expect, it } from 'vitest';
import { isZenmuxBaseUrl, isZenmuxMeteredProvider, zenmuxAccountBaseUrlOf, zenmuxCostBasisFor, ZENMUX_SYNC_COST_BASIS } from './zenmux.account';
import { DEFAULT_ZENMUX_BASE_URL } from './zenmux.constants';

describe('isZenmuxBaseUrl()', () => {
  it('recognizes the ZenMux origin', () => {
    expect(isZenmuxBaseUrl('https://zenmux.ai/api/v1')).toBe(true);
  });

  it('recognizes a ZenMux subdomain', () => {
    expect(isZenmuxBaseUrl('https://eu.zenmux.ai/api/v1')).toBe(true);
  });

  it('rejects a LOOK-ALIKE host rather than substring-matching it', () => {
    expect(isZenmuxBaseUrl('https://zenmux.ai.example.com/api/v1')).toBe(false);
  });

  it('rejects bare OpenAI, an unparseable value, an absent one and a blank one without throwing', () => {
    expect(isZenmuxBaseUrl('https://api.openai.com/v1')).toBe(false);
    expect(isZenmuxBaseUrl('not a url')).toBe(false);
    expect(isZenmuxBaseUrl(undefined)).toBe(false);
    expect(isZenmuxBaseUrl('   ')).toBe(false);
  });
});

describe('ZENMUX_SYNC_COST_BASIS', () => {
  it('is the list basis', () => {
    expect(ZENMUX_SYNC_COST_BASIS).toBe('list');
  });
});

describe('zenmuxCostBasisFor()', () => {
  it("is ZenMux's list basis for a provider that DECLARES zenmux metering, whatever its URL", () => {
    expect(zenmuxCostBasisFor({ metering: 'zenmux', baseUrl: 'https://zenmux.ai/api/v1' })).toBe('list');
    expect(zenmuxCostBasisFor({ metering: 'zenmux', baseUrl: 'http://192.168.1.50:8000/v1' })).toBe('list');
  });

  it('is nothing for a provider that declares another metering, even at the ZenMux URL', () => {
    expect(zenmuxCostBasisFor({ metering: 'none', baseUrl: 'https://zenmux.ai/api/v1' })).toBeUndefined();
    expect(zenmuxCostBasisFor({ metering: 'voice-vendor', baseUrl: 'https://zenmux.ai/api/v1' })).toBeUndefined();
  });

  it('falls back to the URL only when nothing was declared', () => {
    expect(zenmuxCostBasisFor({ baseUrl: 'https://zenmux.ai/api/v1' })).toBe('list');
    expect(zenmuxCostBasisFor({ baseUrl: 'https://api.openai.com/v1' })).toBeUndefined();
    expect(zenmuxCostBasisFor({ baseUrl: undefined })).toBeUndefined();
  });
});

describe('isZenmuxMeteredProvider()', () => {
  it('follows a declared metering first, then the URL', () => {
    expect(isZenmuxMeteredProvider({ metering: 'zenmux', baseUrl: 'http://192.168.1.50:8000/v1' })).toBe(true);
    expect(isZenmuxMeteredProvider({ metering: 'none', baseUrl: 'https://zenmux.ai/api/v1' })).toBe(false);
    expect(isZenmuxMeteredProvider({ metering: 'voice-vendor', baseUrl: 'https://zenmux.ai/api/v1' })).toBe(false);
    expect(isZenmuxMeteredProvider({ baseUrl: 'https://zenmux.ai/api/v1' })).toBe(true);
    expect(isZenmuxMeteredProvider({ baseUrl: 'https://api.openai.com/v1' })).toBe(false);
    expect(isZenmuxMeteredProvider({ baseUrl: undefined })).toBe(false);
  });
});

describe('zenmuxAccountBaseUrlOf()', () => {
  it('keeps a ZenMux URL, a regional subdomain included', () => {
    expect(zenmuxAccountBaseUrlOf('https://zenmux.ai/api/v1')).toBe('https://zenmux.ai/api/v1');
    expect(zenmuxAccountBaseUrlOf('https://eu.zenmux.ai/api/v1')).toBe('https://eu.zenmux.ai/api/v1');
  });

  it('reads the account at the default ZenMux URL for a LAN proxy or an absent URL', () => {
    expect(zenmuxAccountBaseUrlOf('http://192.168.1.50:8000/v1')).toBe(DEFAULT_ZENMUX_BASE_URL);
    expect(zenmuxAccountBaseUrlOf(undefined)).toBe(DEFAULT_ZENMUX_BASE_URL);
  });
});
