import { cachedGetter } from './getter.cache';

describe('cachedGetter()', () => {
  describe('with a simple Getter (no input)', () => {
    let mockGetter: jest.Mock<string, []>;
    let cached: ReturnType<typeof cachedGetter<string>>;

    beforeEach(() => {
      mockGetter = jest.fn(() => 'initial_value');
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
  });
});
