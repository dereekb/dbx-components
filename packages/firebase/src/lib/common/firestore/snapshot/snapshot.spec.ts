import { asGetter } from '@dereekb/util';
import { isDate } from 'date-fns';
import { type DocumentSnapshot } from '../types';
import { snapshotConverterFunctions } from './snapshot';
import { firestoreBoolean, firestoreDate, firestoreNumber, firestoreObjectArray, firestoreString, firestoreSubObject, firestoreUniqueStringArray } from './snapshot.field';

export interface TestSnapshotDefaultsEmbeddedDefaults {
  date: Date;
  defaultDate: Date;
  number: number;
  numberWithStore: number;
  uniqueStringArray: string[];
  uniqueStringArrayWithDefaultValue: string[];
}

export const testSnapshotDefaultsEmbeddedDefaults = firestoreSubObject<TestSnapshotDefaultsEmbeddedDefaults>({
  objectField: {
    fields: {
      date: firestoreDate({ saveDefaultAsNow: true }),
      defaultDate: firestoreDate({}),
      number: firestoreNumber({ default: 0 }),
      numberWithStore: firestoreNumber({ default: 0, saveDefault: true }),
      uniqueStringArray: firestoreUniqueStringArray(),
      uniqueStringArrayWithDefaultValue: firestoreUniqueStringArray({ default: () => ['test'] })
    }
  }
});

export interface TestSnapshotDefaults {
  date: Date;
  defaultDate: Date;
  number: number;
  numberWithStore: number;
  uniqueStringArray: string[];
  uniqueStringArrayWithDefaultValue: string[];
  embedded: TestSnapshotDefaultsEmbeddedDefaults[];
}

export const testSnapshotDefaultsConverter = snapshotConverterFunctions<TestSnapshotDefaults>({
  fields: {
    date: firestoreDate({ saveDefaultAsNow: true }),
    defaultDate: firestoreDate({}),
    number: firestoreNumber({ default: 0 }),
    numberWithStore: firestoreNumber({ default: 0, saveDefault: true }),
    uniqueStringArray: firestoreUniqueStringArray(),
    uniqueStringArrayWithDefaultValue: firestoreUniqueStringArray({ default: () => ['test'] }),
    embedded: firestoreObjectArray({
      objectField: testSnapshotDefaultsEmbeddedDefaults
    })
  }
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

describe('snapshotConverterFunctions()', () => {
  it('should create conversion functions for the input.', () => {
    const result = snapshotConverterFunctions({
      fields: {
        string: firestoreString({ default: '' }),
        test: firestoreBoolean({ default: true })
      }
    });

    expect(result.from).toBeDefined();
    expect(result.to).toBeDefined();
    expect(result.fromFirestore).toBeDefined();
    expect(result.toFirestore).toBeDefined();
  });

  describe('functions', () => {
    describe('from() - from data', () => {
      it('should apply any beforeSaveDefault values to the data.', () => {
        const data = {};

        const x = testSnapshotDefaultsConverter.from(testSnapshotDefaultsSnapshotData(data));

        expect(x.date).toBeDefined();
        expect(x.numberWithStore).toBe(0);
        expect(isDate(x.date)).toBe(true);
      });

      it('should apply default values when converting from an empty object', () => {
        const data = {};
        const result = testSnapshotDefaultsConverter.from(testSnapshotDefaultsSnapshotData(data));

        expect(result.date).not.toBeNull();
        expect(isDate(result.date)).toBe(true);
        expect(result.number).toBe(0);
        expect(result.numberWithStore).toBe(0);
        expect(Array.isArray(result.uniqueStringArray)).toBe(true);
      });

      it('should apply default values when converting from an object with null values', () => {
        const data = { number: null, numberWithStore: null, uniqueStringArray: null, uniqueStringArrayWithDefaultValue: null };
        const result = testSnapshotDefaultsConverter.from(testSnapshotDefaultsSnapshotData(data as any));

        expect(result.date).not.toBeNull();
        expect(isDate(result.date)).toBe(true);
        expect(result.number).toBe(0);
        expect(result.numberWithStore).toBe(0);
        expect(Array.isArray(result.uniqueStringArray)).toBe(true);
        expect(Array.isArray(result.uniqueStringArrayWithDefaultValue)).toBe(true);
        expect(result.uniqueStringArrayWithDefaultValue[0]).toBe('test');
      });

      it('should exclude all unknown fields from the input data.', () => {
        const data = {
          date: new Date(),
          number: 100,
          uniqueStringArray: null,
          a: 'dgsdf',
          b: 5,
          c: new Date()
        };

        const x = testSnapshotDefaultsConverter.from(testSnapshotDefaultsSnapshotData(data as any)) as unknown as typeof data;

        expect(x.date).toBeDefined();
        expect(isDate(x.date)).toBe(true);
        expect(x.number).toBe(100);

        expect(x.a).not.toBeDefined();
        expect(x.b).not.toBeDefined();
        expect(x.c).not.toBeDefined();

        expect(Object.keys(x).length).toBe(7);
      });
    });

    describe('to() - to data', () => {
      it('should apply the default value from date if null values are passed', () => {
        const result = testSnapshotDefaultsConverter.to({ date: null } as any);
        expect(result.defaultDate).toBeNull(); // saves nothing
        expect(result.date).not.toBeNull();
        expect(typeof result.date).toBe('string');
      });

      it('should apply the beforeSaveDefault from uniqueStringArray if an empty object is passed', () => {
        const result = testSnapshotDefaultsConverter.to({} as any);

        expect(result.date).not.toBeNull();
        expect(typeof result.date).toBe('string');
        expect(result.uniqueStringArray).toBeNull(); // storing null is ok
      });

      it('should apply the default value from uniqueStringArray if null values are passed', () => {
        const result = testSnapshotDefaultsConverter.to({ date: null, uniqueStringArray: null } as any);
        expect(result.date).not.toBeNull();
        expect(typeof result.date).toBe('string');
        expect(result.uniqueStringArray).toBeNull();
      });

      describe('embedded', () => {
        const result = testSnapshotDefaultsConverter.to({ embedded: [{}] } as any);
        expect(result.embedded.length).toBe(1);

        const first = result.embedded[0];

        expect(result.defaultDate).toBeNull();
        expect(typeof first.date).toBe('string');
        expect(first.uniqueStringArray).not.toBeDefined();
      });
    });
  });
});
