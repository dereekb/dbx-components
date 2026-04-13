import { type Mock } from 'vitest';
import { cachedGetter } from './getter.cache';

describe('cachedGetter()', () => {
  describe('with a simple Getter (no input)', () => {
    let mockGetter: Mock<() => string>;
    let cached: ReturnType<typeof cachedGetter<string>>;

    beforeEach(() => {
      mockGetter = vi.fn(() => 'initial_value');
      cached = cachedGetter(mockGetter);
    });

    it('should call the getter only once for multiple retrievals', () => {
      expect(cached()).toBe('initial_value');
      expect(cached()).toBe('initial_value');
      expect(mockGetter).toHaveBeenCalledTimes(1);
    });

    it('set() should update the cached value without calling the getter', () => {
      cached(); // initial call
      mockGetter.mockClear();

      cached.set('new_value');
      expect(cached()).toBe('new_value');
      expect(mockGetter).not.toHaveBeenCalled();
    });

    it('reset() should clear the cache, next call re-invokes getter', () => {
      expect(cached()).toBe('initial_value');
      cached.reset();
      mockGetter.mockImplementationOnce(() => 'reloaded_value');
      expect(cached()).toBe('reloaded_value');
      expect(mockGetter).toHaveBeenCalledTimes(2);
    });

    it('init() should re-initialize from the getter', () => {
      cached(); // initial call
      mockGetter.mockImplementationOnce(() => 'reinitialized_value');
      cached.init();
      expect(cached()).toBe('reinitialized_value');
      expect(mockGetter).toHaveBeenCalledTimes(2);
    });

    describe('used()', () => {
      it('should return false before the cache has been accessed', () => {
        expect(cached.used()).toBe(false);
      });

      it('should return true after the cache has been accessed', () => {
        cached();
        expect(cached.used()).toBe(true);
      });

      it('should return true after set() is called', () => {
        cached.set('manual_value');
        expect(cached.used()).toBe(true);
      });

      it('should return false after reset() is called', () => {
        cached();
        expect(cached.used()).toBe(true);
        cached.reset();
        expect(cached.used()).toBe(false);
      });

      it('should return true after init() is called', () => {
        cached.init();
        expect(cached.used()).toBe(true);
      });
    });
  });
});
