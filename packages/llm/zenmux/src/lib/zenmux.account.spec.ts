import { describe, expect, it } from 'vitest';
import { isLlmZenmuxBaseUrl, resolveLlmZenmuxAccountBaseUrl, LLM_ZENMUX_SYNC_COST_BASIS } from './zenmux.account';
import { DEFAULT_LLM_ZENMUX_BASE_URL } from './zenmux.constants';

describe('isLlmZenmuxBaseUrl()', () => {
  it('recognizes the ZenMux origin', () => {
    expect(isLlmZenmuxBaseUrl('https://zenmux.ai/api/v1')).toBe(true);
  });

  it('recognizes a ZenMux subdomain', () => {
    expect(isLlmZenmuxBaseUrl('https://eu.zenmux.ai/api/v1')).toBe(true);
  });

  it('rejects a LOOK-ALIKE host rather than substring-matching it', () => {
    expect(isLlmZenmuxBaseUrl('https://zenmux.ai.example.com/api/v1')).toBe(false);
  });

  it('rejects bare OpenAI, an unparseable value, an absent one and a blank one without throwing', () => {
    expect(isLlmZenmuxBaseUrl('https://api.openai.com/v1')).toBe(false);
    expect(isLlmZenmuxBaseUrl('not a url')).toBe(false);
    expect(isLlmZenmuxBaseUrl(undefined)).toBe(false);
    expect(isLlmZenmuxBaseUrl('   ')).toBe(false);
  });
});

describe('LLM_ZENMUX_SYNC_COST_BASIS', () => {
  it('is the list basis', () => {
    expect(LLM_ZENMUX_SYNC_COST_BASIS).toBe('list');
  });
});

describe('resolveLlmZenmuxAccountBaseUrl()', () => {
  it('keeps a ZenMux URL, a regional subdomain included', () => {
    expect(resolveLlmZenmuxAccountBaseUrl('https://zenmux.ai/api/v1')).toBe('https://zenmux.ai/api/v1');
    expect(resolveLlmZenmuxAccountBaseUrl('https://eu.zenmux.ai/api/v1')).toBe('https://eu.zenmux.ai/api/v1');
  });

  it('reads the account at the default ZenMux URL for a LAN proxy or an absent URL', () => {
    expect(resolveLlmZenmuxAccountBaseUrl('http://192.168.1.50:8000/v1')).toBe(DEFAULT_LLM_ZENMUX_BASE_URL);
    expect(resolveLlmZenmuxAccountBaseUrl(undefined)).toBe(DEFAULT_LLM_ZENMUX_BASE_URL);
  });
});
