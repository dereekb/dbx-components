import { build } from './../value/build';
import { countPOJOKeys, KeyValueTypleValueFilter } from '../object';
import { modelFieldMapFunction, makeModelMapFunctions, modelFieldConversions } from './model.conversion';
import { copyField } from './model.conversion.field';

interface TestConversionModel {
  name: string;
  number: number;
  date: Date;
  test?: boolean;
}

interface TestConversionDataModel {
  name: string;
  number: string;
  date?: number;
  test?: boolean;
}

const defaultTestValue: boolean = true;
const defaultTestModel: TestConversionModel = {
  name: 'test',
  number: 1,
  date: new Date()
};

const fields = modelFieldConversions<TestConversionModel, TestConversionDataModel>({
  name: copyField(''),
  test: copyField<boolean | undefined>(defaultTestValue),
  date: {
    from: {
      convert: (x: number) => new Date(x),
      default: () => new Date()
    },
    to: {
      defaultInput: () => new Date(),
      convert: (x: Date) => x.getTime()
    }
  },
  number: {
    from: {
      convert: (x: string) => Number(x),
      default: 0
    },
    to: {
      convert: (x: number) => String(x),
      default: '0'
    }
  }
});

const mapFunctions = makeModelMapFunctions<TestConversionModel, TestConversionDataModel>(fields);

describe('makeModelMapFunctions', () => {
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
          const testModel = build<typeof defaultTestModel>({
            base: { ...defaultTestModel },
            build: (x) => {
              delete x.number;
              delete x.date;
            }
          });

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

describe('modelFieldMapFunction()', () => {
  describe('function', () => {
    it('should return the default value if convertMaybe is false/undefined and null/undefined is input.', () => {
      const defaultOutput = 1;
      const fn = modelFieldMapFunction<number, number>({ default: defaultOutput, convert: (x) => x });

      const result = fn(undefined);

      expect(result).toBe(defaultOutput);
    });

    it('should call convertMaybe if null/undefined is input.', () => {
      const convertResultValue = 1;
      const fn = modelFieldMapFunction<number, number>({ convertMaybe: () => convertResultValue });

      const result = fn(undefined);

      expect(result).toBe(convertResultValue);
    });

    it('should convert the value if a non-null value is passed in.', () => {
      const convertResultValue = 1;
      const fn = modelFieldMapFunction<number, number>({ convert: () => convertResultValue, defaultInput: 0 });

      const result = fn(100);

      expect(result).toBe(convertResultValue);
    });
  });
});
