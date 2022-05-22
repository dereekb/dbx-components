import { catchAllHandlerKey, Handler, makeHandler } from './handler';

describe('handler()', () => {

  let handler: Handler<number, string>;

  it('should create a new handler.', () => {
    handler = makeHandler((x: number) => String(x));
    expect(typeof handler).toBe('function');
    expect(typeof handler.set).toBe('function');
    expect(typeof handler.bindSet).toBe('function');
    expect(handler.readKey).toBeDefined();
  });

  describe('function', () => {

    beforeEach(() => {
      handler = makeHandler((x: number) => String(x));
    });

    describe('set', () => {

      it('should set the function on the handler for that key', () => {
        let wasUsed = false;

        const key = '1';
        const value = 1;
        const fn = (x: number) => {
          wasUsed = true;
          expect(x).toBe(value);
          return true;  // result
        };

        handler.set(key, fn);
        expect(wasUsed).toBe(false);

        const result = handler(value);
        expect(result).toBe(true);
        expect(wasUsed).toBe(true);
      });

      it('should set the catch all when using the catchall key', () => {
        let wasUsed = false;

        const otherValue = 10000;

        const fn = (x: number) => {
          wasUsed = true;
          expect(x).toBe(otherValue);
          return true;  // result
        };

        handler.set(catchAllHandlerKey(), fn);
        expect(wasUsed).toBe(false);

        const result = handler(otherValue);
        expect(result).toBe(true);
        expect(wasUsed).toBe(true);
      });

    });

    describe('bindSet', () => {

      it('should set the function on the handler for that key and use the bound value', () => {

        let wasUsed = false;

        const testThis = {};
        const key = '1';
        const fn = function (this: unknown) {
          expect(this).toBe(testThis);
          wasUsed = true;
          return true;  // result
        };

        handler.bindSet(testThis, key, fn);

        expect(wasUsed).toBe(false);

        const result = handler(1);

        expect(result).toBe(true);
        expect(wasUsed).toBe(true);
      });

    });

  });

});
