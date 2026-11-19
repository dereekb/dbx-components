import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_DECODE_RETRY_TIER, DEFAULT_LLM_MODEL_TIER, isLlmOffValue, LLM_OFF_VALUES, type LlmModelTierMap, llmTierConfigOf, llmTierModelOf, resolveLlmDefaultModelTierKey, resolveLlmModelTier, resolveLlmModelTiers, resolveLlmModelTierValue } from './llm.model.tier';
import { type LlmModelTierConfig } from './llm.value';

const FAST_MODEL = 'vendor/model-fast';
const STRONG_MODEL = 'vendor/model-strong';
const BASE: LlmModelTierMap = { fast: FAST_MODEL, strong: STRONG_MODEL };

describe('tier key defaults', () => {
  it('ships keys, never slugs', () => {
    expect(DEFAULT_LLM_MODEL_TIER).toBe('fast');
    expect(DEFAULT_LLM_DECODE_RETRY_TIER).toBe('strong');
  });
});

describe('isLlmOffValue()', () => {
  it('matches every off value, trimmed and in any case', () => {
    expect(LLM_OFF_VALUES).toEqual(['off', 'none']);
    expect(isLlmOffValue('off')).toBe(true);
    expect(isLlmOffValue('OFF')).toBe(true);
    expect(isLlmOffValue(' None ')).toBe(true);
  });

  it('treats blank, absent and other values as not off', () => {
    expect(isLlmOffValue('')).toBe(false);
    expect(isLlmOffValue('  ')).toBe(false);
    expect(isLlmOffValue(undefined)).toBe(false);
    expect(isLlmOffValue(null)).toBe(false);
    expect(isLlmOffValue('strong')).toBe(false);
    expect(isLlmOffValue('offline')).toBe(false);
  });
});

describe('resolveLlmDefaultModelTierKey()', () => {
  it('trims the setting and falls back to the default tier when blank or absent', () => {
    expect(resolveLlmDefaultModelTierKey(' strong ')).toBe('strong');
    expect(resolveLlmDefaultModelTierKey('')).toBe(DEFAULT_LLM_MODEL_TIER);
    expect(resolveLlmDefaultModelTierKey('  ')).toBe(DEFAULT_LLM_MODEL_TIER);
    expect(resolveLlmDefaultModelTierKey(undefined)).toBe(DEFAULT_LLM_MODEL_TIER);
  });

  it('is what resolveLlmModelTiers() resolves a padded or blank default tier with', () => {
    expect(resolveLlmModelTiers({ base: BASE, defaultTier: ' strong ' }).defaultTier).toBe('strong');
    expect(resolveLlmModelTiers({ base: BASE, defaultTier: '' }).defaultTier).toBe('fast');
  });
});

describe('llmTierModelOf()', () => {
  it('reads a bare-slug tier value to itself', () => {
    expect(llmTierModelOf(STRONG_MODEL)).toBe(STRONG_MODEL);
  });

  it('reads a rich tier config to its `model` slug (the output-control fields do not affect model resolution)', () => {
    const config: LlmModelTierConfig = { model: FAST_MODEL, maxOutputTokens: 16_384, reasoning: { effort: 'high' } };
    expect(llmTierModelOf(config)).toBe(FAST_MODEL);
  });
});

describe('llmTierConfigOf()', () => {
  it('normalizes a bare-slug tier value to `{ model }` (no output controls)', () => {
    expect(llmTierConfigOf('x/slug')).toEqual({ model: 'x/slug' });
  });

  it('passes a rich tier config through unchanged (identity)', () => {
    const config: LlmModelTierConfig = { model: 'x/slug', maxOutputTokens: 8_192, reasoning: { maxTokens: 2048, exclude: true } };
    expect(llmTierConfigOf(config)).toBe(config);
  });
});

describe('resolveLlmModelTier()', () => {
  it('resolves a known key to its slug', () => {
    expect(resolveLlmModelTier(BASE, 'fast')).toBe(FAST_MODEL);
    expect(resolveLlmModelTier(BASE, 'strong')).toBe(STRONG_MODEL);
  });

  it('FAILS LOUD on an unknown key (no silent fallback), naming the available keys', () => {
    expect(() => resolveLlmModelTier(BASE, 'nope')).toThrow(/unknown model tier 'nope'/);
    expect(() => resolveLlmModelTier(BASE, 'nope')).toThrow(/have: fast, strong/);
  });

  it('prints (none) for an empty map', () => {
    expect(() => resolveLlmModelTier({}, 'fast')).toThrow(/unknown model tier 'fast' \(have: \(none\)\)/);
  });

  it('resolves the SLUG of a rich-config tier exactly like a bare-slug tier', () => {
    const tiers: LlmModelTierMap = { fast: 'a/flash', strong: { model: 'b/pro', maxOutputTokens: 16_384 } };
    expect(resolveLlmModelTier(tiers, 'strong')).toBe('b/pro');
  });
});

describe('resolveLlmModelTierValue()', () => {
  const tiers: LlmModelTierMap = { fast: 'a/flash', strong: 'b/pro', rich: { model: 'c/rich', maxOutputTokens: 16_384, reasoning: { effort: 'high' } } };

  it('returns a bare-slug tier value verbatim', () => {
    expect(resolveLlmModelTierValue(tiers, 'fast')).toBe('a/flash');
  });

  it('returns a rich tier config verbatim (the output controls survive the resolve)', () => {
    expect(resolveLlmModelTierValue(tiers, 'rich')).toEqual({ model: 'c/rich', maxOutputTokens: 16_384, reasoning: { effort: 'high' } });
  });

  it('FAILS LOUD on an unknown key, like its slug sibling', () => {
    expect(() => resolveLlmModelTierValue(tiers, 'ghost')).toThrow(/unknown model tier 'ghost'/);
  });
});

describe('resolveLlmModelTiers()', () => {
  it('returns the base and fast when the host declares nothing', () => {
    const { tiers, defaultTier } = resolveLlmModelTiers({ base: BASE });
    expect(defaultTier).toBe('fast');
    expect(tiers['fast']).toBe(FAST_MODEL);
    expect(tiers['strong']).toBe(STRONG_MODEL);
  });

  it('merges a PARTIAL host declaration OVER the base (base keys preserved, arbitrary keys kept)', () => {
    const { tiers } = resolveLlmModelTiers({ base: BASE, modelTiers: { strong: 'vendor/model-premium', cheap: 'x/cheap' } });
    expect(tiers['strong']).toBe('vendor/model-premium');
    expect(tiers['fast']).toBe(FAST_MODEL);
    expect(resolveLlmModelTier(tiers, 'cheap')).toBe('x/cheap');
  });

  it('honours the default-tier switch', () => {
    const { defaultTier, tiers } = resolveLlmModelTiers({ base: BASE, defaultTier: 'strong' });
    expect(defaultTier).toBe('strong');
    expect(resolveLlmModelTier(tiers, defaultTier)).toBe(STRONG_MODEL);
  });

  it('resolves the default tier against a host-declared arbitrary key', () => {
    const { defaultTier, tiers } = resolveLlmModelTiers({ base: BASE, modelTiers: { premium: 'x/premium' }, defaultTier: 'premium' });
    expect(defaultTier).toBe('premium');
    expect(resolveLlmModelTier(tiers, defaultTier)).toBe('x/premium');
  });

  it('FAILS LOUD when the default tier is not in the merged map', () => {
    expect(() => resolveLlmModelTiers({ base: BASE, defaultTier: 'ghost' })).toThrow(/unknown model tier 'ghost'/);
  });

  it('FAILS LOUD with no base and no tiers (the library ships no slug)', () => {
    expect(() => resolveLlmModelTiers({})).toThrow(/unknown model tier 'fast' \(have: \(none\)\)/);
  });

  it('resolves with no base when the declaration carries the default tier', () => {
    const { tiers, defaultTier } = resolveLlmModelTiers({ modelTiers: { fast: FAST_MODEL } });
    expect(defaultTier).toBe('fast');
    expect(tiers).toEqual({ fast: FAST_MODEL });
  });

  it('never lets a null or undefined value into the map', () => {
    const { tiers } = resolveLlmModelTiers({ base: { fast: FAST_MODEL, strong: undefined }, modelTiers: { fast: undefined, cheap: null as unknown as string } });
    expect(tiers).toEqual({ fast: FAST_MODEL });
    expect(Object.keys(tiers)).toEqual(['fast']);
  });
});
