import { describe, expect, it, vi } from 'vitest';
import { type LlmCallContext, makeLlmCallContext } from '../record/llm.call.context';
import { LLM_TIMEOUT_FINISH_REASON, LLM_TRANSPORT_FINISH_REASON, LLM_UNRETRYABLE_FINISH_REASON } from '../record/llm.decode.failure';
import { type LlmCompletion, type LlmDispatchResult, type LlmRequest, type LlmStrategy } from '../strategy/llm.strategy';
import { DEFAULT_LLM_REPLY_FAST_FIX_LIMITS, type LlmReplyFastFixOutcome } from '../reply/llm.reply.fast.fix';
import { DEFAULT_LLM_REPLY_ENVELOPE_KEYS } from '../reply/llm.reply.envelope';
import { scoreLlmReplyJson } from '../reply/llm.reply.repair';
import { isDegenerateLlmReplyReading, type LlmBoundReplyFastFix, makeLlmBoundReplyFastFix, readLlmDispatchReply, type LlmReplyRepairRefusal, runLlmReplyRepairLane, sendLlmDispatchAttempt, validateLlmDispatchValue } from './llm.dispatch.attempt';
import { toLlmDecodeRowShape } from './llm.dispatch.outcome';

class APIUserAbortError extends Error {}

const REQUEST: LlmRequest = { prompt: 'p', capability: 'cap' };

function strategyOf(complete: () => Promise<LlmCompletion>): LlmStrategy {
  return { id: 's', describe: 'test', caching: 'none', complete };
}

function served(text: string, finishReason = 'stop'): LlmDispatchResult {
  return { text, strategyId: 's', capability: 'cap', finishReason };
}

function refusalOf(context: LlmCallContext): unknown {
  return context.profile().diags?.find((diag) => diag.code === 'reply-repair-refused')?.fields?.['reason'];
}

describe('sendLlmDispatchAttempt()', () => {
  it('should complete inside an attempt-N child with a complete span', async () => {
    const callContext = makeLlmCallContext({ label: 'cap', timing: true });
    const sent = await sendLlmDispatchAttempt({ strategy: strategyOf(() => Promise.resolve(served('ok'))), request: REQUEST, attempt: 2, callContext });

    expect(sent.result.text).toBe('ok');
    expect(sent.fault).toBeUndefined();
    expect(callContext.profile().children[0].label).toBe('attempt-2');
    expect(sent.attemptContext.profile().spans.map((span) => span.name)).toEqual(['complete']);
  });

  it('should read an error that is both abort-shaped and retryable as a timeout (abort tested first)', async () => {
    const error = Object.assign(new APIUserAbortError('aborted'), { status: 429 });
    const sent = await sendLlmDispatchAttempt({ strategy: strategyOf(() => Promise.reject(error)), request: REQUEST, attempt: 1, callContext: makeLlmCallContext({ label: 'cap' }) });

    expect(sent).toMatchObject({ fault: 'timeout', error, result: { text: '', finishReason: LLM_TIMEOUT_FINISH_REASON } });
  });

  it('should read a retryable error as a transport fault with its summary', async () => {
    const error = Object.assign(new Error('rate limited'), { status: 429 });
    const sent = await sendLlmDispatchAttempt({ strategy: strategyOf(() => Promise.reject(error)), request: REQUEST, attempt: 1, callContext: makeLlmCallContext({ label: 'cap' }) });

    expect(sent).toMatchObject({ fault: 'transport', transportError: expect.any(String), result: { finishReason: LLM_TRANSPORT_FINISH_REASON } });
  });

  describe('the unretryable fault', () => {
    async function sendThrowing(error: unknown, isRetryableUnknownError?: (error: unknown) => boolean | undefined) {
      return sendLlmDispatchAttempt({ strategy: strategyOf(() => Promise.reject(error)), request: REQUEST, attempt: 1, callContext: makeLlmCallContext({ label: 'cap' }), isRetryableUnknownError });
    }

    it('should read an abort as a timeout with no classification', async () => {
      const sent = await sendThrowing(new DOMException('stop', 'AbortError'));
      expect(sent.fault).toBe('timeout');
      expect(sent.classification).toBeUndefined();
    });

    it('should read a 503 as a transient transport fault', async () => {
      const sent = await sendThrowing(Object.assign(new Error('x'), { status: 503 }));
      expect(sent).toMatchObject({ fault: 'transport', classification: 'transient', transportError: 'Error 503: x' });
    });

    it('should read a 401 as a permanent unretryable fault without asking the host', async () => {
      const isRetryableUnknownError = vi.fn(() => true);
      const sent = await sendThrowing(Object.assign(new Error('x'), { status: 401 }), isRetryableUnknownError);
      expect(sent).toMatchObject({ fault: 'unretryable', classification: 'permanent', result: { finishReason: LLM_UNRETRYABLE_FINISH_REASON } });
      expect(isRetryableUnknownError).not.toHaveBeenCalled();
    });

    it('should read an unknown error as unretryable unless the host answers true', async () => {
      const error = new Error('boom');
      expect(await sendThrowing(error)).toMatchObject({ fault: 'unretryable', classification: 'unknown', error });
      expect(await sendThrowing(error, () => false)).toMatchObject({ fault: 'unretryable', classification: 'unknown' });
      expect(await sendThrowing(error, () => undefined)).toMatchObject({ fault: 'unretryable', classification: 'unknown' });
      expect(await sendThrowing(error, () => true)).toMatchObject({ fault: 'transport', classification: 'unknown', result: { finishReason: LLM_TRANSPORT_FINISH_REASON } });
    });
  });
});

describe('readLlmDispatchReply()', () => {
  it('should read json as the value, and json-envelope through the envelope keys', () => {
    expect(readLlmDispatchReply('{"answerable":false}', { protocol: 'json' }).kind).toBe('value');
    expect(readLlmDispatchReply('{"answerable":false}', { protocol: 'json-envelope' }).kind).toBe('declined');
    expect(readLlmDispatchReply('{"ok":false}', { protocol: 'json-envelope', envelope: { value: 'lever', answerable: 'ok', rationale: 'why' } }).kind).toBe('declined');
  });

  it('should flag no-json and parse-error readings as degenerate', () => {
    expect(isDegenerateLlmReplyReading(readLlmDispatchReply('prose', { protocol: 'json' }))).toBe(true);
    expect(isDegenerateLlmReplyReading(readLlmDispatchReply('{"a":', { protocol: 'json' }))).toBe(true);
    expect(isDegenerateLlmReplyReading(readLlmDispatchReply('{"a":1}', { protocol: 'json' }))).toBe(false);
  });
});

describe('runLlmReplyRepairLane()', () => {
  const read = (text: string) => readLlmDispatchReply(text, { protocol: 'json' });

  async function laneOf(text: string, finishReason = 'stop', unrepairedRefusal: LlmReplyRepairRefusal = 'mangled') {
    const attemptContext = makeLlmCallContext({ label: 'attempt-1', timing: true });
    const lane = await runLlmReplyRepairLane({ served: served(text, finishReason), attempt: 1, attemptContext, read, envelope: undefined, unrepairedRefusal, fastFixLimits: DEFAULT_LLM_REPLY_FAST_FIX_LIMITS });
    return { lane, attemptContext };
  }

  it('should leave a prose-led reply untouched and file nothing', async () => {
    const { lane, attemptContext } = await laneOf('Sure: {"a":1,}');

    expect(lane.repaired).toBeUndefined();
    expect(attemptContext.profile().diags ?? []).toHaveLength(0);
  });

  it('should refuse an object-led reply that did not stop cleanly', async () => {
    const { lane, attemptContext } = await laneOf('{"a":1,}', 'length');

    expect(lane.repaired).toBeUndefined();
    expect(refusalOf(attemptContext)).toBe('unclean-finish');
  });

  it('should repair a near-miss, substituting the text and keeping the model bytes', async () => {
    const { lane, attemptContext } = await laneOf('{"a":[1,2,],}');

    expect(lane.repaired?.result.text).toBe('{"a":[1,2]}');
    expect(lane.repaired?.result.repair).toMatchObject({ tier: 'deterministic', attempt: 1, originalText: '{"a":[1,2,],}' });
    expect(lane.repaired?.reading.kind).toBe('value');
    expect(attemptContext.profile().diags?.[0]).toMatchObject({ code: 'reply-repaired', fields: { ops: 'drop-trailing-comma:2' } });
  });

  it('should refuse with the unrepaired refusal when no fast fix is bound', async () => {
    const mangled = '{"a":"a long enough value here","b":None}';

    expect(refusalOf((await laneOf(mangled, 'stop', 'mangled')).attemptContext)).toBe('mangled');
    expect(refusalOf((await laneOf(mangled, 'stop', 'fast-fix-off')).attemptContext)).toBe('fast-fix-off');
  });

  it('should return the rounded reading on a refused pass, the same bytes its refusal diag carries', async () => {
    const mangled = '{"a":"a long enough value here","b":None}';
    const { lane, attemptContext } = await laneOf(mangled);
    const shape = toLlmDecodeRowShape(scoreLlmReplyJson(mangled));

    expect(lane.repaired).toBeUndefined();
    expect(lane.shape).toEqual(shape);
    expect(attemptContext.profile().diags?.[0]?.fields).toMatchObject({ verdict: shape.verdict, score: shape.score, reason: 'mangled' });
  });
});

describe('runLlmReplyRepairLane() fast-fix tier', () => {
  const MANGLED = '{"a":"a long enough value here","b":None}';
  const read = (text: string) => readLlmDispatchReply(text, { protocol: 'json' });

  async function fastLaneOf(config: { readonly text?: string; readonly fastFix?: LlmBoundReplyFastFix; readonly fastFixSpent?: boolean; readonly maxChars?: number; readonly minScore?: number }) {
    const swallows: string[] = [];
    const attemptContext = makeLlmCallContext({ label: 'attempt-1', timing: true, onSwallow: (site) => void swallows.push(site) });
    const lane = await runLlmReplyRepairLane({
      served: served(config.text ?? MANGLED),
      attempt: 1,
      attemptContext,
      read,
      envelope: undefined,
      unrepairedRefusal: 'no-schema',
      fastFix: config.fastFix,
      fastFixSpent: config.fastFixSpent,
      fastFixLimits: { maxChars: config.maxChars ?? 16_000, minScore: config.minScore ?? 0.5 }
    });
    return { lane, attemptContext, swallows };
  }

  const fixed =
    (meta?: object): LlmBoundReplyFastFix =>
    () =>
      Promise.resolve<LlmReplyFastFixOutcome>({ kind: 'fixed', value: { a: 'a long enough value here', b: null }, text: '{"a":"a long enough value here","b":null}', ...(meta == null ? {} : { meta }) });

  it('should refuse with the unrepaired refusal when unbound, and with fast-fix-spent / too-long / low-score when gated', async () => {
    expect(refusalOf((await fastLaneOf({})).attemptContext)).toBe('no-schema');
    expect(refusalOf((await fastLaneOf({ fastFix: fixed(), fastFixSpent: true })).attemptContext)).toBe('fast-fix-spent');
    expect(refusalOf((await fastLaneOf({ fastFix: fixed(), maxChars: 10 })).attemptContext)).toBe('too-long');
    expect(refusalOf((await fastLaneOf({ fastFix: fixed(), minScore: 0.99 })).attemptContext)).toBe('low-score');
    expect((await fastLaneOf({ fastFix: fixed(), maxChars: 10 })).lane.fastFixCalled).toBe(false);
  });

  it('should substitute a fixed reply with its summary, meta and diag', async () => {
    const { lane, attemptContext } = await fastLaneOf({ fastFix: fixed({ fixCallId: 'f1' }) });

    expect(lane.fastFixCalled).toBe(true);
    expect(lane.repaired?.reading.kind).toBe('value');
    expect(lane.repaired?.summary).toMatchObject({ tier: 'fast-fix', attempt: 1, verdict: 'mangled', meta: { fixCallId: 'f1' } });
    expect(lane.repaired?.result.repair).toMatchObject({ tier: 'fast-fix', originalText: MANGLED });
    expect(attemptContext.profile().diags?.[0]).toMatchObject({ level: 'info', code: 'reply-repaired', fields: { tier: 'fast-fix', verdict: 'mangled' } });
    expect(attemptContext.profile().spans.map((span) => span.name)).toEqual(['fast-fix']);
  });

  it('should report a miss with a warn diag, and a thrown fixer as a swallowed error miss', async () => {
    const missed = await fastLaneOf({ fastFix: () => Promise.resolve({ kind: 'missed', reason: 'fidelity' }) });

    expect(missed.lane).toEqual({ fastFixCalled: true, fastFixMiss: 'fidelity', shape: toLlmDecodeRowShape(scoreLlmReplyJson(MANGLED)) });
    expect(missed.attemptContext.profile().diags?.[0]).toMatchObject({ level: 'warn', code: 'reply-fast-fix-miss', fields: { reason: 'fidelity' } });

    const thrown = await fastLaneOf({ fastFix: () => Promise.reject(new Error('boom')) });

    expect(thrown.lane).toEqual({ fastFixCalled: true, fastFixMiss: 'error', shape: toLlmDecodeRowShape(scoreLlmReplyJson(MANGLED)) });
    expect(thrown.swallows).toEqual(['llm/reply-repair.fast-fix']);
  });
});

describe('makeLlmBoundReplyFastFix()', () => {
  const renderLiveContext = () => [];
  const dispatch = () => Promise.resolve(served('{}'));
  const fixer = (input: unknown) => Promise.resolve<LlmReplyFastFixOutcome>({ kind: 'missed', reason: 'unusable', meta: { input } });

  it('should never bind on the repair capability, on a line call or without a fixer', () => {
    expect(makeLlmBoundReplyFastFix({ replyFastFix: fixer, request: { capability: 'RepairReplyJson', renderLiveContext }, protocol: 'json', schemaHint: {}, envelope: undefined, dispatch })).toEqual({ fastFixUnavailable: 'fast-fix-off' });
    expect(makeLlmBoundReplyFastFix({ replyFastFix: fixer, request: { capability: 'cap', renderLiveContext }, protocol: 'line', schemaHint: {}, envelope: undefined, dispatch })).toEqual({ fastFixUnavailable: 'fast-fix-off' });
    expect(makeLlmBoundReplyFastFix({ request: { capability: 'cap', renderLiveContext }, protocol: 'json', schemaHint: {}, envelope: undefined, dispatch })).toEqual({ fastFixUnavailable: 'fast-fix-off' });
  });

  it('should refuse as no-schema when eligible without a schema hint', () => {
    expect(makeLlmBoundReplyFastFix({ replyFastFix: fixer, request: { capability: 'cap', renderLiveContext }, protocol: 'json', envelope: undefined, dispatch })).toEqual({ fastFixUnavailable: 'no-schema' });
  });

  it('should pass the request, subject capability, subject envelope, schema hint and dispatch to a bound fixer', async () => {
    const request = { capability: 'cap', renderLiveContext };
    const schemaHint = { type: 'object' };
    const { fastFix } = makeLlmBoundReplyFastFix({ replyFastFix: fixer, request, protocol: 'json-envelope', schemaHint, envelope: DEFAULT_LLM_REPLY_ENVELOPE_KEYS, dispatch });
    const outcome = await fastFix?.({ text: 't', shape: {} as never, attempt: 2, callContext: makeLlmCallContext({ label: 'a' }) });

    expect(outcome?.meta).toMatchObject({ input: { request, subjectCapability: 'cap', subjectEnvelope: DEFAULT_LLM_REPLY_ENVELOPE_KEYS, schemaHint, dispatch, text: 't', attempt: 2 } });
  });
});

describe('validateLlmDispatchValue()', () => {
  it('should accept every value with no validator, and time a validator', () => {
    const attemptContext = makeLlmCallContext({ label: 'attempt-1', timing: true });

    expect(validateLlmDispatchValue({ value: {}, attemptContext })).toBe(true);
    expect(validateLlmDispatchValue({ validate: () => ({ error: 'bad' }), value: {}, attemptContext })).toEqual({ error: 'bad' });
    expect(attemptContext.profile().spans.map((span) => span.name)).toEqual(['validate']);
  });
});
