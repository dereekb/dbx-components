import { describe, expect, it } from 'vitest';
import { RateLimitError } from 'openai';
import { makeLlmCallContext } from '../record/llm.call.context';
import { LLM_TRANSPORT_RETRY_AFTER_MAX_MS, LLM_TRANSPORT_RETRY_MAX_DELAY_MS, type LlmDispatchPauseSignal, mergeLlmDispatchSignals, llmTransportBackoffMs, parkLlmDispatchWhilePaused } from './llm.dispatch.control';

function gate(paused: boolean): LlmDispatchPauseSignal & { readonly resume: () => void } {
  let resolveWait: () => void = () => undefined;
  let isPaused = paused;
  return {
    isPaused: () => isPaused,
    waitUntilResumed: () =>
      new Promise<void>((resolve) => {
        resolveWait = resolve;
      }),
    resume: () => {
      isPaused = false;
      resolveWait();
    }
  };
}

describe('parkLlmDispatchWhilePaused()', () => {
  it('should not park, and record no span, when not paused', async () => {
    const callContext = makeLlmCallContext({ label: 'call', timing: true });

    expect(await parkLlmDispatchWhilePaused({ pause: gate(false), callContext })).toBe(false);
    expect(await parkLlmDispatchWhilePaused({ callContext })).toBe(false);
    expect(callContext.profile().spans).toHaveLength(0);
  });

  it('should park until resumed and record a paused span', async () => {
    const callContext = makeLlmCallContext({ label: 'call', timing: true });
    const pause = gate(true);
    const parked = parkLlmDispatchWhilePaused({ pause, callContext });
    pause.resume();

    expect(await parked).toBe(true);
    expect(callContext.profile().spans.map((span) => span.name)).toEqual(['paused']);
  });

  it('should end the park on abort even when the gate ignores the signal', async () => {
    const callContext = makeLlmCallContext({ label: 'call' });
    const controller = new AbortController();
    const parked = parkLlmDispatchWhilePaused({ pause: gate(true), signal: controller.signal, callContext });
    controller.abort();

    expect(await parked).toBe(true);
  });

  it('should read a gate rejection on an aborted signal as an ended park, and propagate any other rejection', async () => {
    const callContext = makeLlmCallContext({ label: 'call' });
    const controller = new AbortController();
    const rejecting: LlmDispatchPauseSignal = { isPaused: () => true, waitUntilResumed: () => (controller.abort(), Promise.reject(new Error('aborted'))) };

    expect(await parkLlmDispatchWhilePaused({ pause: rejecting, signal: controller.signal, callContext })).toBe(true);
    await expect(parkLlmDispatchWhilePaused({ pause: { isPaused: () => true, waitUntilResumed: () => Promise.reject(new Error('broken')) }, signal: new AbortController().signal, callContext })).rejects.toThrow('broken');
  });
});

describe('mergeLlmDispatchSignals()', () => {
  it('should return whichever signal exists, or none', () => {
    const signal = new AbortController().signal;

    expect(mergeLlmDispatchSignals({ request: {} })).toBeUndefined();
    expect(mergeLlmDispatchSignals({ cancellationSignal: signal, request: {} })).toBe(signal);
    expect(mergeLlmDispatchSignals({ request: { signal } })).toBe(signal);
  });

  it('should combine both signals so either aborts the forwarded one', () => {
    for (const which of ['dispatcher', 'request'] as const) {
      const dispatcher = new AbortController();
      const requestController = new AbortController();
      const combined = mergeLlmDispatchSignals({ cancellationSignal: dispatcher.signal, request: { signal: requestController.signal } });

      expect(combined?.aborted).toBe(false);
      (which === 'dispatcher' ? dispatcher : requestController).abort();
      expect(combined?.aborted).toBe(true);
    }
  });
});

describe('llmTransportBackoffMs()', () => {
  it('should half-jitter an exponential step capped at the max', () => {
    expect(llmTransportBackoffMs({ attempt: 1, error: undefined }, () => 0)).toBe(250);
    expect(llmTransportBackoffMs({ attempt: 1, error: undefined }, () => 1)).toBe(500);
    expect(llmTransportBackoffMs({ attempt: 2, error: undefined }, () => 1)).toBe(1000);
    expect(llmTransportBackoffMs({ attempt: 20, error: undefined }, () => 1)).toBe(LLM_TRANSPORT_RETRY_MAX_DELAY_MS);
    expect(llmTransportBackoffMs({ attempt: 20, error: undefined }, () => 0)).toBe(4000);
  });

  it('should honor a Retry-After the error carries', () => {
    expect(llmTransportBackoffMs({ attempt: 1, error: { headers: new Headers({ 'retry-after': '2' }) } }, () => 1)).toBe(2000);
  });

  it('should prefer retry-after-ms over Retry-After', () => {
    expect(llmTransportBackoffMs({ attempt: 1, error: { headers: new Headers({ 'retry-after': '2', 'retry-after-ms': '1500' }) } }, () => 1)).toBe(1500);
  });

  it('should honor an HTTP-date Retry-After', () => {
    const at = new Date(Date.now() + 30_000).toUTCString();
    const wait = llmTransportBackoffMs({ attempt: 1, error: { headers: { 'Retry-After': at } } }, () => 1);
    expect(wait).toBeGreaterThan(25_000);
    expect(wait).toBeLessThanOrEqual(30_000);
  });

  it('should fall back to the exponential step when the server asks for more than LLM_TRANSPORT_RETRY_AFTER_MAX_MS', () => {
    expect(LLM_TRANSPORT_RETRY_AFTER_MAX_MS).toBe(60_000);
    expect(llmTransportBackoffMs({ attempt: 1, error: { headers: new Headers({ 'retry-after': '120' }) } }, () => 1)).toBe(500);
  });

  it('should read a real openai RateLimitError', () => {
    const error = new RateLimitError(429, { message: 'rate limited' }, undefined, new Headers({ 'retry-after': '1' }));
    expect(llmTransportBackoffMs({ attempt: 1, error }, () => 1)).toBe(1000);
  });
});
