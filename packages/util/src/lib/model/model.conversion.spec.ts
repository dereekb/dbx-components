import { makeModelFieldConversionFunction } from './model.conversion';

interface TestConversionFromModel {
  name: string;
  test?: boolean;
}

interface TestConversionToModel {
  name: string;
  test?: string;
}

describe('makeModelConversionFunctions', () => {

  // todo

});

describe('makeModelFieldConversionFunction()', () => {

  const testModel: TestConversionFromModel = {
    name: 'test',
    test: true
  };

  describe('function', () => {

    it('should return the default value if convertMaybe is false/undefined and null/undefined is input.', () => {
      const defaultValue = 1;
      const fn = makeModelFieldConversionFunction({ default: defaultValue });

      const result = fn(undefined);

      expect(result).toBe(defaultValue);
    });

    it('should call convert if convertMaybe is true and null/undefined is input.', () => {
      const convertResultValue = 1;
      const fn = makeModelFieldConversionFunction({ convert: () => convertResultValue, convertMaybe: true });

      const result = fn(undefined);

      expect(result).toBe(convertResultValue);
    });

    it('should convert the value if a non-null value is passed in..', () => {
      const convertResultValue = 1;
      const fn = makeModelFieldConversionFunction({ convert: () => convertResultValue, convertMaybe: true });

      const result = fn(100);

      expect(result).toBe(convertResultValue);
    });

  });

});
