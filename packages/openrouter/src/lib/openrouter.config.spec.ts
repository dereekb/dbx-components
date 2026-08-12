import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENROUTER_PDF_PARSER_ENGINE, type OpenRouterModelConfig, mergeOpenRouterModelConfig, openRouterFileParserPlugin, openRouterFileSearchTool, openRouterProviderPinnedTo, validateOpenRouterModelConfig } from './openrouter.config';

describe('openRouterFileParserPlugin()', () => {
  it('should pin the native engine by default', () => {
    const plugin = openRouterFileParserPlugin();
    expect(plugin.id).toBe('file-parser');
    expect(plugin.pdf?.engine).toBe('native');
    expect(DEFAULT_OPENROUTER_PDF_PARSER_ENGINE).toBe('native');
  });

  it('should allow pinning another engine explicitly', () => {
    expect(openRouterFileParserPlugin('cloudflare-ai').pdf?.engine).toBe('cloudflare-ai');
  });
});

describe('openRouterProviderPinnedTo()', () => {
  it('should pin the provider, disable fallbacks, and require parameter support', () => {
    // All three together, because any one alone still lets a parameter be silently dropped.
    expect(openRouterProviderPinnedTo('openai')).toEqual({ only: ['openai'], allowFallbacks: false, requireParameters: true });
  });
});

describe('mergeOpenRouterModelConfig()', () => {
  it('should apply configs left to right', () => {
    const result = mergeOpenRouterModelConfig([{ model: 'openai/gpt-5.1', temperature: 0.2 }, { temperature: 0.9 }]);
    expect(result.model).toBe('openai/gpt-5.1');
    expect(result.temperature).toBe(0.9);
  });

  it('should not let an undefined override erase a value', () => {
    const result = mergeOpenRouterModelConfig([{ model: 'openai/gpt-5.1' }, { model: undefined }]);
    expect(result.model).toBe('openai/gpt-5.1');
  });

  it('should ignore null and undefined configs', () => {
    const result = mergeOpenRouterModelConfig([null, { model: 'a' }, undefined]);
    expect(result.model).toBe('a');
  });

  it('should replace a nested object rather than merging into it', () => {
    // A half-overridden provider config is one nobody wrote down and nobody can reason about.
    const result = mergeOpenRouterModelConfig([{ provider: { only: ['openai'], allowFallbacks: false } }, { provider: { only: ['anthropic'] } }]);
    expect(result.provider).toEqual({ only: ['anthropic'] });
  });

  it('should carry through parameters the interface does not name', () => {
    const result = mergeOpenRouterModelConfig([{ someFutureParam: 'x' } as OpenRouterModelConfig]);
    expect(result.someFutureParam).toBe('x');
  });
});

describe('validateOpenRouterModelConfig()', () => {
  it('should reject a config with no model', () => {
    const result = validateOpenRouterModelConfig({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
  });

  it('should accept a models fallback chain in place of a model', () => {
    expect(validateOpenRouterModelConfig({ models: ['openai/gpt-5.1'] }).valid).toBe(true);
  });

  it('should reject a null config', () => {
    expect(validateOpenRouterModelConfig(null).valid).toBe(false);
  });

  it('should reject a json_schema format missing its name or schema', () => {
    const result = validateOpenRouterModelConfig({ model: 'm', text: { format: { type: 'json_schema', name: '', schema: undefined as unknown as Record<string, unknown> } } });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
  });

  it('should accept a complete json_schema format', () => {
    expect(validateOpenRouterModelConfig({ model: 'm', text: { format: { type: 'json_schema', name: 'out', strict: true, schema: { type: 'object' } } } }).valid).toBe(true);
  });

  it('should warn when the file-parser plugin has no pinned pdf engine', () => {
    const result = validateOpenRouterModelConfig({ model: 'm', plugins: [{ id: 'file-parser' }] });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((x) => x.includes('mistral-ocr'))).toBe(true);
  });

  it('should not warn when the file-parser engine is pinned', () => {
    const result = validateOpenRouterModelConfig({ model: 'm', plugins: [openRouterFileParserPlugin()] });
    expect(result.warnings.some((x) => x.includes('mistral-ocr'))).toBe(false);
  });

  it('should warn when hosted tools are used without requireParameters', () => {
    const result = validateOpenRouterModelConfig({ model: 'm', tools: [openRouterFileSearchTool(['vs_1'])] });
    expect(result.warnings.some((x) => x.includes('requireParameters'))).toBe(true);
  });

  it('should not warn about hosted tools when the provider requires parameters', () => {
    const result = validateOpenRouterModelConfig({ model: 'm', tools: [openRouterFileSearchTool(['vs_1'])], provider: openRouterProviderPinnedTo('openai') });
    expect(result.warnings.some((x) => x.includes('requireParameters'))).toBe(false);
  });

  it('should reject a file_search tool authored with the wire-cased field name', () => {
    // The SDK names this field `vectorStoreIds` and strips anything it does not know, so the wire-cased
    // spelling produces a tool that searches nothing — answered confidently, ungrounded, with no error.
    const result = validateOpenRouterModelConfig({ model: 'm', tools: [{ type: 'file_search', vector_store_ids: ['vs_1'] }] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((x) => x.includes('vectorStoreIds'))).toBe(true);
  });

  it('should build a file_search tool with the field names the SDK forwards', () => {
    expect(openRouterFileSearchTool(['vs_1'], 5)).toEqual({ type: 'file_search', vectorStoreIds: ['vs_1'], maxNumResults: 5 });
  });

  it('should accept a well-formed hosted tool, which the direct /responses path can deliver', () => {
    // The limitation this used to reject is gone: a hosted-tool run bypasses `callModel` (whose client
    // function converter mangles a hosted entry) and posts to `/responses` directly.
    const result = validateOpenRouterModelConfig({ model: 'm', tools: [openRouterFileSearchTool(['vs_1'])], provider: openRouterProviderPinnedTo('openai') });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should warn when provider.only is set without disabling fallbacks', () => {
    const result = validateOpenRouterModelConfig({ model: 'm', provider: { only: ['openai'] } });
    expect(result.warnings.some((x) => x.includes('allowFallbacks'))).toBe(true);
  });
});
