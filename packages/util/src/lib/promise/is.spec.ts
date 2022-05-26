import { isPromise } from '@dereekb/util';

describe('isPromise()', () => {
  it('should return true if a promise.', () => {
    let close: () => void;

    const promise = new Promise<void>((resolve) => {
      close = resolve;
    });

    expect(isPromise(promise)).toBe(true);
    close!();
  });

  it('should return false if not a promise.', () => {
    expect(isPromise(0)).toBe(false);
    expect(isPromise({})).toBe(false);
    expect(isPromise('not')).toBe(false);
  });
});
