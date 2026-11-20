import { describe, expect, it } from 'vitest';
import { makeLlmCallContext, noopLlmCallContext, type LlmCallProfile } from '../record/llm.call.context';
import { LLM_FAILED_ATTEMPT_TEXT_MAX_LENGTH, LLM_TIMEOUT_FINISH_REASON, LLM_TRANSPORT_FINISH_REASON, llmDecodeFailureTailExcerpt } from '../record/llm.decode.failure';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { LLM_REPLY_REPAIR_SCORE_PRECISION, toLlmCallAttemptPhase, toLlmCallPhases, toLlmDecodeFailureAttempt, toLlmDecodeRowShape, toLlmCallFailedAttempt, toLlmRepairedDecodeAttempt, makeLlmTimeoutResult, makeLlmTransportResult } from './llm.dispatch.outcome';
import { scoreLlmReplyJson } from '../reply/llm.reply.repair';
import { roundToPrecision } from '@dereekb/util';

function result(extra: Partial<LlmDispatchResult> = {}): LlmDispatchResult {
  return { text: '{"a":1', strategyId: 's', capability: 'cap', ...extra };
}

describe('toLlmDecodeFailureAttempt()', () => {
  it('should stamp a parse-error row with the scorer shape and the tail excerpt', () => {
    const text = `{"a":"${Array.from({ length: 150 }, (_, index) => `word${index}`).join(' ')}`;
    const row = toLlmDecodeFailureAttempt({ attempt: 1, failureClass: 'parse-error', result: result({ text, finishReason: 'stop', latencyMs: 9, usage: { completionTokens: 3 } as never }), maxOutputTokens: 100, shape: toLlmDecodeRowShape(scoreLlmReplyJson(text)) });

    expect(llmDecodeFailureTailExcerpt(text)).toBeDefined();
    expect(row).toMatchObject({ attempt: 1, class: 'parse-error', rawLength: text.length, finishReason: 'stop', completionTokens: 3, latencyMs: 9, maxOutputTokens: 100, tailExcerpt: llmDecodeFailureTailExcerpt(text) });
    expect(row.shape?.verdict).toBeDefined();
  });

  it('should keep a schema-validation row free of shape and tail, carrying the validator error, lever and transport error', () => {
    const row = toLlmDecodeFailureAttempt({ attempt: 2, failureClass: 'schema-validation', result: result({ text: '{"a":1}' }), validatorError: 'bad', lever: { lever: 'budget' }, transportError: 't', shape: { verdict: 'near-miss', score: 0.5 } });

    expect(row).toEqual({ attempt: 2, class: 'schema-validation', excerpt: '{"a":1}', rawLength: 7, validatorError: 'bad', lever: 'budget', transportError: 't' });
  });

  it('should round a parse-error row score to LLM_REPLY_REPAIR_SCORE_PRECISION (3) places through toLlmDecodeRowShape', () => {
    const text = '{"a": [1, 2, {"b": "unterminated';
    const row = toLlmDecodeFailureAttempt({ attempt: 1, failureClass: 'parse-error', result: result({ text }), shape: toLlmDecodeRowShape(scoreLlmReplyJson(text)) });

    expect(LLM_REPLY_REPAIR_SCORE_PRECISION).toBe(3);
    expect(row.shape?.score).toBe(roundToPrecision(scoreLlmReplyJson(text).score, 3));
    expect(String(row.shape?.score).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });
});

describe('toLlmRepairedDecodeAttempt()', () => {
  it('should build a parse-error row from the served reply stamped repaired + ops', () => {
    const row = toLlmRepairedDecodeAttempt({ attempt: 1, served: result(), summary: { tier: 'deterministic', attempt: 1, verdict: 'near-miss', score: 0.9, ops: { 'close-brace': 1 } as never } });

    expect(row).toMatchObject({ class: 'parse-error', repaired: 'deterministic', repairOps: { 'close-brace': 1 }, rawLength: 6 });
  });
});

describe('toLlmCallFailedAttempt()', () => {
  it('should keep the model bytes of a repaired reply, clipped past the cap', () => {
    const long = 'x'.repeat(LLM_FAILED_ATTEMPT_TEXT_MAX_LENGTH + 10);
    const row = toLlmCallFailedAttempt({ attempt: 1, cause: 'schema-validation', result: result({ text: '{}', repair: { tier: 'deterministic', attempt: 1, verdict: 'near-miss', score: 1, originalText: long } }), error: 'bad', maxOutputTokens: 10 });

    expect(row).toMatchObject({ attempt: 1, cause: 'schema-validation', error: 'bad', rawLength: long.length, clipped: true, maxOutputTokens: 10, strategyId: 's' });
    expect(row.text.length).toBeLessThan(long.length);
  });

  it('should keep a short reply whole and unclipped', () => {
    const row = toLlmCallFailedAttempt({ attempt: 1, cause: 'timeout', result: result({ text: '' }) });

    expect(row).toMatchObject({ text: '', rawLength: 0 });
    expect('clipped' in row).toBe(false);
  });
});

describe('decode and failed-attempt row bytes (pin)', () => {
  const longText = `{"a":"${Array.from({ length: 150 }, (_, index) => `word${index}`).join(' ')}`;

  it('keeps the maximal decode row key order and bytes', () => {
    const row = toLlmDecodeFailureAttempt({
      attempt: 3,
      failureClass: 'parse-error',
      result: result({ text: longText, finishReason: 'length', latencyMs: 41, usage: { promptTokens: 9, completionTokens: 7, totalTokens: 16 } }),
      maxOutputTokens: 256,
      shape: toLlmDecodeRowShape(scoreLlmReplyJson(longText)),
      validatorError: 'v',
      lever: { lever: 'budget' },
      transportError: 't',
      errorClassification: 'permanent'
    });

    expect(Object.keys(row)).toEqual(['attempt', 'class', 'excerpt', 'tailExcerpt', 'rawLength', 'shape', 'finishReason', 'completionTokens', 'latencyMs', 'maxOutputTokens', 'validatorError', 'lever', 'transportError', 'errorClassification']);
    expect(JSON.stringify({ ...row, excerpt: row.excerpt.length, tailExcerpt: row.tailExcerpt?.length })).toBe(
      '{"attempt":3,"class":"parse-error","excerpt":500,"tailExcerpt":200,"rawLength":1095,"shape":{"verdict":"truncated-looking","score":1},"finishReason":"length","completionTokens":7,"latencyMs":41,"maxOutputTokens":256,"validatorError":"v","lever":"budget","transportError":"t","errorClassification":"permanent"}'
    );
  });

  it('keeps the minimal decode row key order and bytes', () => {
    const row = toLlmDecodeFailureAttempt({ attempt: 1, failureClass: 'schema-validation', result: result({ text: '{"a":1}' }), maxOutputTokens: null, shape: null, validatorError: null, lever: null, transportError: null, errorClassification: null });

    expect(Object.keys(row)).toEqual(['attempt', 'class', 'excerpt', 'rawLength']);
    expect(JSON.stringify(row)).toBe(String.raw`{"attempt":1,"class":"schema-validation","excerpt":"{\"a\":1}","rawLength":7}`);
  });

  it('keeps the maximal failed-attempt row key order and bytes', () => {
    const long = 'x'.repeat(LLM_FAILED_ATTEMPT_TEXT_MAX_LENGTH + 10);
    const served = result({ text: '{}', strategyKind: 'k', model: 'm', provider: 'p', usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 }, latencyMs: 5, generationId: 'g', finishReason: 'stop', repair: { tier: 'deterministic', attempt: 1, verdict: 'near-miss', score: 1, originalText: long } });
    const row = toLlmCallFailedAttempt({ attempt: 2, cause: 'schema-validation', result: served, maxOutputTokens: 64, error: 'bad', errorClassification: 'permanent', correction: 'fix it', retry: { lever: 'budget', from: 'a', to: 'b', cause: 'c' } });

    expect(Object.keys(row)).toEqual(['attempt', 'cause', 'error', 'errorClassification', 'text', 'rawLength', 'clipped', 'strategyId', 'strategyKind', 'model', 'provider', 'usage', 'latencyMs', 'generationId', 'finishReason', 'repair', 'maxOutputTokens', 'correction', 'retry']);
    expect(JSON.stringify({ ...row, text: row.text.length })).toBe(
      '{"attempt":2,"cause":"schema-validation","error":"bad","errorClassification":"permanent","text":16,"rawLength":16010,"clipped":true,"strategyId":"s","strategyKind":"k","model":"m","provider":"p","usage":{"promptTokens":2,"completionTokens":1,"totalTokens":3},"latencyMs":5,"generationId":"g","finishReason":"stop","repair":{"tier":"deterministic","attempt":1,"verdict":"near-miss","score":1},"maxOutputTokens":64,"correction":"fix it","retry":{"lever":"budget","from":"a","to":"b","cause":"c"}}'
    );
  });

  it('keeps the minimal failed-attempt row key order and bytes', () => {
    const row = toLlmCallFailedAttempt({ attempt: 1, cause: 'timeout', result: result({ text: '' }), maxOutputTokens: null, error: null, errorClassification: null, correction: null, retry: null });

    expect(Object.keys(row)).toEqual(['attempt', 'cause', 'text', 'rawLength', 'strategyId']);
    expect(JSON.stringify(row)).toBe('{"attempt":1,"cause":"timeout","text":"","rawLength":0,"strategyId":"s"}');
  });
});

describe('toLlmCallAttemptPhase()', () => {
  it('should read the complete span as the wall time, 0 on a no-op context', async () => {
    const context = makeLlmCallContext({ label: 'attempt-1', timing: true });
    await context.timeAsync('complete', () => Promise.resolve());

    expect(toLlmCallAttemptPhase({ attempt: 1, attemptContext: context, result: result({ latencyMs: 5 }) })).toMatchObject({ attempt: 1, latencyMs: 5, wallMs: expect.any(Number) });
    expect(toLlmCallAttemptPhase({ attempt: 1, attemptContext: noopLlmCallContext(), result: result() })).toEqual({ attempt: 1, wallMs: 0 });
  });
});

describe('toLlmCallPhases()', () => {
  it('should fold the profile spans, attempt walls and prompt sizes', () => {
    const profile: LlmCallProfile = {
      label: 'cap',
      startedAt: 0,
      totalMs: 50,
      spans: [
        { name: 'render', startMs: 0, durationMs: 2 },
        { name: 'assemble', startMs: 2, durationMs: 3 }
      ],
      children: []
    };
    const phases = toLlmCallPhases({ profile, attemptPhases: [{ attempt: 1, wallMs: 20 }], request: { prompt: 'abcdef', cacheSegments: { cachePrefix: 'abc', volatileSuffix: 'def' } as never }, cachePrefixHash: 'h' });

    expect(phases).toEqual({ totalMs: 50, renderMs: 2, assembleMs: 3, completeMs: 20, attempts: [{ attempt: 1, wallMs: 20 }], promptChars: 6, cachePrefixChars: 3, cachePrefixHash: 'h' });
  });
});

describe('synthetic results', () => {
  it('should echo the capability and meta with the sentinel finish reasons', () => {
    expect(makeLlmTimeoutResult({ capability: 'cap', meta: { id: 1 } }, 's')).toEqual({ text: '', strategyId: 's', capability: 'cap', meta: { id: 1 }, finishReason: LLM_TIMEOUT_FINISH_REASON });
    expect(makeLlmTransportResult({ capability: 'cap' }, 's')).toEqual({ text: '', strategyId: 's', capability: 'cap', finishReason: LLM_TRANSPORT_FINISH_REASON });
  });
});
