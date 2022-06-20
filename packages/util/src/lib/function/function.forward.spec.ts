import { forwardFunction, defaultForwardFunctionFactory } from './function.forward';

describe('forwardFunction()', () => {
  it('should wrap a function.', () => {
    const fn = (input: number) => input + 1;

    const result = forwardFunction(() => fn);
    expect(result).toBeDefined();

    const value = 1;
    const output = result(value);
    expect(output).toBe(value + 1);
  });
});

describe('useOrDefaultForwardFunction', () => {
  describe('function', () => {
    const defaultValue = 100;
    const defaultFn = (value: number) => defaultValue;
    const useForward = defaultForwardFunctionFactory<(input: number) => number>(defaultFn);

    it('should use the input function if defined.', () => {
      const forwardTo = (x: number) => x + 1;
      const fn = useForward(forwardTo);

      const input = 0;
      const result = fn(input);
      expect(result).toBe(forwardTo(input));
    });

    it('should use the default input function if defined.', () => {
      const forwardTo = undefined;
      const fn = useForward(forwardTo);

      const input = 0;
      const result = fn(input);
      expect(result).toBe(defaultFn(input));
    });
  });
});
