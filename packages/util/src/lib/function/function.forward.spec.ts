import { forwardFunction } from './function.forward';

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
