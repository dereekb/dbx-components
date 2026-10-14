import { describe, it, expect, vi, afterEach } from 'vitest';
import { DbxFilterPopoverPendingChangesInstance } from './filter.popover.pending';

describe('DbxFilterPopoverPendingChangesInstance', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve immediately when nothing is registered', async () => {
    const instance = new DbxFilterPopoverPendingChangesInstance();
    expect(instance.hasApplyPending).toBe(false);
    await expect(instance.applyPending()).resolves.toBeUndefined();
  });

  it('should wait for every registered function', async () => {
    const instance = new DbxFilterPopoverPendingChangesInstance();
    const finished: string[] = [];

    instance.registerApplyPending(() => Promise.resolve().then(() => void finished.push('a')));
    instance.registerApplyPending(() => new Promise<void>((resolve) => setTimeout(resolve, 10)).then(() => void finished.push('b')));

    expect(instance.hasApplyPending).toBe(true);
    await instance.applyPending();
    expect(finished.sort()).toEqual(['a', 'b']);
  });

  it('should not call a function whose registration was removed', async () => {
    const instance = new DbxFilterPopoverPendingChangesInstance();
    const applyPending = vi.fn(() => Promise.resolve());

    const unregister = instance.registerApplyPending(applyPending);
    unregister();

    expect(instance.hasApplyPending).toBe(false);
    await instance.applyPending();
    expect(applyPending).not.toHaveBeenCalled();
  });

  it('should count a rejecting function as finished', async () => {
    const instance = new DbxFilterPopoverPendingChangesInstance();
    instance.registerApplyPending(() => Promise.reject(new Error('failed')));

    await expect(instance.applyPending()).resolves.toBeUndefined();
  });

  it('should resolve after maxWait when a function never resolves', async () => {
    vi.useFakeTimers();

    const instance = new DbxFilterPopoverPendingChangesInstance(1000);
    instance.registerApplyPending(() => new Promise<void>(() => undefined));

    let resolved = false;
    const result = instance.applyPending().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await result;
    expect(resolved).toBe(true);
  });
});
