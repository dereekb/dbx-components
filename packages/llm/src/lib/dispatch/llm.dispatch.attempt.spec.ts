import { describe, expect, it } from 'vitest';
import { type LlmCallContext, makeLlmCallContext } from '../record/llm.call.context';
import { LLM_TIMEOUT_FINISH_REASON, LLM_TRANSPORT_FINISH_REASON } from '../record/llm.decode.failure';
import { type LlmCompletion, type LlmDispatchResult, type LlmRequest, type LlmStrategy } from '../strategy/llm.strategy';
import { isDegenerateLlmReplyReading, readLlmDispatchReply, type LlmReplyRepairRefusal, runLlmReplyRepairLane, sendLlmDispatchAttempt, validateLlmDispatchLever } from './llm.dispatch.attempt';

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

  it('should rethrow any other error', async () => {
    await expect(sendLlmDispatchAttempt({ strategy: strategyOf(() => Promise.reject(new Error('503'))), request: REQUEST, attempt: 1, callContext: makeLlmCallContext({ label: 'cap' }) })).rejects.toThrow('503');
  });
});

describe('readLlmDispatchReply()', () => {
  it('should read json as the lever, and json-envelope through the envelope keys', () => {
    expect(readLlmDispatchReply('{"answerable":false}', { protocol: 'json' }).kind).toBe('lever');
    expect(readLlmDispatchReply('{"answerable":false}', { protocol: 'json-envelope' }).kind).toBe('declined');
    expect(readLlmDispatchReply('{"ok":false}', { protocol: 'json-envelope', envelope: { lever: 'lever', answerable: 'ok', rationale: 'why' } }).kind).toBe('declined');
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
    const lane = await runLlmReplyRepairLane({ served: served(text, finishReason), attempt: 1, attemptContext, read, unrepairedRefusal });
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
    expect(lane.repaired?.reading.kind).toBe('lever');
    expect(attemptContext.profile().diags?.[0]).toMatchObject({ code: 'reply-repaired', fields: { ops: 'drop-trailing-comma:2' } });
  });

  it('should refuse a mangled reply with the unrepaired refusal reason', async () => {
    const mangled = '{"a":"a long enough value here","b":None}';

    expect(refusalOf((await laneOf(mangled, 'stop', 'mangled')).attemptContext)).toBe('mangled');
    expect(refusalOf((await laneOf(mangled, 'stop', 'fast-fix-off')).attemptContext)).toBe('fast-fix-off');
  });
});

describe('validateLlmDispatchLever()', () => {
  it('should accept every lever with no validator, and time a validator', () => {
    const attemptContext = makeLlmCallContext({ label: 'attempt-1', timing: true });

    expect(validateLlmDispatchLever({ lever: {}, attemptContext })).toBe(true);
    expect(validateLlmDispatchLever({ validate: () => ({ error: 'bad' }), lever: {}, attemptContext })).toEqual({ error: 'bad' });
    expect(attemptContext.profile().spans.map((span) => span.name)).toEqual(['validate']);
  });
});
