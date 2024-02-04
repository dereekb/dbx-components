import { encodeWebsiteFileLinkToWebsiteLinkEncodedData, type GrantedReadRole, type GrantedUpdateRole, type WebsiteFileLink } from '@dereekb/model';
import { type LatLngString, asGetter, type ISO8601DateString, type Maybe, modelFieldMapFunctions, objectHasKey, stringTrimFunction, latLngString, passThrough, primativeKeyStringDencoder, primativeKeyDencoder, type PrimativeKeyDencoderValueMap, bitwiseObjectDencoder, encodeBitwiseSet, unique } from '@dereekb/util';
import { isValid } from 'date-fns';
import { type FirestoreModelKeyGrantedRoleArrayMap } from '../collection';
import { type DocumentSnapshot } from '../types';
import { snapshotConverterFunctions } from './snapshot';
import {
  firestoreWebsiteFileLinkEncodedArray,
  firestoreArrayMap,
  firestoreDate,
  firestoreObjectArray,
  firestoreEnum,
  firestoreMap,
  firestoreModelKeyGrantedRoleArrayMap,
  firestoreEnumArray,
  firestoreUniqueKeyedArray,
  firestoreUniqueStringArray,
  firestoreNumber,
  optionalFirestoreBoolean,
  firestoreSubObject,
  firestoreEncodedArray,
  firestoreString,
  DEFAULT_FIRESTORE_STRING_FIELD_VALUE,
  firestoreLatLngString,
  firestoreField,
  optionalFirestoreDate,
  firestoreDencoderStringArray,
  firestoreDencoderArray,
  firestoreModelKeyEncodedGrantedRoleMap,
  firestoreDencoderMap,
  type FirestoreEncodedObjectMapFieldValueType,
  firestoreBitwiseObjectMap,
  optionalFirestoreString,
  optionalFirestoreEnum,
  optionalFirestoreNumber,
  optionalFirestoreArray
} from './snapshot.field';

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

    describe('with object', () => {
      describe('with object passed as default', () => {
        const defaultObject = { test: 'test' };

        const objectFieldConfig = firestoreField<typeof defaultObject, typeof defaultObject>({
          default: defaultObject,
          fromData: (x) => x,
          toData: (x) => x
        });

        const { from, to } = modelFieldMapFunctions(objectFieldConfig);

        it('from should return a copy of the default object value if null is passed.', () => {
          const result = from(null);

          expect(result).toBeDefined();
          expect(result.test).toBe(defaultObject.test);
          expect(result).not.toBe(defaultObject);
        });
      });
    });
  });
});

export interface TestSnapshotDefaults {
  date: Date;
  uniqueStringArray: string[];
}

export const testSnapshotDefaultsFields = {
  date: firestoreDate({ saveDefaultAsNow: true }),
  uniqueStringArray: firestoreUniqueStringArray()
};

export const testSnapshotDefaultsConverter = snapshotConverterFunctions<TestSnapshotDefaults>({
  fields: testSnapshotDefaultsFields
});

export function testSnapshotDefaultsSnapshotData(data: Partial<TestSnapshotDefaults>) {
  return {
    id: '0',
    ref: {
      id: '0'
    } as any,
    data: asGetter(data)
  } as DocumentSnapshot<TestSnapshotDefaults>;
}

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

  describe('saveDefaultAsNow = true', () => {
    it('should return a date for now if the date is undefined or null', () => {
      const result = testSnapshotDefaultsConverter.mapFunctions.from({} as any);
      const date = result.date;
      expect(date).toBeDefined();
    });
  });
});

describe('firestoreNumber()', () => {
  const numberField = firestoreNumber({ default: 0, defaultBeforeSave: 0 });

  it('should return the default value if the input is not defined.', () => {
    const { from, to } = modelFieldMapFunctions(numberField);

    const result = from(undefined);

    expect(result).toBe(0);
  });
});

describe('optionalFirestoreBoolean()', () => {
  describe('dontStoreIf', () => {
    const dontStoreIf = false;
    const field = optionalFirestoreBoolean({ dontStoreIf });

    it('should return null if the input value equals the dontStoreIf value', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(false);
      expect(result).toBe(null);
    });

    it('should return the boolean value if the input value does not equal the dontStoreIf value', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(true);
      expect(result).toBe(true);
    });
  });

  describe('dontStoreDefaultReturnValue', () => {
    const defaultReadValue = false;
    const field = optionalFirestoreBoolean({ defaultReadValue, dontStoreDefaultReadValue: true });

    it('should return null if the input value equals the defaultValue', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(defaultReadValue);
      expect(result).toBe(null);
    });
  });

  describe('defaultReadValue', () => {
    const defaultReadValue = false;
    const field = optionalFirestoreBoolean({ defaultReadValue });

    it('should return the default value if the input is undefined', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = from(undefined);
      expect(result).toBe(defaultReadValue);
    });

    it('should return the default value if the input is null', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = from(null);
      expect(result).toBe(defaultReadValue);
    });
  });
});

describe('optionalFirestoreDate()', () => {
  describe('dontStoreIf', () => {
    const dontStoreIf = new Date(0);
    const field = optionalFirestoreDate({ dontStoreIf });

    it('should return null if the input value equals the dontStoreIf value', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(dontStoreIf);
      expect(result).toBe(null);
    });

    it('should return the value if the input value does not equal the dontStoreIf value', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(new Date(1));
      expect(result).toBe(1);
    });
  });

  describe('defaultValue', () => {
    const defaultReadValue = new Date(0).toISOString();
    const field = optionalFirestoreDate({ defaultReadValue });

    it('should return the default value if the input is undefined', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = from(undefined);
      expect(result).toBe(defaultReadValue);
    });

    it('should return the default value if the input is null', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = from(null);
      expect(result).toBe(defaultReadValue);
    });
  });
});

interface TestFirestoreString {
  value: string;
}

describe('firestoreString()', () => {
  describe('with transform', () => {
    const stringField = firestoreString({ transform: stringTrimFunction });
    const converter = snapshotConverterFunctions<TestFirestoreString>({
      fields: {
        value: stringField
      }
    });

    it('should convert null values to the default', () => {
      const result = converter.mapFunctions.from({
        value: null
      });

      expect(result.value).toBe(DEFAULT_FIRESTORE_STRING_FIELD_VALUE);
    });

    describe('with custom default', () => {
      const defaultValue: string = 'test';
      const stringField = firestoreString({ default: defaultValue, transform: stringTrimFunction });
      const converter = snapshotConverterFunctions<TestFirestoreString>({
        fields: {
          value: stringField
        }
      });

      it('should convert null values to the configured default', () => {
        const result = converter.mapFunctions.from({
          value: null
        });

        expect(result.value).toBe(defaultValue);
      });
    });
  });
});

describe('optionalFirestoreString()', () => {
  describe('dontStoreIf', () => {
    const dontStoreIf: string = 'a';

    describe('value passed directly', () => {
      const field = optionalFirestoreString({ dontStoreIf });

      it('should return null if the input value equals the dontStoreIf value', () => {
        const { from, to } = modelFieldMapFunctions(field);

        const result = to(dontStoreIf);
        expect(result).toBe(null);
      });

      it('should return the value if the input value does not equal the dontStoreIf value', () => {
        const { from, to } = modelFieldMapFunctions(field);

        const result = to('aaa');
        expect(result).toBe('aaa');
      });
    });

    describe('decision function passed', () => {
      const field = optionalFirestoreString({ dontStoreIf: (x) => x === dontStoreIf });

      it('should return null if the input value equals the dontStoreIf value', () => {
        const { from, to } = modelFieldMapFunctions(field);

        const result = to(dontStoreIf);
        expect(result).toBe(null);
      });

      it('should return the value if the input value does not equal the dontStoreIf value', () => {
        const { from, to } = modelFieldMapFunctions(field);

        const result = to('aaa');
        expect(result).toBe('aaa');
      });
    });
  });

  describe('dontStoreDefaultReturnValue', () => {
    const defaultReadValue: string = 'a';
    const field = optionalFirestoreString({ defaultReadValue, dontStoreDefaultReadValue: true });

    it('should return null if the input value equals the defaultValue', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(defaultReadValue);
      expect(result).toBe(null);
    });
  });

  describe('defaultValue', () => {
    const defaultReadValue: string = 'a';

    describe('value passed directly', () => {
      const field = optionalFirestoreString({ defaultReadValue });

      it('should return the default value if the input is undefined', () => {
        const { from, to } = modelFieldMapFunctions(field);

        const result = from(undefined);
        expect(result).toBe(defaultReadValue);
      });

      it('should return the default value if the input is null', () => {
        const { from, to } = modelFieldMapFunctions(field);

        const result = from(null);
        expect(result).toBe(defaultReadValue);
      });
    });

    describe('getter function passed', () => {
      const field = optionalFirestoreString({ defaultReadValue: () => defaultReadValue });

      it('should return the default value if the input is undefined', () => {
        const { from, to } = modelFieldMapFunctions(field);

        const result = from(undefined);
        expect(result).toBe(defaultReadValue);
      });

      it('should return the default value if the input is null', () => {
        const { from, to } = modelFieldMapFunctions(field);

        const result = from(null);
        expect(result).toBe(defaultReadValue);
      });
    });
  });

  describe('transform', () => {
    describe('with dontStoreIf', () => {
      describe('inline transform config', () => {
        const dontStoreIf: string = 'a';
        const field = optionalFirestoreString({ dontStoreIf, transform: (x) => (x === dontStoreIf ? dontStoreIf : x.toUpperCase()) });

        it('should return null if the input value equals the dontStoreIf value', () => {
          const { from, to } = modelFieldMapFunctions(field);

          const result = to(dontStoreIf);
          expect(result).toBe(null);
        });

        it('should transform the value', () => {
          const { from, to } = modelFieldMapFunctions(field);

          const input = 'aaa';
          const expected = input.toUpperCase();

          const result = to(input);
          expect(result).toBe(expected);
        });
      });

      describe('transform config object', () => {
        const dontStoreIf: string = 'a';
        const field = optionalFirestoreString({ dontStoreIf, transform: { transform: (x) => (x === dontStoreIf ? dontStoreIf : x.toUpperCase()) } });

        it('should return null if the input value equals the dontStoreIf value', () => {
          const { from, to } = modelFieldMapFunctions(field);

          const result = to(dontStoreIf);
          expect(result).toBe(null);
        });

        it('should transform the value', () => {
          const { from, to } = modelFieldMapFunctions(field);

          const input = 'aaa';
          const expected = input.toUpperCase();

          const result = to(input);
          expect(result).toBe(expected);
        });
      });
    });
  });
});

describe('optionalFirestoreNumber()', () => {
  describe('dontStoreIf', () => {
    const dontStoreIf: number = 0;
    const field = optionalFirestoreNumber({ dontStoreIf });

    it('should return null if the input value equals the dontStoreIf value', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(dontStoreIf);
      expect(result).toBe(null);
    });

    it('should return the value if the input value does not equal the dontStoreIf value', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(1);
      expect(result).toBe(1);
    });
  });

  describe('dontStoreDefaultReturnValue', () => {
    const defaultReadValue: number = 0;
    const field = optionalFirestoreNumber({ defaultReadValue, dontStoreDefaultReadValue: true });

    it('should return null if the input value equals the defaultValue', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(defaultReadValue);
      expect(result).toBe(null);
    });
  });

  describe('defaultValue', () => {
    const defaultReadValue: number = 0;
    const field = optionalFirestoreNumber({ defaultReadValue });

    it('should return the default value if the input is undefined', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = from(undefined);
      expect(result).toBe(defaultReadValue);
    });

    it('should return the default value if the input is null', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = from(null);
      expect(result).toBe(defaultReadValue);
    });
  });

  describe('transform', () => {
    describe('with dontStoreIf', () => {
      describe('inline transform config', () => {
        const dontStoreIf: number = 0;
        const field = optionalFirestoreNumber({ dontStoreIf, transform: (x) => (x === dontStoreIf ? dontStoreIf : x + 1) });

        it('should return null if the input value equals the dontStoreIf value', () => {
          const { from, to } = modelFieldMapFunctions(field);

          const result = to(dontStoreIf);
          expect(result).toBe(null);
        });

        it('should transform the value', () => {
          const { from, to } = modelFieldMapFunctions(field);

          const input = 1;
          const expected = 1 + 1;

          const result = to(input);
          expect(result).toBe(expected);
        });
      });

      describe('transform config object', () => {
        const dontStoreIf: number = 0;
        const field = optionalFirestoreNumber({ dontStoreIf, transform: { transform: (x) => (x === dontStoreIf ? dontStoreIf : x + 1) } });

        it('should return null if the input value equals the dontStoreIf value', () => {
          const { from, to } = modelFieldMapFunctions(field);

          const result = to(dontStoreIf);
          expect(result).toBe(null);
        });

        it('should transform the value', () => {
          const { from, to } = modelFieldMapFunctions(field);

          const input = 1;
          const expected = 1 + 1;

          const result = to(input);
          expect(result).toBe(expected);
        });
      });
    });
  });
});

describe('optionalFirestoreArray()', () => {
  describe('filterUnique is provided', () => {
    const field = optionalFirestoreArray<string>({ filterUnique: unique });

    it('should return null if the input value is an empty array', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(['a', 'a', 'a']);
      expect(result?.length).toBe(1);
      expect(result![0]).toBe('a');

      const resultFrom = from(['a', 'a', 'a']);
      expect(resultFrom?.length).toBe(1);
      expect(resultFrom![0]).toBe('a');
    });
  });

  describe('dontStoreIfEmpty=true', () => {
    const field = optionalFirestoreArray({ dontStoreIfEmpty: true });

    it('should return null if the input value is an empty array', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to([]);
      expect(result).toBe(null);
    });
  });

  describe('dontStoreIf is provided', () => {
    const dontStoreIfIgnoreValue = 'a';
    const dontStoreIf = (x: string[]) => x.length > 0 && x[0] === dontStoreIfIgnoreValue;
    const field = optionalFirestoreArray<string>({ dontStoreIf });

    it('should return the value if it does not match the dontStoreIf function', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(['b']);
      expect(result).toBeDefined();
      expect(result?.length).toBe(1);
      expect(result![0]).toBe('b');
    });

    it('should return null if the input value matches the dontStoreIf function', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to([dontStoreIfIgnoreValue]);
      expect(result).toBe(null);
    });

    it('should return the empty array value if it doesnt match the dontStoreIf function', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to([]);
      expect(result).toBeDefined();
      expect(result?.length).toBe(0);
    });

    describe('dontStoreIfEmpty=true', () => {
      const field = optionalFirestoreArray<string>({ dontStoreIf, dontStoreIfEmpty: true });

      it('should return null if the input value matches the dontStoreIf function', () => {
        const { from, to } = modelFieldMapFunctions(field);

        const result = to([dontStoreIfIgnoreValue]);
        expect(result).toBe(null);
      });

      it('should return null if the input value is an empty array', () => {
        const { from, to } = modelFieldMapFunctions(field);

        const result = to([]);
        expect(result).toBe(null);
      });
    });
  });
});

enum TestEnum {
  A = 'a',
  B = 'b'
}

describe('optionalFirestoreEnum()', () => {
  describe('dontStoreIf', () => {
    const dontStoreIf: TestEnum = TestEnum.A;
    const field = optionalFirestoreEnum<TestEnum>({ dontStoreIf });

    it('should return null if the input value equals the dontStoreIf value', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(dontStoreIf);
      expect(result).toBe(null);
    });

    it('should return the value if the input value does not equal the dontStoreIf value', () => {
      const { from, to } = modelFieldMapFunctions(field);

      const result = to(TestEnum.B);
      expect(result).toBe(TestEnum.B);
    });
  });
});

interface TestOptionalFirestoreDate {
  value?: Maybe<Date>;
}

describe('optionalFirestoreDate()', () => {
  describe('with transform', () => {
    const dateField = optionalFirestoreDate();
    const converter = snapshotConverterFunctions<TestOptionalFirestoreDate>({
      fields: {
        value: dateField
      }
    });

    it('should set null when undefined', () => {
      const result = converter.mapFunctions.from({});

      expect(result.value).toBe(undefined);
    });

    it('should pass through null values', () => {
      const result = converter.mapFunctions.from({
        value: null
      });

      expect(result.value).toBeUndefined();
    });

    it('should pass through undefined values', () => {
      const result = converter.mapFunctions.from({
        value: undefined
      });

      expect(result.value).toBeUndefined();
    });
  });
});

type TestFirestoreEnumType = 'a' | 'b' | 'c';

describe('firestoreEnum()', () => {
  const enumField = firestoreEnum<TestFirestoreEnumType>({ default: 'a' });

  it('should return the default value if the input is not defined.', () => {
    const { from, to } = modelFieldMapFunctions(enumField);

    const result = from(undefined);

    expect(result).toBe('a');
  });

  it('should pass the enum values through.', () => {
    const { from, to } = modelFieldMapFunctions(enumField);

    const result = from('a');

    expect(result).toBe('a');
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

describe('firestoreEnumArray()', () => {
  const firestoreEnumArrayConfig = firestoreEnumArray<TestFirestoreEnumType>();

  it('should filter out duplicate keyed data.', () => {
    const data: TestFirestoreEnumType[] = ['a', 'b', 'b'];

    const results = firestoreEnumArrayConfig.from.convert(data);
    expect(results.length).toBe(2);
  });

  it('should return an empty array when converting to data.', () => {
    const { from, to } = modelFieldMapFunctions(firestoreEnumArrayConfig);

    const result = from(undefined);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
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

  it('from should convert null to the default empty array', () => {
    const result = testSnapshotDefaultsConverter.from(testSnapshotDefaultsSnapshotData({}));

    expect(Array.isArray(result.uniqueStringArray)).toBe(true);
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

  it('should convert to a decoded form for each value.', () => {
    const data = ['a', 'b'];

    const results = encodedArrayConfig.from.convert(data);
    expect(results.length).toBe(data.length);
    expect(results[0].key).toBe(data[0]);
  });

  describe('declarations', () => {
    describe('firestoreWebsiteFileLinkEncodedArray()', () => {
      const exampleWithAll: WebsiteFileLink = {
        type: 't',
        mime: 'test/test',
        name: 'test-name',
        data: 'https://components.dereekb.com/'
      };

      interface TestWebsiteFileLinkObject {
        l: WebsiteFileLink[];
      }

      const converter = snapshotConverterFunctions<TestWebsiteFileLinkObject>({
        fields: {
          l: firestoreWebsiteFileLinkEncodedArray()
        }
      });

      it('should convert to an encoded form for each value.', () => {
        const snapshot: DocumentSnapshot<TestWebsiteFileLinkObject> = {
          id: '0',
          ref: {
            id: '0'
          } as any,
          data() {
            return {
              l: [encodeWebsiteFileLinkToWebsiteLinkEncodedData(exampleWithAll)]
            } as any;
          }
        };

        const result = converter.from(snapshot);
        expect(result.l.length).toBe(1);
        expect(result.l[0].data).toBe(exampleWithAll.data);
      });

      it('should convert to a decoded form for each value.', () => {
        const data = {
          l: [exampleWithAll]
        };

        const result = converter.to(data);

        expect(result.l.length).toBe(data.l.length);
        expect(result.l[0]).toBe(encodeWebsiteFileLinkToWebsiteLinkEncodedData(exampleWithAll));
      });
    });
  });
});

describe('firestoreDencoderArray()', () => {
  const firestoreMapConfig = firestoreDencoderArray<number, string>({
    dencoder: primativeKeyDencoder<number, string>({
      values: {
        a: 0,
        b: 1
      }
    })
  });

  it('should encode the values.', () => {
    const test = [0, 1, 2];
    const results = firestoreMapConfig.to.convert(test) as string[];

    expect(results).toBeDefined();
    expect(Array.isArray(results));
    expect(results.length).toBe(2);
    expect(results[0]).toBe('a');
    expect(results[1]).toBe('b');
  });
});

export type TestDencoderRole = GrantedReadRole | GrantedUpdateRole;

export enum TestDencoderRoleCodes {
  READ = 'r',
  UPDATE = 'u'
}

export const ROLE_CODE_MAP: PrimativeKeyDencoderValueMap<TestDencoderRole, TestDencoderRoleCodes> = {
  r: 'read',
  u: 'update'
};

export const ROLE_DENCODER = primativeKeyStringDencoder({
  dencoder: primativeKeyDencoder({
    values: ROLE_CODE_MAP
  })
});

export interface TestDencoderStringArrayObject {
  value: TestDencoderRole[];
}

describe('firestoreDencoderStringArray()', () => {
  const firestoreDencoderField = firestoreDencoderStringArray({
    dencoder: ROLE_DENCODER
  });

  it('should encode the values.', () => {
    const test: TestDencoderRole[] = ['read', 'update'];
    const results = firestoreDencoderField.to.convert(test);

    expect(results).toBeDefined();
    expect(results).toBe('ru');
  });

  describe('converter', () => {
    const converter = snapshotConverterFunctions<TestDencoderStringArrayObject>({
      fields: {
        value: firestoreDencoderField
      }
    });

    it('should encode the values.', () => {
      const object: TestDencoderStringArrayObject = {
        value: ['read', 'update']
      };

      const result = converter.to(object);

      expect(result.value).toBe('ru');
    });

    it('should decode the values.', () => {
      const object: TestDencoderStringArrayObject = {
        value: ['read', 'update']
      };

      const encoded = converter.to(object);
      const decoded = converter.mapFunctions.from(encoded);

      expect(decoded.value).toContain('read');
      expect(decoded.value).toContain('update');
    });
  });
});

describe('firestoreMap()', () => {
  const firestoreMapConfig = firestoreMap<Maybe<number>, string>();

  it('should filter out empty values from the final map.', () => {
    const test = {
      hasValue: 0,
      isEmpty: null
    };

    const results = firestoreMapConfig.to.convert(test) as Partial<typeof test>;

    expect(results).toBeDefined();
    expect(results.hasValue).toBe(test.hasValue);
    expect(objectHasKey(results, 'hasValue')).toBe(true);
    expect(objectHasKey(results, 'isEmpty')).toBe(false);
  });
});

export type TestSnapshotGrantedRoles = GrantedReadRole | GrantedUpdateRole;

export type TestSnapshotRolesMap = FirestoreModelKeyGrantedRoleArrayMap<TestSnapshotGrantedRoles>;

export interface TestSnapshotRolesObject {
  r: TestSnapshotRolesMap;
}

export enum TestRoleCodeEnum {
  READ = 'r',
  UPDATE = 'u'
}

export const TEST_ROLE_CODE_MAP: PrimativeKeyDencoderValueMap<TestSnapshotGrantedRoles, TestRoleCodeEnum> = {
  r: 'read',
  u: 'update'
};

export const TEST_ROLE_DENCODER = primativeKeyStringDencoder({
  dencoder: primativeKeyDencoder({
    values: TEST_ROLE_CODE_MAP
  })
});

describe('firestoreModelKeyEncodedGrantedRoleMap()', () => {
  const converter = snapshotConverterFunctions<TestSnapshotRolesObject>({
    fields: {
      r: firestoreModelKeyEncodedGrantedRoleMap<TestSnapshotGrantedRoles, TestRoleCodeEnum>(TEST_ROLE_DENCODER)
    }
  });

  // TODO: add tests
});

describe('firestoreArrayMap()', () => {
  const firestoreArrayMapConfig = firestoreArrayMap<number, string>();

  it('should filter out empty arrays from the final map.', () => {
    const test = {
      hasValue: [0],
      isEmpty: []
    };

    const results = firestoreArrayMapConfig.to.convert(test) as Partial<typeof test>;

    expect(results).toBeDefined();
    expect(results.hasValue).toContain(test.hasValue[0]);
    expect(objectHasKey(results, 'hasValue')).toBe(true);
    expect(objectHasKey(results, 'isEmpty')).toBe(false);
  });
});

describe('firestoreModelKeyGrantedRoleArrayMap()', () => {
  const firestoreArrayMapConfig = firestoreModelKeyGrantedRoleArrayMap();

  it('should filter out empty arrays from the final map.', () => {
    const test: FirestoreModelKeyGrantedRoleArrayMap<string> = {
      amodelpath: ['true', ''],
      emptymodelpath: []
    };

    const results = firestoreArrayMapConfig.to.convert(test) as Partial<typeof test>;

    expect(results).toBeDefined();
    expect(results.amodelpath).toContain('true');
    expect(results.amodelpath).not.toContain('');
    expect(objectHasKey(results, 'amodelpath')).toBe(true);
    expect(objectHasKey(results, 'emptymodelpath')).toBe(false);
  });
});

export interface TestFirestoreSubObjectParent {
  object: TestFirestoreSubObject;
}

export interface TestFirestoreSubObjectParentWithArray {
  objects: TestFirestoreSubObject[];
}

export interface TestFirestoreSubObject {
  date: Date;
  uniqueStringArray: string[];
}

describe('firestoreObjectArray()', () => {
  it('should allowed firestoreField', () => {
    const fieldConfig = firestoreField<TestFirestoreSubObject, TestFirestoreSubObject>({
      default: {
        date: new Date(),
        uniqueStringArray: []
      },
      fromData: passThrough,
      toData: passThrough
    });

    const array = firestoreObjectArray<TestFirestoreSubObject, TestFirestoreSubObject>({
      firestoreField: fieldConfig
    });

    const result = array.from.convert([{ date: new Date(), uniqueStringArray: [] }]);
    expect(result).toBeDefined();
    expect(result.length).toBe(1);
  });
});

export interface TestFirestoreDencoderMapObject {
  value: Record<string, TestDencoderRole[]>;
}

describe('firestoreDencoderMap()', () => {
  const firestoreDencoderMapField = firestoreDencoderMap<TestDencoderRole, TestDencoderRoleCodes>({
    dencoder: ROLE_DENCODER
  });

  it('should encode the values.', () => {
    const testValues: TestDencoderRole[] = ['read', 'update'];
    const testMap: FirestoreEncodedObjectMapFieldValueType<TestDencoderRole[], 'x'> = {
      x: testValues
    };

    const results = firestoreDencoderMapField.to.convert(testMap);

    expect(results).toBeDefined();
    expect(results?.x).toBeDefined();
    expect(typeof results?.x).toBe('string');
  });

  describe('converter', () => {
    const converter = snapshotConverterFunctions<TestFirestoreDencoderMapObject>({
      fields: {
        value: firestoreDencoderMapField
      }
    });

    it('should encode the values.', () => {
      const object: TestFirestoreDencoderMapObject = {
        value: {
          x: ['read', 'update']
        }
      };

      const result = converter.to(object);

      expect(result.value.x).toBe('ru');
    });

    it('should decode the values.', () => {
      const object: TestFirestoreDencoderMapObject = {
        value: {
          x: ['read', 'update']
        }
      };

      const encoded = converter.to(object);
      const decoded = converter.mapFunctions.from(encoded);

      expect(decoded.value).toBeDefined();
      expect(typeof decoded.value).toBe('object');
      expect(decoded.value.x).toBeDefined();
      expect(decoded.value.x).toContain('read');
      expect(decoded.value.x).toContain('update');
    });
  });
});

interface TestFirestoreBitwiseObjectMapObject {
  value: Record<string, TestFirestoreBitwiseObjectMapEmbeddedObject>;
}

enum BitwiseEnumValue {
  ONE_ENABLED = 0,
  TWO_ENABLED = 1,
  THREE_ENABLED = 2
}

interface TestFirestoreBitwiseObjectMapEmbeddedObject {
  one?: boolean;
  two?: boolean;
  three?: boolean;
}

describe('firestoreBitwiseObjectMap()', () => {
  const dencoder = bitwiseObjectDencoder<TestFirestoreBitwiseObjectMapEmbeddedObject, BitwiseEnumValue>({
    maxIndex: 3,
    toSetFunction: (x) => {
      const set = new Set<BitwiseEnumValue>();

      if (x.one) {
        set.add(BitwiseEnumValue.ONE_ENABLED);
      }

      if (x.two) {
        set.add(BitwiseEnumValue.TWO_ENABLED);
      }

      if (x.three) {
        set.add(BitwiseEnumValue.THREE_ENABLED);
      }

      return set;
    },
    fromSetFunction: (x) => {
      const object: TestFirestoreBitwiseObjectMapEmbeddedObject = {};

      if (x.has(BitwiseEnumValue.ONE_ENABLED)) {
        object.one = true;
      }

      if (x.has(BitwiseEnumValue.TWO_ENABLED)) {
        object.two = true;
      }

      if (x.has(BitwiseEnumValue.THREE_ENABLED)) {
        object.three = true;
      }

      return object;
    }
  });

  const firestoreBitwiseObjectMapField = firestoreBitwiseObjectMap<TestFirestoreBitwiseObjectMapEmbeddedObject>({
    dencoder
  });

  it('should encode the values.', () => {
    const testValues: Set<BitwiseEnumValue> = new Set<BitwiseEnumValue>([BitwiseEnumValue.ONE_ENABLED, BitwiseEnumValue.TWO_ENABLED]);
    const testMap: FirestoreEncodedObjectMapFieldValueType<TestFirestoreBitwiseObjectMapEmbeddedObject, 'x'> = {
      x: {
        one: true,
        two: true
      }
    };

    const results = firestoreBitwiseObjectMapField.to.convert(testMap);

    expect(results).toBeDefined();
    expect(results?.x).toBeDefined();
    expect(typeof results?.x).toBe('number'); // encoded to number
    expect(results?.x).toBe(3); // encoded to number
  });

  describe('converter', () => {
    const converter = snapshotConverterFunctions<TestFirestoreBitwiseObjectMapObject>({
      fields: {
        value: firestoreBitwiseObjectMapField
      }
    });

    it('should encode the values.', () => {
      const object: TestFirestoreBitwiseObjectMapObject = {
        value: {
          x: {
            one: true,
            two: true
          }
        }
      };

      const result = converter.to(object);
      expect(result.value.x).toBe(encodeBitwiseSet(new Set<BitwiseEnumValue>([BitwiseEnumValue.ONE_ENABLED, BitwiseEnumValue.TWO_ENABLED])));
    });

    it('should encode and decode and then encode the values back to the original', () => {
      const object: TestFirestoreBitwiseObjectMapObject = {
        value: {
          x: {
            one: true,
            two: true
          },
          y: {
            one: true,
            three: true
          }
        }
      };

      const encoded = converter.to(object);
      const decoded = converter.mapFunctions.from(encoded);

      expect(decoded.value).toBeDefined();
      expect(typeof decoded.value).toBe('object');
      expect(decoded.value.x).toBeDefined();
      expect(decoded.value.y).toBeDefined();
      expect(decoded.value.x.one).toBe(true);
      expect(decoded.value.x.two).toBe(true);
      expect(decoded.value.y.one).toBe(true);
      expect(decoded.value.y.three).toBe(true);
    });
  });
});

describe('firestoreSubObject()', () => {
  const testObject = {
    date: new Date(),
    uniqueStringArray: ['a', 'b']
  };

  const testFirestoreSubObjectField = firestoreSubObject<TestFirestoreSubObject>({
    objectField: testSnapshotDefaultsConverter
  });

  describe('with firestoreObjectArray', () => {
    const testFirestoreSubObjectParentWithArrayConverter = snapshotConverterFunctions<TestFirestoreSubObjectParentWithArray>({
      fields: {
        objects: firestoreObjectArray<TestFirestoreSubObject>({
          objectField: testSnapshotDefaultsConverter
        })
      }
    });

    const parent = {
      objects: [testObject, testObject]
    };

    it('can pass a FirestoreSubObjectFieldMapFunctionsConfig to firestoreObjectArray()', () => {
      expect(testFirestoreSubObjectField.mapFunctions).toBeDefined();

      const result = firestoreObjectArray<TestFirestoreSubObject>({
        objectField: testFirestoreSubObjectField
      });

      expect(result).toBeDefined();
    });

    it('should convert an array of objects', () => {
      const data = testFirestoreSubObjectParentWithArrayConverter.mapFunctions.to(parent);

      expect(data).toBeDefined();
      expect(data.objects).toBeDefined();
      expect(data.objects.length).toBe(parent.objects.length);
      expect(data.objects[0].date).toBeDefined();
      expect(data.objects[0].uniqueStringArray).toBeDefined();
      expect(data.objects[1].date).toBeDefined();
      expect(data.objects[1].uniqueStringArray).toBeDefined();

      const result = testFirestoreSubObjectParentWithArrayConverter.mapFunctions.from(data);

      expect(result).toBeDefined();
      expect(result.objects).toBeDefined();
      expect(result.objects.length).toBe(parent.objects.length);
      expect(result.objects[0].date).toBeDefined();
      expect(result.objects[0].date).toBeSameSecondAs(testObject.date);
      expect(result.objects[0].uniqueStringArray).toBeDefined();
      expect(result.objects[0].uniqueStringArray).toContain(testObject.uniqueStringArray[0]);
      expect(result.objects[0].uniqueStringArray).toContain(testObject.uniqueStringArray[1]);
      expect(result.objects[1].date).toBeDefined();
      expect(result.objects[1].date).toBeSameSecondAs(testObject.date);
      expect(result.objects[1].uniqueStringArray).toBeDefined();
      expect(result.objects[1].uniqueStringArray).toContain(testObject.uniqueStringArray[0]);
      expect(result.objects[1].uniqueStringArray).toContain(testObject.uniqueStringArray[1]);
    });
  });

  describe('converter', () => {
    const testFirestoreSubObjectParentConverter = snapshotConverterFunctions<TestFirestoreSubObjectParent>({
      fields: {
        object: testFirestoreSubObjectField
      }
    });

    const parent = {
      object: testObject
    };

    it('should convert from an empty data object and return the default value', () => {
      const result = testFirestoreSubObjectParentConverter.mapFunctions.from({});

      expect(result).toBeDefined();
      expect(result.object).toBeDefined();
      expect(result.object.date).toBeDefined();
      expect(result.object.uniqueStringArray).toBeDefined();
      expect(result.object.uniqueStringArray.length).toBe(0);
    });

    it('should convert an object and back.', () => {
      const data = testFirestoreSubObjectParentConverter.mapFunctions.to(parent);

      expect(data).toBeDefined();
      expect(data.object).toBeDefined();
      expect(data.object.date).toBeDefined();
      expect(data.object.uniqueStringArray).toBeDefined();

      const result = testFirestoreSubObjectParentConverter.mapFunctions.from(data);

      expect(result).toBeDefined();
      expect(result.object).toBeDefined();
      expect(result.object.date).toBeDefined();
      expect(result.object.date).toBeSameSecondAs(testObject.date);
      expect(result.object.uniqueStringArray).toBeDefined();
      expect(result.object.uniqueStringArray).toContain(testObject.uniqueStringArray[0]);
      expect(result.object.uniqueStringArray).toContain(testObject.uniqueStringArray[1]);
    });

    describe('with saveDefaultObject unset', () => {
      it('should convert an empty value to an empty object and have null for the embedded object.', () => {
        const result = testFirestoreSubObjectParentConverter.mapFunctions.to({} as typeof parent);

        expect(result).toBeDefined();
        expect(result.object).toBe(null);
      });
    });

    describe('with saveDefaultObject=true', () => {
      const testFirestoreSubObjectFieldConverterWithSaveDefaultObject = snapshotConverterFunctions<TestFirestoreSubObjectParent>({
        fields: {
          object: firestoreSubObject<TestFirestoreSubObject>({
            objectField: testSnapshotDefaultsConverter,
            saveDefaultObject: true
          })
        }
      });

      it('should convert an empty value to an object with a default value for the embedded object.', () => {
        const result = testFirestoreSubObjectFieldConverterWithSaveDefaultObject.mapFunctions.to({} as typeof parent);

        expect(result).toBeDefined();
        expect(result.object).not.toBe(null);
        expect(result.object).toBeDefined();
        expect(result.object.date).toBeDefined();
        expect(result.object.uniqueStringArray).toBeDefined();
      });
    });
  });
});

interface TestFirestoreLatLngString {
  value: LatLngString;
}

describe('firestoreLatLngString()', () => {
  const defaultValue = '1,1';
  const precision = 3;

  const latLngStringField = firestoreLatLngString({ precision, default: defaultValue });
  const converter = snapshotConverterFunctions<TestFirestoreLatLngString>({
    fields: {
      value: latLngStringField
    }
  });

  it('should convert with the input precision.', () => {
    const expectedValue = latLngString(50.123, 50.123);
    const value = latLngString(50.123456, 50.123456);

    const result = converter.mapFunctions.from({
      value
    });

    expect(result.value).toBe(expectedValue);
  });

  it('should convert null to the default value.', () => {
    const result = converter.mapFunctions.from({
      value: null
    });

    expect(result.value).toBe(defaultValue);
  });
});
