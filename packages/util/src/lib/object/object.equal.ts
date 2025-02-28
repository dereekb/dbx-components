import { type FieldOfType } from '../key';
import { type EqualityComparatorFunction } from '../value/comparator';
import { type Building } from '../value/build';
import { isDate, isEqualDate } from '../date';
import { isIterable } from '../iterable';
import { setsAreEquivalent } from '../set/set';
import { type FilterFromPOJOFunction } from './object.filter.pojo';
import { MAP_IDENTITY } from '../value/map';

/**
 * Performs a deep comparison to check if all values on the input filters are equal.
 *
 * Recursively compares Arrays, Objects, Maps, Sets, Primatives, and Dates.
 */
export function areEqualPOJOValues<F>(a: F, b: F): boolean {
  return areEqualPOJOValuesUsingPojoFilter(a, b, MAP_IDENTITY);
}

/**
 * Performs a deep comparison to check if all values on the input filters are equal. Each input is run through the pojo filter
 *
 * Recursively compares Arrays, Objects, Maps, Sets, Primatives, and Dates.
 */
export function areEqualPOJOValuesUsingPojoFilter<F>(a: F, b: F, pojoFilter: FilterFromPOJOFunction<F>): boolean {
  // check self
  if (a === b) {
    return true;
  }

  // run pojo filter before comparison
  a = pojoFilter(a, true);
  b = pojoFilter(b, true);

  // check one value is nullish and other is not
  if ((a == null || b == null) && (a || b)) {
    return false;
  }

  // object check
  if (typeof a === 'object') {
    // check if they are arrays
    if (isIterable(a, false)) {
      if (Array.isArray(a)) {
        if (a.length !== (b as any[]).length) {
          return false;
        }

        const firstInequalityIndex = a.findIndex((aValue, i) => {
          const bValue = (b as any[])[i];
          return !areEqualPOJOValuesUsingPojoFilter(aValue, bValue, pojoFilter);
        });

        return firstInequalityIndex === -1;
      } else if (a instanceof Set) {
        return setsAreEquivalent(a, b as Set<any>);
      } else if (a instanceof Map) {
        const bMap = b as Map<any, any>;

        if (a.size !== bMap.size) {
          return false;
        }

        const firstInequalityIndex = Array.from(a.entries()).findIndex(([key, aValue]) => {
          const bValue = bMap.get(key);
          return !areEqualPOJOValuesUsingPojoFilter(aValue, bValue, pojoFilter);
        });

        return firstInequalityIndex === -1;
      }
    } else if (typeof b === 'object') {
      // check contructors/types
      const firstType = a?.constructor.name;
      const secondType = b?.constructor.name;

      if (firstType !== secondType) {
        return false; // false if not the same type
      }

      // check Date comparison
      if (isDate(a)) {
        return isEqualDate(a, b as Date);
      }

      // check object comparison via keys
      const aObject = a as Record<string, any>;
      const bObject = b as Record<string, any>;

      const aKeys = Object.keys(aObject);
      const bKeys = Object.keys(bObject);

      // compare keys
      if (aKeys.length === bKeys.length) {
        const firstInequalityIndex = aKeys.findIndex((key) => {
          const aKeyValue = aObject[key];
          const bKeyValue = bObject[key];
          return !areEqualPOJOValuesUsingPojoFilter(aKeyValue, bKeyValue, pojoFilter);
        });

        if (firstInequalityIndex === -1) {
          return true; // is equal if no non-matching key/value pair is found
        }
      }
    }
  }

  // still not equal if down here
  return false;
}

// MARK: ObjectFieldEqualityChecker
/**
 * Configuration for an ObjectFieldEqualityChecker.
 */
export interface ObjectFieldEqualityCheckerConfig<T extends object> {
  /**
   * Fields to capture as part of the compressor.
   */
  readonly fields: (ObjectFieldEqualityCheckerFieldConfig<T, any> | FieldOfType<T>)[];
  /**
   * Default equality function to use when a field's equality function is not provided.
   */
  readonly defaultEqualityFunction?: EqualityComparatorFunction<unknown>;
}

/**
 * Field configration for a single field of a ObjectFieldEqualityCheckerConfig.
 */
export interface ObjectFieldEqualityCheckerFieldConfig<T extends object, K extends FieldOfType<T>> {
  /**
   * Field name to compare.
   */
  readonly fieldName: K;
  /**
   * Custom equality comparator for the field.
   */
  readonly isEqual: EqualityComparatorFunction<T[K]>;
}

/**
 * Results of an ObjectFieldEqualityChecker.
 */
export interface ObjectFieldEqualityCheckResults<T extends object> {
  /**
   * First compared object.
   */
  readonly a: T;
  /**
   * Second compared object.
   */
  readonly b: T;
  /**
   * Returns true if the object has no unequal fields.
   */
  readonly isEqual: boolean;
  /**
   * Fields that are considered equal.
   */
  readonly equalFields: FieldOfType<T>[];
  /**
   * Fields that are considered unequal.
   */
  readonly unequalFields: FieldOfType<T>[];
}

/**
 * Function used to check if two objects are considered equal.
 */
export type ObjectFieldEqualityChecker<T extends object> = ((a: Partial<T>, b: Partial<T>) => ObjectFieldEqualityCheckResults<T>) & {
  readonly _fields: Map<keyof T, ObjectFieldEqualityCheckerFieldConfig<T, any>>;
};

export function objectFieldEqualityChecker<T extends object>(config: ObjectFieldEqualityCheckerConfig<T>): ObjectFieldEqualityChecker<T> {
  const { fields, defaultEqualityFunction = (a, b) => a === b } = config;
  const _fields = new Map<keyof T, ObjectFieldEqualityCheckerFieldConfig<T, any>>();

  fields.forEach((input) => {
    let field: ObjectFieldEqualityCheckerFieldConfig<T, any>;

    if (typeof input === 'object') {
      field = input;
    } else {
      field = {
        fieldName: input,
        isEqual: defaultEqualityFunction
      };
    }

    _fields.set(field.fieldName, field);
  });

  const fn = ((a: T, b: T): ObjectFieldEqualityCheckResults<T> => {
    const equalFields: FieldOfType<T>[] = [];
    const unequalFields: FieldOfType<T>[] = [];

    _fields.forEach((fieldConfig, fieldName) => {
      const { isEqual } = fieldConfig;
      isEqual(a[fieldName], b[fieldName]) ? equalFields.push(fieldName) : unequalFields.push(fieldName);
    });

    return {
      a,
      b,
      isEqual: unequalFields.length === 0,
      equalFields,
      unequalFields
    };
  }) as Building<ObjectFieldEqualityChecker<T>>;
  fn._fields = _fields;
  return fn as ObjectFieldEqualityChecker<T>;
}
