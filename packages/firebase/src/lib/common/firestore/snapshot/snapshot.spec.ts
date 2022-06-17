import { asGetter } from '@dereekb/util';
import { isDate } from 'date-fns';
import { DocumentSnapshot } from '../types';
import { snapshotConverterFunctions } from './snapshot';
import { firestoreBoolean, firestoreDate, firestoreString, firestoreUniqueStringArray } from './snapshot.field';

export interface TestSnapshotDefaults {
  date: Date;
  uniqueStringArray: string[];
  uniqueStringArrayWithDefaultValue: string[];
}

export const testSnapshotDefaultsConverter = snapshotConverterFunctions<TestSnapshotDefaults>({
  fields: {
    date: firestoreDate({ saveDefaultAsNow: true }),
    uniqueStringArray: firestoreUniqueStringArray(),
    uniqueStringArrayWithDefaultValue: firestoreUniqueStringArray({ default: () => ['test'] })
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
        expect(isDate(x.date)).toBe(true);
      });

      it('should apply default values when converting from an empty object', () => {
        const data = {};
        const result = testSnapshotDefaultsConverter.from(testSnapshotDefaultsSnapshotData(data));

        expect(result.date).not.toBeNull();
        expect(isDate(result.date)).toBe(true);
        expect(Array.isArray(result.uniqueStringArray)).toBe(true);
      });

      it('should apply default values when converting from an object with null values', () => {
        const data = { uniqueStringArray: null, uniqueStringArrayWithDefaultValue: null };
        const result = testSnapshotDefaultsConverter.from(testSnapshotDefaultsSnapshotData(data as any));

        expect(result.date).not.toBeNull();
        expect(isDate(result.date)).toBe(true);
        expect(Array.isArray(result.uniqueStringArray)).toBe(true);
        expect(Array.isArray(result.uniqueStringArrayWithDefaultValue)).toBe(true);
        expect(result.uniqueStringArrayWithDefaultValue[0]).toBe('test');
      });

      it('should exclude all unknown fields from the input data.', () => {
        const data = {
          date: new Date(),
          uniqueStringArray: null,
          a: 'dgsdf',
          b: 5,
          c: new Date()
        };

        const x = testSnapshotDefaultsConverter.from(testSnapshotDefaultsSnapshotData(data as any)) as unknown as typeof data;

        expect(x.date).toBeDefined();
        expect(isDate(x.date)).toBe(true);

        expect(x.a).not.toBeDefined();
        expect(x.b).not.toBeDefined();
        expect(x.c).not.toBeDefined();

        expect(Object.keys(x).length).toBe(3);
      });
    });

    describe('to() - to data', () => {
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
    });
  });
});
