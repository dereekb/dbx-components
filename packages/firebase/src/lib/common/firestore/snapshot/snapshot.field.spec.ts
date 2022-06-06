import { ISO8601DateString, modelFieldMapFunctions } from '@dereekb/util';
import { isValid } from 'date-fns';
import { firestoreDate, firestoreEncodedArray, firestoreField, firestoreUniqueArray, firestoreUniqueKeyedArray, firestoreUniqueStringArray } from './snapshot.field';

describe('firestoreField()', () => {
  const defaultValue = -1;
  const fromDataValue = 1;
  const toDataValue = 0;

  const fromData = () => fromDataValue;
  const toData = () => toDataValue;

  const config = {
    default: defaultValue,
    fromData,
    toData
  };

  it('should return the conversion config', () => {
    const result = firestoreField(config);

    expect(result.from!.convert).toBe(fromData);
    expect(result.to!.convert).toBe(toData);
  });

  describe('conversion', () => {
    const { from, to } = modelFieldMapFunctions(firestoreField(config));

    describe('from', () => {
      it('should return the default value when null/undefined is provided.', () => {
        expect(from(null)).toBe(defaultValue);
        expect(from(undefined)).toBe(defaultValue);
      });

      it('should return the converted value when a non-null is provided.', () => {
        expect(from(100)).toBe(fromDataValue);
      });
    });

    describe('to', () => {
      it('should return null when null/undefined is provided.', () => {
        expect(to(null)).toBe(null);
        expect(to(undefined)).toBe(null);
      });

      it('should return the converted value when a non-null is provided.', () => {
        expect(to(100)).toBe(toDataValue);
      });
    });
  });
});

describe('firestoreDate()', () => {
  const dateField = firestoreDate()!;

  it('should convert data from a date string to a Date.', () => {
    const dateString: ISO8601DateString = '2021-08-16T05:00:00.000Z';
    const value = new Date(dateString);

    const converted = dateField.from!.convert!(dateString);
    expect(converted).toBeDefined();
    expect(converted?.getTime()).toBe(value.getTime());
    expect(isValid(converted)).toBe(true);
  });

  it('should convert data from a date to a date string.', () => {
    const dateString = '2021-08-16T05:00:00.000Z';
    const value = new Date(dateString);

    const converted = dateField.to!.convert!(value);
    expect(converted).toBeDefined();
    expect(converted).toBe(dateString);
  });
});

interface TestUniqueItem {
  key: string;
}

describe('firestoreUniqueKeyedArray()', () => {
  const uniqueKeyedArrayConfig = firestoreUniqueKeyedArray<TestUniqueItem>({
    readKey: (x) => x.key
  });

  it('should filter out duplicate keyed data.', () => {
    const data = [{ key: 'a' }, { key: 'a' }, { key: 'b' }];

    const results = uniqueKeyedArrayConfig.from.convert(data);
    expect(results.length).toBe(2);
  });
});

describe('firestoreUniqueStringArray()', () => {
  const uniqueStringArrayConfig = firestoreUniqueStringArray({
    toLowercase: true
  });

  it('should filter and transform the data.', () => {
    const data = ['a', 'b', 'c', 'd'];

    const results = uniqueStringArrayConfig.from.convert([...data, ...data]);
    expect(results.length).toBe(data.length);
  });
});

describe('firestoreEncodedArray()', () => {
  const encodedArrayConfig = firestoreEncodedArray<TestUniqueItem, string>({
    convert: {
      toData: (model: TestUniqueItem) => model.key,
      fromData: (data: string) => ({ key: data })
    }
  });

  it('should convert to an encoded form for each value.', () => {
    const models = [{ key: 'a' }, { key: 'b' }];

    const results = encodedArrayConfig.to.convert(models) as string[];
    expect(results.length).toBe(models.length);
    expect(results[0]).toBe(models[0].key);
  });

  it('should convert to a deencoded form for each value.', () => {
    const data = ['a', 'b'];

    const results = encodedArrayConfig.from.convert(data);
    expect(results.length).toBe(data.length);
    expect(results[0].key).toBe(data[0]);
  });
});
