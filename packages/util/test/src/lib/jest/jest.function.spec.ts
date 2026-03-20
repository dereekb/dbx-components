import { useTestFunctionMapFixture } from '../shared/shared.function';

describe('useJestFunctionFixtureArray', () => {
  const config = {
    fns: {
      test: () => (input: string) => input.toUpperCase(),
      mergeTest: () => (a: string, b: string) => a + b
    }
  };

  useTestFunctionMapFixture(config, (fns) => {
    it('should forward an object of results', () => {
      const value = 'hello';
      const result = fns.test(value);
      expect(result).toBe(config.fns.test()(value));
    });
  });
});
