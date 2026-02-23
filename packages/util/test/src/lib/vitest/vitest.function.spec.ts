import { useVitestFunctionMapFixture } from './vitest.function';

describe('useVitestFunctionFixtureArray', () => {
  const config = {
    fns: {
      test: () => (input: string) => input.toUpperCase(),
      mergeTest: () => (a: string, b: string) => a + b
    }
  };

  useVitestFunctionMapFixture(config, (fns) => {
    it('should forward an object of results', () => {
      const value = 'hello';
      const result = fns.test(value);
      expect(result).toBe(config.fns.test()(value));
    });
  });
});
