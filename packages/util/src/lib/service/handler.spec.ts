import { catchAllHandlerKey, type Handler, handlerFactory, makeHandler } from './handler';

describe('handler()', () => {
  let handler: Handler<string | number, string>;

  it('should create a new handler.', () => {
    handler = makeHandler((x: string | number) => String(x));
    expect(typeof handler).toBe('function');
    expect(typeof handler.set).toBe('function');
    expect(typeof handler.bindSet).toBe('function');
    expect(handler.readKey).toBeDefined();
  });

  describe('function', () => {
    beforeEach(() => {
      handler = makeHandler((x: string | number) => String(x));
    });

    describe('set', () => {
      it('should set the function on the handler for that key', async () => {
        let wasUsed = false;
        const key = '1';
        const value = 1;
        const fn = (x: string | number) => {
          wasUsed = true;
          expect(x).toBe(value);
          return true;
        };

        handler.set(key, fn);
        expect(wasUsed).toBe(false);

        const result = await handler(value);
        expect(result).toBe(true);
        expect(wasUsed).toBe(true);
      });

      it('should set multiple handlers for different keys', async () => {
        const results: Record<string, boolean> = {};

        handler.set('1', () => {
          results['1'] = true;
          return true;
        });

        handler.set('2', () => {
          results['2'] = true;
          return true;
        });

        await handler(1);
        await handler(2);

        expect(results).toEqual({ '1': true, '2': true });
      });

      it('should handle async handlers', async () => {
        let wasUsed = false;

        handler.set('1', async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          wasUsed = true;
          return true;
        });

        const result = await handler(1);
        expect(result).toBe(true);
        expect(wasUsed).toBe(true);
      });

      it('should set the catch all when using the catchall key', async () => {
        let wasUsed = false;
        const otherValue = 10000;

        const fn = (x: string | number) => {
          wasUsed = true;
          expect(x).toBe(otherValue);
          return true;
        };

        handler.set(catchAllHandlerKey(), fn);
        expect(wasUsed).toBe(false);

        const result = await handler(otherValue);
        expect(result).toBe(true);
        expect(wasUsed).toBe(true);
      });

      it('should prefer specific key handler over catch-all', async () => {
        const specificFn = jest.fn().mockReturnValue(true);
        const catchAllFn = jest.fn().mockReturnValue(true);

        handler.set('specific', specificFn);
        handler.set(catchAllHandlerKey(), catchAllFn);

        await handler('specific' as any);

        expect(specificFn).toHaveBeenCalled();
        expect(catchAllFn).not.toHaveBeenCalled();
      });

      it('should handle array of keys', async () => {
        const fn = jest.fn().mockReturnValue(true);
        handler.set(['key1', 'key2'], fn);

        await handler(1); // key is '1', should not match
        expect(fn).not.toHaveBeenCalled();

        await handler('key1' as any);
        expect(fn).toHaveBeenCalledTimes(1);

        await handler('key2' as any);
        expect(fn).toHaveBeenCalledTimes(2);
      });
    });

    describe('bindSet', () => {
      it('should set the function on the handler for that key and use the bound value', async () => {
        let wasUsed = false;
        const testThis = {};
        const key = '1';
        const fn = function (this: unknown) {
          expect(this).toBe(testThis);
          wasUsed = true;
          return true;
        };

        handler.bindSet(testThis, key, fn);
        expect(wasUsed).toBe(false);

        const result = await handler(1);
        expect(result).toBe(true);
        expect(wasUsed).toBe(true);
      });
    });

    it('should return false when no handler is found', async () => {
      const result = await handler(999);
      expect(result).toBe(false);
    });

    it('should handle undefined key from readKey function', async () => {
      const customHandler = makeHandler(() => undefined);
      const catchAllFn = jest.fn().mockReturnValue(true);

      customHandler.set(catchAllHandlerKey(), catchAllFn);

      const result = await customHandler(123);
      expect(catchAllFn).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});

describe('handlerFactory()', () => {
  it('should create independent handler instances', async () => {
    const factory = handlerFactory((x: number) => String(x));
    const handler1 = factory();
    const handler2 = factory();

    const fn1 = jest.fn().mockReturnValue(true);
    const fn2 = jest.fn().mockReturnValue(true);

    handler1.set('1', fn1);
    handler2.set('1', fn2);

    await handler1(1);
    expect(fn1).toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();

    await handler2(1);
    expect(fn2).toHaveBeenCalled();
  });

  it('should handle custom key types', async () => {
    type CustomKey = 'A' | 'B';
    const factory = handlerFactory<number, CustomKey>((x: number) => (x === 1 ? 'A' : 'B'));
    const handler = factory();

    const fn = jest.fn().mockReturnValue(true);
    handler.set('A', fn);

    await handler(1);
    expect(fn).toHaveBeenCalled();
  });

  it('should handle void return from handler as true', async () => {
    const handler = makeHandler((x: number) => String(x));
    const fn = jest.fn(); // returns undefined

    handler.set('1', fn);
    const result = await handler(1);

    expect(fn).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
