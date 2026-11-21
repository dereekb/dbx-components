import { describe, expect, it, vi } from 'vitest';
import { makeTimeoutAbortSignal, mergeAbortSignals, waitForMsUnlessAborted, waitForPromiseUnlessAborted } from './abort';

/**
 * Runs `fn` with a static `AbortSignal` method hidden, restoring it afterwards.
 *
 * @param name - The static method to hide.
 * @param fn - The body to run.
 * @returns The body's result.
 */
async function withoutAbortSignalStatic<T>(name: 'any' | 'timeout', fn: () => T | Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(AbortSignal, name);
  Object.defineProperty(AbortSignal, name, { value: undefined, configurable: true, writable: true });

  try {
    return await fn();
  } finally {
    if (original) {
      Object.defineProperty(AbortSignal, name, original);
    }
  }
}

describe('waitForMsUnlessAborted()', () => {
  it('should resolve after its timer and leave no listener attached', async () => {
    vi.useFakeTimers();

    try {
      const controller = new AbortController();
      const remove = vi.spyOn(controller.signal, 'removeEventListener');
      let done = false;
      const delayed = waitForMsUnlessAborted(100, controller.signal).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(99);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await delayed;
      expect(done).toBe(true);
      expect(remove).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should wake early on an abort, and return at once for <= 0 or a pre-aborted signal', async () => {
    const controller = new AbortController();
    const delayed = waitForMsUnlessAborted(60_000, controller.signal);
    controller.abort();
    await delayed;
    await waitForMsUnlessAborted(0);
    await waitForMsUnlessAborted(-5);
    await waitForMsUnlessAborted(Number.NaN);
    await waitForMsUnlessAborted(60_000, AbortSignal.abort());
    expect(controller.signal.aborted).toBe(true);
  });

  it('should never reject when aborted with a reason', async () => {
    const controller = new AbortController();
    const delayed = waitForMsUnlessAborted(60_000, controller.signal);
    controller.abort(new Error('stop'));
    await expect(delayed).resolves.toBeUndefined();
  });
});

describe('waitForPromiseUnlessAborted()', () => {
  it('should return the value when there is no signal', async () => {
    await expect(waitForPromiseUnlessAborted(() => Promise.resolve(5))).resolves.toBe(5);
  });

  it('should return the value when the work finishes before an abort', async () => {
    const controller = new AbortController();
    await expect(waitForPromiseUnlessAborted(() => Promise.resolve('done'), controller.signal)).resolves.toBe('done');
  });

  it('should return undefined without starting the work for a pre-aborted signal', async () => {
    const start = vi.fn(() => Promise.resolve(1));
    await expect(waitForPromiseUnlessAborted(start, AbortSignal.abort())).resolves.toBeUndefined();
    expect(start).not.toHaveBeenCalled();
  });

  it('should return undefined when the signal aborts mid-wait, and remove its listener', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const waiting = waitForPromiseUnlessAborted(() => new Promise<number>(() => undefined), controller.signal);
    controller.abort();
    await expect(waiting).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('should rethrow a rejection that comes before an abort', async () => {
    const controller = new AbortController();
    await expect(waitForPromiseUnlessAborted(() => Promise.reject(new Error('gate failed')), controller.signal)).rejects.toThrow('gate failed');
  });

  it('should return undefined for a rejection that comes after an abort', async () => {
    const controller = new AbortController();
    const waiting = waitForPromiseUnlessAborted(() => {
      controller.abort();
      return Promise.reject(new Error('aborted gate'));
    }, controller.signal);

    await expect(waiting).resolves.toBeUndefined();
  });
});

describe('mergeAbortSignals()', () => {
  it('should return undefined for no signals', () => {
    expect(mergeAbortSignals([])).toBeUndefined();
    expect(mergeAbortSignals([undefined, null])).toBeUndefined();
  });

  it('should return the same instance when exactly one signal exists', () => {
    const controller = new AbortController();
    expect(mergeAbortSignals([undefined, controller.signal, null])).toBe(controller.signal);
  });

  it('should abort when either of two signals aborts, with its reason', () => {
    const first = new AbortController();
    const second = new AbortController();
    const merged = mergeAbortSignals([first.signal, second.signal]);

    expect(merged?.aborted).toBe(false);
    second.abort('second reason');
    expect(merged?.aborted).toBe(true);
    expect(merged?.reason).toBe('second reason');
  });

  it('should return an aborted signal when an input is already aborted', () => {
    const merged = mergeAbortSignals([new AbortController().signal, AbortSignal.abort('pre')]);
    expect(merged?.aborted).toBe(true);
    expect(merged?.reason).toBe('pre');
  });

  describe('without AbortSignal.any', () => {
    it('should abort with the first aborting input reason', async () => {
      await withoutAbortSignalStatic('any', () => {
        const first = new AbortController();
        const second = new AbortController();
        const merged = mergeAbortSignals([first.signal, second.signal]);

        expect(merged?.aborted).toBe(false);
        first.abort('first reason');
        second.abort('second reason');
        expect(merged?.aborted).toBe(true);
        expect(merged?.reason).toBe('first reason');
      });
    });

    it('should return an aborted signal when an input is already aborted', async () => {
      await withoutAbortSignalStatic('any', () => {
        const merged = mergeAbortSignals([new AbortController().signal, AbortSignal.abort('pre')]);
        expect(merged?.aborted).toBe(true);
        expect(merged?.reason).toBe('pre');
      });
    });
  });
});

describe('makeTimeoutAbortSignal()', () => {
  it('should abort with a TimeoutError after the timeout', async () => {
    const signal = makeTimeoutAbortSignal({ timeout: 5 });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(signal.aborted).toBe(true);
    expect((signal.reason as DOMException).name).toBe('TimeoutError');
  });

  it('should abort with the caller reason when the caller aborts first', () => {
    const controller = new AbortController();
    const signal = makeTimeoutAbortSignal({ timeout: 60_000, signal: controller.signal });

    controller.abort('caller reason');

    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe('caller reason');
  });

  it('should propagate an error thrown by the runtime API', () => {
    const spy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      throw new TypeError('AbortSignal.timeout is not a function');
    });

    try {
      expect(() => makeTimeoutAbortSignal({ timeout: 10 })).toThrow('AbortSignal.timeout is not a function');
    } finally {
      spy.mockRestore();
    }
  });

  describe('without AbortSignal.timeout', () => {
    it('should abort with a TimeoutError DOMException after the timeout', async () => {
      vi.useFakeTimers();

      try {
        await withoutAbortSignalStatic('timeout', async () => {
          const signal = makeTimeoutAbortSignal({ timeout: 100 });

          await vi.advanceTimersByTimeAsync(99);
          expect(signal.aborted).toBe(false);
          await vi.advanceTimersByTimeAsync(1);
          expect(signal.aborted).toBe(true);
          expect(signal.reason).toBeInstanceOf(DOMException);
          expect((signal.reason as DOMException).name).toBe('TimeoutError');
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
