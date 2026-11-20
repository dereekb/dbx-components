/**
 * `toLlmUsage` — the ONE fold from a provider's raw usage block to {@link LlmUsage}. The acceptance test is the
 * ABSENCE semantics, which are load-bearing: an omitted `cost` is what a ledger reads as cost-UNKNOWN, and a
 * `cost: undefined` spread in its place would read as a reported zero. So this pins, for both raw shapes (the bare
 * OpenAI-compatible one and the richer OpenRouter one), exactly which keys survive and which stay absent.
 */

import { describe, it, expect } from 'vitest';
import { toLlmUsage } from './llm.usage';

describe('toLlmUsage', () => {
  it('reports NO usage at all when the provider returned none: not a zeroed one', () => {
    expect(toLlmUsage(undefined)).toBeUndefined();
    expect(toLlmUsage(null)).toBeUndefined();
  });

  it('keeps the three token counts always present, defaulting to 0', () => {
    expect(toLlmUsage({})).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('OMITS every optional key the provider did not report: the bare OpenAI-compatible shape', () => {
    const usage = toLlmUsage({ prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 });

    expect(usage).toEqual({ promptTokens: 120, completionTokens: 40, totalTokens: 160 });
    expect(Object.keys(usage ?? {})).toEqual(['promptTokens', 'completionTokens', 'totalTokens']);
    expect('cost' in (usage ?? {})).toBe(false);
  });

  it('folds the OpenAI-flavoured detail block (cached + reasoning + an aggregator cost)', () => {
    const usage = toLlmUsage({
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
      prompt_tokens_details: { cached_tokens: 64 },
      completion_tokens_details: { reasoning_tokens: 12 },
      cost: 0.0004,
      cost_details: { upstream_inference_cost: 0.0003 }
    });

    expect(usage).toEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 120, cachedTokens: 64, reasoningTokens: 12, cost: 0.0004, costDetails: { upstreamInferenceCost: 0.0003 } });
  });

  it('folds the OpenRouter-flavoured detail block, cache WRITES included', () => {
    const usage = toLlmUsage({
      prompt_tokens: 900,
      completion_tokens: 300,
      total_tokens: 1200,
      prompt_tokens_details: { cached_tokens: 512, cache_write_tokens: 256 },
      completion_tokens_details: { reasoning_tokens: 180 },
      cost: 0.0123,
      cost_details: { upstream_inference_cost: 0.0101 }
    });

    expect(usage).toEqual({ promptTokens: 900, completionTokens: 300, totalTokens: 1200, cachedTokens: 512, cacheWriteTokens: 256, reasoningTokens: 180, cost: 0.0123, costDetails: { upstreamInferenceCost: 0.0101 } });
  });

  it('folds a reported image-token count (some models report one), zero included; absent stays absent', () => {
    expect(toLlmUsage({ prompt_tokens: 1600, completion_tokens: 200, total_tokens: 1800, prompt_tokens_details: { image_tokens: 578 } })).toEqual({ promptTokens: 1600, completionTokens: 200, totalTokens: 1800, imageTokens: 578 });
    expect(toLlmUsage({ prompt_tokens: 900, completion_tokens: 1, total_tokens: 901, prompt_tokens_details: { image_tokens: 0 } })?.imageTokens).toBe(0);
    expect(toLlmUsage({ prompt_tokens: 900, completion_tokens: 1, total_tokens: 901, prompt_tokens_details: { cached_tokens: 10 } })).not.toHaveProperty('imageTokens');
  });

  it('keeps a reported ZERO cost: zero is a reading, absence is not', () => {
    expect(toLlmUsage({ prompt_tokens: 1, completion_tokens: 0, total_tokens: 1, cost: 0 })).toEqual({ promptTokens: 1, completionTokens: 0, totalTokens: 1, cost: 0 });
  });

  it('omits `costDetails` when the breakdown carried no upstream figure', () => {
    expect(toLlmUsage({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost_details: {} })).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
  });

  it('parses a numeric STRING cost (some gateways send one) and omits a non-numeric one', () => {
    expect(toLlmUsage({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: '0.00065716', cost_details: { upstream_inference_cost: '0.0005' } })).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2, cost: 0.00065716, costDetails: { upstreamInferenceCost: 0.0005 } });
    expect(toLlmUsage({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 'free', cost_details: { upstream_inference_cost: 'NaN' } })).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
  });
});

describe('toLlmUsage bytes (pin)', () => {
  it('keeps the maximal usage key order and bytes', () => {
    const usage = toLlmUsage(
      {
        prompt_tokens: 900,
        completion_tokens: 300,
        total_tokens: 1200,
        prompt_tokens_details: { cached_tokens: 512, cache_write_tokens: 256, image_tokens: 0 },
        completion_tokens_details: { reasoning_tokens: 180 },
        cost: '0.0123',
        cost_details: { upstream_inference_cost: 0.0101 }
      },
      { costBasis: 'list' }
    );

    expect(Object.keys(usage ?? {})).toEqual(['promptTokens', 'completionTokens', 'totalTokens', 'cachedTokens', 'cacheWriteTokens', 'reasoningTokens', 'imageTokens', 'cost', 'costBasis', 'costDetails']);
    expect(JSON.stringify(usage)).toBe('{"promptTokens":900,"completionTokens":300,"totalTokens":1200,"cachedTokens":512,"cacheWriteTokens":256,"reasoningTokens":180,"imageTokens":0,"cost":0.0123,"costBasis":"list","costDetails":{"upstreamInferenceCost":0.0101}}');
  });

  it('keeps the minimal usage key order and bytes', () => {
    const usage = toLlmUsage({});

    expect(Object.keys(usage ?? {})).toEqual(['promptTokens', 'completionTokens', 'totalTokens']);
    expect(JSON.stringify(usage)).toBe('{"promptTokens":0,"completionTokens":0,"totalTokens":0}');
  });

  it('omits every wire null, never carrying a null or undefined key', () => {
    const usage = toLlmUsage(
      {
        prompt_tokens: null,
        completion_tokens: 5,
        total_tokens: null,
        prompt_tokens_details: { cached_tokens: null, cache_write_tokens: null, image_tokens: null },
        completion_tokens_details: { reasoning_tokens: null },
        cost: null,
        cost_details: { upstream_inference_cost: null }
      },
      { costBasis: null }
    );

    expect(Object.keys(usage ?? {})).toEqual(['promptTokens', 'completionTokens', 'totalTokens']);
    expect(JSON.stringify(usage)).toBe('{"promptTokens":0,"completionTokens":5,"totalTokens":0}');
  });
});

describe('toLlmUsage costBasis', () => {
  it('stamps a list basis beside a present cost, string or number', () => {
    expect(toLlmUsage({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: '0.00057555' }, { costBasis: 'list' })).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2, cost: 0.00057555, costBasis: 'list' });
    expect(toLlmUsage({ cost: 0.0003534 }, { costBasis: 'list' })?.costBasis).toBe('list');
  });

  it('stamps nothing when there is no figure, or the figure is unreadable', () => {
    expect(toLlmUsage({ prompt_tokens: 1 }, { costBasis: 'list' })).toEqual({ promptTokens: 1, completionTokens: 0, totalTokens: 0 });
    expect(toLlmUsage({ cost: 'n/a' }, { costBasis: 'list' })).not.toHaveProperty('costBasis');
  });

  it('stamps nothing without the option (the bill reading)', () => {
    expect(toLlmUsage({ cost: 0.001 })).not.toHaveProperty('costBasis');
    expect(toLlmUsage({ cost: 0.001 }, { costBasis: undefined })).not.toHaveProperty('costBasis');
  });
});
