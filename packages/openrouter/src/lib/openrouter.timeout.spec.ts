import { llmNoulQuestion } from '@dereekb/llm/decision';
import { type PartialWithUndefined } from '@dereekb/util';
import { afterEach, describe, expect, it } from 'vitest';
import { fakeOpenRouterDecisionClient, fakeOpenRouterHangUntilAborted } from '../test/openrouter.fake';
import { callModelForOpenRouterRequest, sendOpenRouterResponsesRequest } from './openrouter.call';
import { openRouterDecisionRequest } from './openrouter.decision';
import { openRouterDecision } from './openrouter.decision.call';
import { openRouterEmbeddings } from './openrouter.embedding';
import { openRouterGeneration, openRouterGenerationContent } from './openrouter.generation';
import { type RequestOptions } from './openrouter.sdk';
import { DEFAULT_OPENROUTER_REQUEST_RETRIES, openRouterRequestOptions, openRouterRequestOptionsWithTimeout } from './openrouter.timeout';
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

/**
 * A fast SDK backoff, so that a client whose own retry stays on retries in milliseconds and a regression fails fast
 * instead of retrying for the SDK's default hour.
 */
const FAST_SDK_BACKOFF: NonNullable<RequestOptions['retries']> = { strategy: 'backoff', backoff: { initialInterval: 1, maxInterval: 5, exponent: 1, maxElapsedTime: 200 }, retryConnectionErrors: true };

describe('openRouterRequestOptions()', () => {
  it('should default retries to none when no options are passed', () => {
    expect(openRouterRequestOptions(undefined).retries).toEqual({ strategy: 'none' });
    expect(openRouterRequestOptions(null).retries).toBe(DEFAULT_OPENROUTER_REQUEST_RETRIES);
  });

  it('should keep the caller retries', () => {
    expect(openRouterRequestOptions({ retries: FAST_SDK_BACKOFF }).retries).toBe(FAST_SDK_BACKOFF);
  });

  it('should default an explicit retries: undefined to none', () => {
    // an untyped (or non-exactOptionalPropertyTypes) caller can still pass an explicit undefined
    const options: PartialWithUndefined<RequestOptions> = { retries: undefined };
    expect(openRouterRequestOptions(options as RequestOptions).retries).toEqual({ strategy: 'none' });
  });

  it('should pass the other keys through', () => {
    const controller = new AbortController();
    const result = openRouterRequestOptions({ timeoutMs: 5000, retryCodes: ['503'], signal: controller.signal });

    expect(result.timeoutMs).toBe(5000);
    expect(result.retryCodes).toEqual(['503']);
    expect(result.signal).toBe(controller.signal);
  });
});

describe('openRouterRequestOptionsWithTimeout()', () => {
  describe('retries', () => {
    it('should default retries to none when no timeout is set', () => {
      expect(openRouterRequestOptionsWithTimeout(undefined).retries).toEqual({ strategy: 'none' });
    });

    it('should default retries to none when the timeout goes to the SDK', () => {
      const result = openRouterRequestOptionsWithTimeout({}, 1000);

      expect(result.timeoutMs).toBe(1000);
      expect(result.retries).toEqual({ strategy: 'none' });
    });

    it('should default retries to none when the timeout is merged into the caller signal', () => {
      const controller = new AbortController();
      const result = openRouterRequestOptionsWithTimeout({ signal: controller.signal }, 1000);

      expect(result.signal).not.toBe(controller.signal);
      expect(result.retries).toEqual({ strategy: 'none' });
    });

    it('should keep the caller retries', () => {
      expect(openRouterRequestOptionsWithTimeout({ retries: FAST_SDK_BACKOFF }, 1000).retries).toBe(FAST_SDK_BACKOFF);
    });
  });

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

describe('with an SDK client whose own retry stays on', () => {
  const decisionRequest = openRouterDecisionRequest({ state: 'x', questions: QUESTIONS, overrides: { model: OPENROUTER_JEV_1_13_MODEL_ID } });
  const answered = { answers: { fits: { type: 'noul', noul: 0.8 } } };
  const unavailable = { status: 503 };

  it('should retry when the caller passes retries (control)', async () => {
    const fake = fakeOpenRouterDecisionClient((_, index) => (index === 0 ? unavailable : answered), { retryConfig: FAST_SDK_BACKOFF });
    const result = await openRouterDecision({ client: fake.client, request: decisionRequest, options: { retries: FAST_SDK_BACKOFF } });

    expect(result.answers.fits).toBeDefined();
    expect(fake.callCount).toBe(2);
  });

  it('should send a decision once', async () => {
    const fake = fakeOpenRouterDecisionClient((_, index) => (index === 0 ? unavailable : answered), { retryConfig: FAST_SDK_BACKOFF });

    await expect(openRouterDecision({ client: fake.client, request: decisionRequest })).rejects.toThrow();
    expect(fake.callCount).toBe(1);
  });

  it('should send a responses request once', async () => {
    const fake = fakeOpenRouterDecisionClient(unavailable, { retryConfig: FAST_SDK_BACKOFF });
    const request = { config: { model: 'openai/gpt-5.1' }, input: [] };

    await expect(sendOpenRouterResponsesRequest({ client: fake.client, request })).rejects.toThrow();
    expect(fake.callCount).toBe(1);
  });

  it('should send a callModel request once', async () => {
    const fake = fakeOpenRouterDecisionClient(unavailable, { retryConfig: FAST_SDK_BACKOFF });
    const request = { config: { model: 'openai/gpt-5.1' }, input: [] };

    await expect(callModelForOpenRouterRequest({ client: fake.client, request })).rejects.toThrow();
    expect(fake.callCount).toBe(1);
    expect(fake.requests[0].url).toBe('https://openrouter.ai/api/v1/responses');
  });

  it('should send an embeddings request once', async () => {
    const fake = fakeOpenRouterDecisionClient(unavailable, { retryConfig: FAST_SDK_BACKOFF });

    await expect(openRouterEmbeddings({ client: fake.client, model: 'openai/text-embedding-3-small', input: 'x' })).rejects.toThrow();
    expect(fake.callCount).toBe(1);
    expect(fake.requests[0].url).toBe('https://openrouter.ai/api/v1/embeddings');
  });

  it('should send a generation lookup once', async () => {
    const fake = fakeOpenRouterDecisionClient(unavailable, { retryConfig: FAST_SDK_BACKOFF });

    await expect(openRouterGeneration({ client: fake.client, id: 'gen_1' })).rejects.toThrow();
    expect(fake.callCount).toBe(1);
  });

  it('should send a generation content lookup once', async () => {
    const fake = fakeOpenRouterDecisionClient(unavailable, { retryConfig: FAST_SDK_BACKOFF });

    await expect(openRouterGenerationContent({ client: fake.client, id: 'gen_1' })).rejects.toThrow();
    expect(fake.callCount).toBe(1);
  });

  it('should send a hung request once when the caller passes a signal and it times out', async () => {
    const fake = fakeOpenRouterDecisionClient(fakeOpenRouterHangUntilAborted, { retryConfig: FAST_SDK_BACKOFF });
    const controller = new AbortController();
    const request = openRouterDecisionRequest({ state: 'x', questions: QUESTIONS, overrides: { model: OPENROUTER_JEV_1_13_MODEL_ID, requestTimeoutMs: 20 } });
    const start = Date.now();

    await expect(openRouterDecision({ client: fake.client, request, options: { signal: controller.signal } })).rejects.toThrow(/timed out/);
    expect(fake.callCount).toBe(1);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
