import { type Handler, type HandlerFunction, makeHandler } from './handler';
import { type HandlerBindAccessor, handlerBindAccessor, type HandlerConfigurer, handlerConfigurerFactory, handlerMappedSetFunction } from './handler.config';

interface TestConfigurer extends HandlerBindAccessor<number, string> {
  test: boolean;
  configureWithFn: (fn: HandlerFunction<number>) => void;
}

describe('handler config', () => {
  let handler: Handler<number, string>;

  beforeEach(() => {
    handler = makeHandler((x: number) => String(x));
  });

  describe('handlerBindAccessor()', () => {
    it('should create a new HandlerBindAccessor', () => {
      const boundTo = {};
      const result = handlerBindAccessor(boundTo, handler);
      expect(result).toBeDefined();
      expect(result.accessor).toBe(handler);
      expect(result.boundTo).toBe(boundTo);
    });

    describe('function', () => {
      const boundTo = {};
      let accessor: HandlerBindAccessor<number, string>;

      beforeEach(() => {
        accessor = handlerBindAccessor(boundTo, handler);
      });

      it('should set the function on the handler for that key and use the bound value', () => {
        let wasUsed = false;

        const key = '1';
        const value = 1;
        const fn = function (this: unknown, x: number) {
          expect(this).toBe(boundTo);
          expect(x).toBe(value);
          wasUsed = true;
          return true; // result
        };

        accessor.set(key, fn);

        expect(wasUsed).toBe(false);

        const result = handler(value);
        expect(result).toBe(true);
        expect(wasUsed).toBe(true);
      });
    });
  });

  describe('handlerMappedSetFunction()', () => {
    it('should create a set function factory', () => {
      const key = '1';

      const setFn = handlerMappedSetFunction(handler, key, (x) => x + 1); // input value + 1

      let wasUsed = false;
      const inputValue = Number(key);

      setFn(function (value: number) {
        expect(value).toBe(inputValue + 1);
        wasUsed = true;
        return true;
      });

      expect(wasUsed).toBe(false);

      const result = handler(inputValue);

      expect(result).toBe(true);
      expect(wasUsed).toBe(true);
    });

    describe('with HandlerBindAccessor input', () => {
      it('should create a set function factory that maintains the bindings', () => {
        const key = '1';

        const boundTo = {};
        const accessor = handlerBindAccessor(boundTo, handler);
        const setFn = handlerMappedSetFunction(accessor, key, (x) => x + 1); // input value + 1

        let wasUsed = false;
        const inputValue = Number(key);

        setFn(function (this: unknown, value: number) {
          expect(this).toBe(boundTo);
          expect(value).toBe(inputValue + 1);
          wasUsed = true;
          return true;
        });

        expect(wasUsed).toBe(false);

        const result = handler(inputValue);

        expect(result).toBe(true);
        expect(wasUsed).toBe(true);
      });
    });
  });

  describe('handlerConfigurerFactory()', () => {
    const key = '1';
    const config = {
      configurerForAccessor: (accessor: HandlerBindAccessor<number, string>) => ({
        ...accessor,
        test: true,
        configureWithFn: (fn: HandlerFunction<number>) => accessor.set('1', fn)
      })
    };

    it('should create a new handlerConfigurerFactory()', () => {
      const configurerFactory = handlerConfigurerFactory<TestConfigurer, number>(config);
      expect(configurerFactory).toBeDefined();
    });

    describe('function', () => {
      const configurerFactory = handlerConfigurerFactory<TestConfigurer, number>(config);

      it('should create a configurer', () => {
        const configurer = configurerFactory(handler);
        expect(configurer).toBeDefined();
      });

      describe('configurer', () => {
        let configurer: HandlerConfigurer<TestConfigurer, number>;

        beforeEach(() => {
          configurer = configurerFactory(handler);
        });

        it('should configure with the input', () => {
          const boundTo = {};

          let wasUsed = false;

          configurer(boundTo, (x) => {
            const fn = function (this: unknown) {
              wasUsed = true;
              return true; // result
            };

            x.configureWithFn(fn);
          });

          const value = Number(key);

          expect(wasUsed).toBe(false);

          const result = handler(value);
          expect(result).toBe(true);
          expect(wasUsed).toBe(true);
        });
      });
    });
  });
});
