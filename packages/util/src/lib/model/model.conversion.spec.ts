import { build } from './../value/build';
import { countPOJOKeys, KeyValueTypleValueFilter } from '../object';
import { modelFieldMapFunction, makeModelMapFunctions, modelFieldConversions } from './model.conversion';
import { copyField } from './model.conversion.field';
import { modifyModelMapFunctions } from './model.modify';

interface TestConversionModel {
  name: string;
  pureNumber: number;
  number: number;
  date: Date;
  test?: boolean;
}

interface TestConversionDataModel {
  name: string;
  pureNumber: number;
  number: string;
  date?: number;
  test?: boolean;
}

const defaultTestValue: boolean = true;
const defaultTestModel: TestConversionModel = {
  name: 'test',
  pureNumber: 1,
  number: 1,
  date: new Date()
};

const defaultNumberFromValue = 0;
const defaultNumberToValue = String(defaultNumberFromValue);

const fields = modelFieldConversions<TestConversionModel, TestConversionDataModel>({
  name: copyField(''),
  pureNumber: copyField(0),
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
      default: defaultNumberFromValue
    },
    to: {
      convert: (x: number) => String(x),
      default: defaultNumberToValue
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
        expect(result.date).toBeDefined();
      });

      it('should apply the default values for null values.', () => {
        const result = mapFunctions.to({ test: null, date: null, number: null } as any);

        expect(result.date).toBeDefined();
        expect(result.date).not.toBeNull();
        expect(result.number).toBe(defaultNumberToValue);
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

          expect(keysWithDefinedValue).toBe(2);
          expect(result.name).toBe(defaultTestModel.name);
          expect(result.pureNumber).toBe(defaultTestModel.pureNumber);
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

describe('modifyModelMapFunctions()', () => {
  it('should wrap the modify function', () => {
    const result = modifyModelMapFunctions({
      mapFunctions,
      modifiers: [
        {
          modifyData: () => undefined,
          modifyModel: () => undefined
        }
      ]
    });

    expect(result).toBeDefined();
    expect(result.from).toBeDefined();
    expect(result.to).toBeDefined();
  });

  describe('function', () => {
    describe('copy=false', () => {
      it('should not copy the input model or data when applying modifiers.', () => {
        const modifyDataName = '0';
        const modifyModelName = '1';

        const modifyMapFunctions = modifyModelMapFunctions({
          mapFunctions,
          modifiers: [
            {
              modifyData: (x) => (x.name = modifyDataName),
              modifyModel: (x) => (x.name = modifyModelName)
            }
          ],
          copy: false // do not modify a copy
        });

        const inputModel = {
          ...defaultTestModel
        };

        expect(inputModel.name).toBe(defaultTestModel.name);

        const data = modifyMapFunctions.to(inputModel);
        expect(inputModel.name).toBe(modifyModelName);
        expect(data).toBeDefined();
        expect(data.name).toBe(modifyModelName);

        const model = modifyMapFunctions.from(data);
        expect(model).toBeDefined();
        expect(data.name).toBe(modifyDataName);
        expect(model.name).toBe(modifyDataName);
      });
    });

    describe('conversions', () => {
      let calledModifyData = false;
      let calledModifyModel = false;

      const modifyMapFunctions = modifyModelMapFunctions({
        mapFunctions,
        modifiers: [
          {
            modifyData: () => (calledModifyData = !calledModifyData),
            modifyModel: () => (calledModifyModel = !calledModifyModel)
          }
        ]
      });

      beforeEach(() => {
        calledModifyData = false;
        calledModifyModel = false;
      });

      it('should call the modifyData function of all input modifiers when converting a defined value', () => {
        const data = modifyMapFunctions.to(defaultTestModel);
        expect(data).toBeDefined();
        expect(calledModifyModel).toBe(true);
        expect(calledModifyData).toBe(false);

        const model = modifyMapFunctions.from(data);
        expect(model).toBeDefined();
        expect(calledModifyModel).toBe(true);
        expect(calledModifyData).toBe(true);
      });

      it('should not call all the modifyData function of all input modifiers when converting an undefined value', () => {
        const data = modifyMapFunctions.to(undefined);
        expect(data).toBeDefined();
        expect(calledModifyModel).toBe(false);
        expect(calledModifyData).toBe(false);

        const model = modifyMapFunctions.from(undefined);
        expect(model).toBeDefined();
        expect(calledModifyModel).toBe(false);
        expect(calledModifyData).toBe(false);
      });
    });
  });
});
