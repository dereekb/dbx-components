import { llmNoulQuestion } from '@dereekb/llm/decision';
import { afterEach, describe, expect, it } from 'vitest';
import { fakeOpenRouterDecisionClient, fakeOpenRouterHangUntilAborted } from '../test/openrouter.fake';
import { sendOpenRouterResponsesRequest } from './openrouter.call';
import { openRouterDecisionRequest } from './openrouter.decision';
import { openRouterDecision } from './openrouter.decision.call';
import { openRouterRequestOptionsWithTimeout } from './openrouter.timeout';
import { OPENROUTER_JEV_1_13_MODEL_ID } from './openrouter.type';

const QUESTIONS = {
  fits: llmNoulQuestion('At least one row means what `phrase` describes.')
};

/**
 * Waits for the signal to abort, failing the spec if it does not within the limit.
 *
 * @param signal - The signal to wait on.
 * @param limitMs - How long to wait before failing.
 * @returns The abort reason.
 */
function waitForAbort(signal: AbortSignal, limitMs = 2000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('signal did not abort')), limitMs);

    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve(signal.reason);
      },
      { once: true }
    );
  });
}

describe('openRouterRequestOptionsWithTimeout()', () => {
  it('should leave the options alone when no timeout is set', () => {
    const controller = new AbortController();
    const result = openRouterRequestOptionsWithTimeout({ signal: controller.signal });

    expect(result.signal).toBe(controller.signal);
    expect(result.timeoutMs).toBeUndefined();
  });

  it('should pass the timeout to the SDK when the caller passed no signal', () => {
    const result = openRouterRequestOptionsWithTimeout({ retryCodes: ['5XX'] }, 1000);

    expect(result.timeoutMs).toBe(1000);
    expect(result.signal).toBeUndefined();
    expect(result.retryCodes).toEqual(['5XX']);
  });

  it('should prefer the config timeout over the caller timeout', () => {
    const result = openRouterRequestOptionsWithTimeout({ timeoutMs: 5000 }, 1000);
    expect(result.timeoutMs).toBe(1000);
  });

  it('should use the caller timeout when the config sets none', () => {
    const result = openRouterRequestOptionsWithTimeout({ timeoutMs: 5000 }, undefined);
    expect(result.timeoutMs).toBe(5000);
  });

  describe('with a caller signal', () => {
    it('should replace the signal with a merged one and drop timeoutMs', () => {
      const controller = new AbortController();
      const result = openRouterRequestOptionsWithTimeout({ signal: controller.signal, timeoutMs: 5000 }, 1000);

      expect(result.signal).toBeDefined();
      expect(result.signal).not.toBe(controller.signal);
      expect(result.timeoutMs).toBeUndefined();
    });

    it('should abort when the timeout elapses', async () => {
      const controller = new AbortController();
      const result = openRouterRequestOptionsWithTimeout({ signal: controller.signal }, 20);
      const reason = await waitForAbort(result.signal as AbortSignal);

      expect((reason as Error).name).toBe('TimeoutError');
      expect(controller.signal.aborted).toBe(false);
    });

    it('should abort when the caller aborts', async () => {
      const controller = new AbortController();
      const result = openRouterRequestOptionsWithTimeout({ signal: controller.signal }, 60000);
      const abort = waitForAbort(result.signal as AbortSignal);

      controller.abort();
      const reason = await abort;

      expect((reason as Error).name).toBe('AbortError');
    });

    it('should treat a deprecated fetchOptions signal as the caller signal', async () => {
      const controller = new AbortController();
      const result = openRouterRequestOptionsWithTimeout({ fetchOptions: { signal: controller.signal } }, 20);

      expect(result.timeoutMs).toBeUndefined();
      const reason = await waitForAbort(result.signal as AbortSignal);
      expect((reason as Error).name).toBe('TimeoutError');
    });

    describe('without AbortSignal.any', () => {
      const abortSignalAny = AbortSignal.any;

      afterEach(() => {
        AbortSignal.any = abortSignalAny;
      });

      it('should still abort at the timeout through the merge fallback', async () => {
        (AbortSignal as { any?: unknown }).any = undefined;
        const controller = new AbortController();
        const result = openRouterRequestOptionsWithTimeout({ signal: controller.signal }, 20);
        const reason = await waitForAbort(result.signal as AbortSignal);

        expect((reason as Error).name).toBe('TimeoutError');
        expect(controller.signal.aborted).toBe(false);
      });
    });
  });
});

describe('openRouterDecision() timeouts', () => {
  const request = openRouterDecisionRequest({ state: 'x', questions: QUESTIONS, overrides: { model: OPENROUTER_JEV_1_13_MODEL_ID, requestTimeoutMs: 50 } });

  it('should time out a hung request', async () => {
    const fake = fakeOpenRouterDecisionClient(fakeOpenRouterHangUntilAborted);
    await expect(openRouterDecision({ client: fake.client, request })).rejects.toThrow(/timed out/);
  });

  it('should still time out a hung request when the caller passes a signal', async () => {
    const fake = fakeOpenRouterDecisionClient(fakeOpenRouterHangUntilAborted);
    const controller = new AbortController();

    await expect(openRouterDecision({ client: fake.client, request, options: { signal: controller.signal } })).rejects.toThrow(/timed out/);
    expect(controller.signal.aborted).toBe(false);
  });

  it('should abort a hung request when the caller aborts', async () => {
    const fake = fakeOpenRouterDecisionClient(fakeOpenRouterHangUntilAborted);
    const controller = new AbortController();
    const longRequest = openRouterDecisionRequest({ state: 'x', questions: QUESTIONS, overrides: { model: OPENROUTER_JEV_1_13_MODEL_ID, requestTimeoutMs: 60000 } });
    const call = openRouterDecision({ client: fake.client, request: longRequest, options: { signal: controller.signal } });

    setTimeout(() => controller.abort(), 20);

    await expect(call).rejects.toThrow(/aborted/);
  });
});

describe('sendOpenRouterResponsesRequest() timeouts', () => {
  it('should still time out a hung request when the caller passes a signal', async () => {
    const fake = fakeOpenRouterDecisionClient(fakeOpenRouterHangUntilAborted);
    const controller = new AbortController();
    const request = { config: { model: 'openai/gpt-5.1', requestTimeoutMs: 50 }, input: [] };

    await expect(sendOpenRouterResponsesRequest({ client: fake.client, request, options: { signal: controller.signal } })).rejects.toThrow(/timed out/);
    expect(fake.requests[0].url).toBe('https://openrouter.ai/api/v1/responses');
  });
});
