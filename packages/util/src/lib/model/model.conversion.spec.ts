import { countPOJOKeys, KeyValueTypleValueFilter } from '../object';
import { makeModelFieldMapFunction, makeModelMapFunctions, ModelFieldFromConfig, ModelFieldsConversionConfig } from './model.conversion';

interface TestConversionModel {
  name: string;
  number: number;
  test?: boolean;
}

interface TestConversionDataModel {
  name: string;
  number: string;
  test?: boolean;
}

const defaultTestModel: TestConversionModel = {
  name: 'test',
  number: 1
};

const defaultTestValue = true;

describe('makeModelMapFunctions', () => {

  const fields: ModelFieldsConversionConfig<TestConversionModel> = {
    name: {},
    test: {
      from: {
        default: defaultTestValue
      },
      to: {
        default: defaultTestValue
      }
    },
    number: {
      from: {
        convert: (x: string) => Number(x)
      },
      to: {
        convert: (x: number) => String(x)
      }
    }
  };

  const mapFunctions = makeModelMapFunctions<TestConversionModel, TestConversionDataModel>(fields);

  describe('functions', () => {

    describe('to', () => {

      it('should convert the value to the data model.', () => {

        const result = mapFunctions.to(defaultTestModel);

        expect(result.name).toBe(defaultTestModel.name);
        expect(result.number).toBe(String(defaultTestModel.number));
        expect(result.test).toBe(defaultTestValue);

      });

      // todo: add target

    });

    describe('from', () => {

      it('should convert the value from the data model.', () => {

        const dataModel = mapFunctions.to(defaultTestModel);
        const result = mapFunctions.from(dataModel);

        expect(result.name).toBe(defaultTestModel.name);
        expect(result.number).toBe(defaultTestModel.number);
        expect(result.test).toBe(defaultTestValue);

      });

      // todo: add target

    });

    describe('with options', () => {

      describe('fields', () => {

        it('should filter on the fields', () => {

          const result = mapFunctions.to(defaultTestModel, undefined, {
            fields: ['name']
          });

          expect(result.name).toBe(defaultTestModel.name);
          expect(result.number).toBe(undefined);
          expect(result.test).toBe(undefined);

        });

      });

      describe('definedOnly', () => {

        it('should only convert defined values.', () => {

          const testModel = {
            ...defaultTestModel
          };

          delete (testModel as any).number;

          const result = mapFunctions.to(testModel, undefined, {
            definedOnly: true
          });

          const keysWithDefinedValue = countPOJOKeys(result, KeyValueTypleValueFilter.UNDEFINED);

          expect(keysWithDefinedValue).toBe(1);
          expect(result.name).toBe(defaultTestModel.name);
          expect(result.number).toBe(undefined);
          expect(result.test).toBe(undefined);

        });

      });

    });

  });

});

describe('makeModelFieldMapFunction()', () => {

  describe('function', () => {

    it('should return the default value if convertMaybe is false/undefined and null/undefined is input.', () => {
      const defaultValue = 1;
      const fn = makeModelFieldMapFunction({ default: defaultValue });

      const result = fn(undefined);

      expect(result).toBe(defaultValue);
    });

    it('should call convert if convertMaybe is true and null/undefined is input.', () => {
      const convertResultValue = 1;
      const fn = makeModelFieldMapFunction({ convert: () => convertResultValue, convertMaybe: true });

      const result = fn(undefined);

      expect(result).toBe(convertResultValue);
    });

    it('should convert the value if a non-null value is passed in.', () => {
      const convertResultValue = 1;
      const fn = makeModelFieldMapFunction({ convert: () => convertResultValue, convertMaybe: true });

      const result = fn(100);

      expect(result).toBe(convertResultValue);
    });

  });

});
