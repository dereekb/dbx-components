import { describe, it, expect, vi } from 'vitest';
import { DbxFilterPopoverPendingChangesInstance } from './filter.popover.pending';

describe('DbxFilterPopoverPendingChangesInstance', () => {
  it('should do nothing when nothing is registered', () => {
    const instance = new DbxFilterPopoverPendingChangesInstance();
    expect(instance.hasApplyPending).toBe(false);
    expect(() => instance.applyPending()).not.toThrow();
  });

  it('should call every registered function synchronously', () => {
    const instance = new DbxFilterPopoverPendingChangesInstance();
    const a = vi.fn();
    const b = vi.fn();

    instance.registerApplyPending(a);
    instance.registerApplyPending(b);

    expect(instance.hasApplyPending).toBe(true);
    instance.applyPending();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('should not call a function whose registration was removed', () => {
    const instance = new DbxFilterPopoverPendingChangesInstance();
    const applyPending = vi.fn();

    const unregister = instance.registerApplyPending(applyPending);
    unregister();

    expect(instance.hasApplyPending).toBe(false);
    instance.applyPending();
    expect(applyPending).not.toHaveBeenCalled();
  });

  it('should keep calling the other functions when one throws, and pass the error to handleError', () => {
    const handleError = vi.fn();
    const instance = new DbxFilterPopoverPendingChangesInstance(handleError);
    const error = new Error('failed');
    const after = vi.fn();

    instance.registerApplyPending(() => {
      throw error;
    });

    instance.registerApplyPending(after);

    expect(() => instance.applyPending()).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(error);
  });
});
