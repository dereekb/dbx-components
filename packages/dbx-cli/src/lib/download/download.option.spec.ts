import { describe, expect, it } from 'vitest';
import { CliDownloadAbortedError } from './download.file';
import { withCliInterruptSignal } from './download.interrupt';
import { cliConcurrencyValue, cliIdleTimeoutMs } from './download.option';

describe('cliIdleTimeoutMs()', () => {
  it('converts seconds and rejects a non-positive value', () => {
    expect(cliIdleTimeoutMs(undefined)).toBeUndefined();
    expect(cliIdleTimeoutMs(90)).toBe(90_000);
    expect(() => cliIdleTimeoutMs(0)).toThrow('--idle-timeout');
  });
});

describe('cliConcurrencyValue()', () => {
  const config = { default: 4, max: 8 };

  it('returns the default when unset and the value when in range', () => {
    expect(cliConcurrencyValue(undefined, config)).toBe(4);
    expect(cliConcurrencyValue(1, config)).toBe(1);
    expect(cliConcurrencyValue(8, config)).toBe(8);
  });

  it.each([0, 9, 2.5, -1])('rejects %s', (value) => {
    expect(() => cliConcurrencyValue(value, config)).toThrow('--concurrency');
  });
});

describe('withCliInterruptSignal()', () => {
  it('aborts the signal on SIGINT and removes its listeners afterwards', async () => {
    const before = process.listenerCount('SIGINT');
    let reason: unknown;

    await withCliInterruptSignal(async (signal) => {
      expect(process.listenerCount('SIGINT')).toBe(before + 1);
      expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
      process.emit('SIGINT', 'SIGINT');
      expect(signal.aborted).toBe(true);
      reason = signal.reason;
      // the first interrupt removes the handler, so a second Ctrl+C exits at once
      expect(process.listenerCount('SIGINT')).toBe(before);
    });

    expect(reason).toBeInstanceOf(CliDownloadAbortedError);
    expect(process.listenerCount('SIGINT')).toBe(before);
  });

  it('removes its listeners when the run throws', async () => {
    const beforeInt = process.listenerCount('SIGINT');
    const beforeTerm = process.listenerCount('SIGTERM');

    await expect(withCliInterruptSignal(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(process.listenerCount('SIGINT')).toBe(beforeInt);
    expect(process.listenerCount('SIGTERM')).toBe(beforeTerm);
  });
});
