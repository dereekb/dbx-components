/**
 * `llmCallTelemetry` — proves the uniform LLM-call telemetry block projects `strategyId` ALWAYS and every other field
 * ONLY when the producing result carried it (so a field-less result — an injected runner, a fake — stays byte-stable
 * when spread into a record), in one pinned key order.
 */

import { describe, it, expect } from 'vitest';
import type { LlmCompletion, LlmDispatchResult } from '../strategy/llm.strategy';
import { llmCallTelemetry } from './llm.call.telemetry';

const FLASH_MODEL = 'vendor/model-flash';
const STRONG_MODEL = 'vendor/model-pro';

describe('llmCallTelemetry', () => {
  it('returns ONLY strategyId for a bare (injected-runner) result', () => {
    const raw: LlmCompletion = { text: 'hi', strategyId: 'openrouter', capability: 'summarize', schemaEnforced: false };

    expect(llmCallTelemetry(raw)).toEqual({ strategyId: 'openrouter' });
  });

  it('includes model / usage / latencyMs when the result carries them', () => {
    const raw: LlmCompletion = { text: 'hi', strategyId: 'openrouter', capability: 'summarize', model: FLASH_MODEL, usage: { promptTokens: 1200, completionTokens: 300, totalTokens: 1500, cost: 0.00031 }, latencyMs: 842 };

    expect(llmCallTelemetry(raw)).toEqual({ strategyId: 'openrouter', model: FLASH_MODEL, usage: { promptTokens: 1200, completionTokens: 300, totalTokens: 1500, cost: 0.00031 }, latencyMs: 842 });
  });

  it('omits each cost/tier field independently when absent', () => {
    const raw: LlmCompletion = { text: 'hi', strategyId: 'openrouter', capability: 'summarize', model: STRONG_MODEL };

    const block = llmCallTelemetry(raw);

    expect(block).toEqual({ strategyId: 'openrouter', model: STRONG_MODEL });
    expect(block).not.toHaveProperty('usage');
    expect(block).not.toHaveProperty('latencyMs');
  });

  it('carries the upstream provider when the result reports one, and omits it otherwise (byte-stable)', () => {
    // Read-only routing evidence — no code branches on it. It is here because an endpoint's wire behaviour differs
    // (some silently ignore `reasoning.enabled: false`) and without it the record never says which one ran.
    const routed: LlmCompletion = { text: 'hi', strategyId: 'openrouter', capability: 'classify', model: FLASH_MODEL, provider: 'Fireworks' };
    const unrouted: LlmCompletion = { text: 'hi', strategyId: 'openai', capability: 'classify', model: 'flash' };

    expect(llmCallTelemetry(routed)).toEqual({ strategyId: 'openrouter', model: FLASH_MODEL, provider: 'Fireworks' });
    expect(llmCallTelemetry(unrouted)).not.toHaveProperty('provider');
  });

  it('passes through the generation id + finish reason when the result carries them, omitting them otherwise', () => {
    const withMeta: LlmCompletion = { text: 'hi', strategyId: 'openrouter', capability: 'summarize', model: 'anthropic/claude-sonnet-4.6', usage: { promptTokens: 1000, completionTokens: 200, totalTokens: 1200, cost: 0.0004, cachedTokens: 768 }, generationId: 'gen-abc123', finishReason: 'stop' };
    const withoutMeta: LlmCompletion = { text: 'hi', strategyId: 'openrouter', capability: 'summarize', model: FLASH_MODEL };

    // The cachedTokens ride through inside `usage` unchanged; the generation id + finish reason are surfaced.
    expect(llmCallTelemetry(withMeta)).toEqual({ strategyId: 'openrouter', model: 'anthropic/claude-sonnet-4.6', usage: { promptTokens: 1000, completionTokens: 200, totalTokens: 1200, cost: 0.0004, cachedTokens: 768 }, generationId: 'gen-abc123', finishReason: 'stop' });
    expect(llmCallTelemetry(withoutMeta)).not.toHaveProperty('generationId');
    expect(llmCallTelemetry(withoutMeta)).not.toHaveProperty('finishReason');
  });

  it('projects strategyKind when present and omits it otherwise', () => {
    expect(llmCallTelemetry({ text: 'hi', strategyId: 'account-a', strategyKind: 'openrouter-decisions', capability: 'summarize' })).toEqual({ strategyId: 'account-a', strategyKind: 'openrouter-decisions' });
    expect(llmCallTelemetry({ text: 'hi', strategyId: 'account-a', capability: 'summarize' })).not.toHaveProperty('strategyKind');
  });

  it('projects the BOUNDED repair summary: never the original text, ops omitted when absent', () => {
    const repaired: LlmDispatchResult = { text: '{"a":1}', strategyId: 'openrouter', capability: 'summarize', repair: { tier: 'fast-fix', attempt: 1, verdict: 'repairable', score: 0.8, originalText: '{"a":1' } };
    const withOps: LlmDispatchResult = { ...repaired, repair: { tier: 'deterministic', attempt: 2, verdict: 'repairable', score: 0.9, ops: { closeBrace: 1 }, originalText: '{"a":1' } };

    expect(llmCallTelemetry(repaired).repair).toEqual({ tier: 'fast-fix', attempt: 1, verdict: 'repairable', score: 0.8 });
    expect(llmCallTelemetry(repaired).repair).not.toHaveProperty('ops');
    expect(llmCallTelemetry(withOps).repair).toEqual({ tier: 'deterministic', attempt: 2, verdict: 'repairable', score: 0.9, ops: { closeBrace: 1 } });
  });

  it('keeps the fixer meta on the repair summary, after ops, and is byte-identical without it', () => {
    const withMeta: LlmDispatchResult = { text: '{"a":1}', strategyId: 'openrouter', capability: 'summarize', repair: { tier: 'fast-fix', attempt: 1, verdict: 'mangled', score: 0.8, meta: { callId: 'fix-1' }, originalText: '{"a":None}' } };
    const withoutMeta: LlmDispatchResult = { ...withMeta, repair: { tier: 'fast-fix', attempt: 1, verdict: 'mangled', score: 0.8, originalText: '{"a":None}' } };

    expect(JSON.stringify(llmCallTelemetry(withMeta).repair)).toBe('{"tier":"fast-fix","attempt":1,"verdict":"mangled","score":0.8,"meta":{"callId":"fix-1"}}');
    expect(JSON.stringify(llmCallTelemetry(withoutMeta).repair)).toBe('{"tier":"fast-fix","attempt":1,"verdict":"mangled","score":0.8}');
  });

  it('pins the full key order on a result carrying every field', () => {
    const full: LlmDispatchResult = {
      repair: { tier: 'deterministic', attempt: 1, verdict: 'repairable', score: 0.9, originalText: '{' },
      finishReason: 'stop',
      generationId: 'gen-1',
      latencyMs: 10,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      provider: 'Fireworks',
      model: FLASH_MODEL,
      strategyKind: 'openrouter-decisions',
      strategyId: 'openrouter',
      capability: 'summarize',
      text: '{}'
    };

    expect(Object.keys(llmCallTelemetry(full))).toEqual(['strategyId', 'strategyKind', 'model', 'provider', 'usage', 'latencyMs', 'generationId', 'finishReason', 'repair']);
  });
});
