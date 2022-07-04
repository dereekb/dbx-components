import { LatLngString, asGetter, ISO8601DateString, Maybe, modelFieldMapFunctions, objectHasKey, stringTrimFunction, latLngString } from '@dereekb/util';
import { isValid } from 'date-fns';
import { FirestoreModelKeyGrantedRoleArrayMap } from '../collection';
import { DocumentSnapshot } from '../types';
import { snapshotConverterFunctions } from './snapshot';
import { firestoreArrayMap, firestoreDate, firestoreObjectArray, firestoreEnum, firestoreField, firestoreMap, firestoreModelKeyGrantedRoleArrayMap, firestoreEnumArray, firestoreUniqueKeyedArray, firestoreUniqueStringArray, firestoreNumber, firestoreSubObject, firestoreEncodedArray, firestoreString, DEFAULT_FIRESTORE_STRING_FIELD_VALUE, firestoreLatLngString } from './snapshot.field';

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

  it('should convert to a deencoded form for each value.', () => {
    const data = ['a', 'b'];

    const results = encodedArrayConfig.from.convert(data);
    expect(results.length).toBe(data.length);
    expect(results[0].key).toBe(data[0]);
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
