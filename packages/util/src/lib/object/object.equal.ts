import { type FieldOfType } from '../key';
import { type EqualityComparatorFunction } from '../value/comparator';
import { type Building } from '../value/build';
import { isDate, isEqualDate } from '../date';
import { isIterable } from '../iterable';
import { setsAreEquivalent } from '../set/set';
import { type FilterFromPOJOFunction } from './object.filter.pojo';
import { MAP_IDENTITY } from '../value/map';

/**
 * Performs a deep equality comparison between two values.
 *
 * Recursively compares arrays, objects, Maps, Sets, primitives, and Dates.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns `true` if the values are deeply equal
 */
export function areEqualPOJOValues<F>(a: F, b: F): boolean {
  return areEqualPOJOValuesUsingPojoFilter(a, b, MAP_IDENTITY);
}

/**
 * Performs a deep equality comparison with a POJO filter applied to each value before comparison.
 *
 * Recursively compares arrays, objects, Maps, Sets, primitives, and Dates.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @param pojoFilter - Filter function applied to each value before comparison
 * @returns `true` if the filtered values are deeply equal
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

  if (typeof a !== 'object') {
    return false;
  }

  // check if they are iterables (arrays, Sets, Maps)
  if (isIterable(a, false)) {
    return _compareIterables(a, b, pojoFilter);
  }

  // check plain object comparison
  if (typeof b === 'object') {
    return _compareObjects(a, b, pojoFilter);
  }

  return false;
}

function _compareIterables<F>(a: F, b: F, pojoFilter: FilterFromPOJOFunction<F>): boolean {
  if (Array.isArray(a)) {
    return _compareArrays(a, b as unknown[], pojoFilter);
  }

  if (a instanceof Set) {
    return setsAreEquivalent(a, b as Set<unknown>);
  }

  if (a instanceof Map) {
    return _compareMaps(a, b as Map<unknown, unknown>, pojoFilter);
  }

  return false;
}

function _compareArrays<F>(a: unknown[], b: unknown[], pojoFilter: FilterFromPOJOFunction<F>): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const firstInequalityIndex = a.findIndex((aValue, i) => {
    const bValue = b[i];
    return !areEqualPOJOValuesUsingPojoFilter(aValue as F, bValue as F, pojoFilter);
  });

  return firstInequalityIndex === -1;
}

function _compareMaps<F>(a: Map<unknown, unknown>, b: Map<unknown, unknown>, pojoFilter: FilterFromPOJOFunction<F>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  const firstInequalityIndex = [...a.entries()].findIndex(([key, aValue]) => {
    const bValue = b.get(key);
    return !areEqualPOJOValuesUsingPojoFilter(aValue as F, bValue as F, pojoFilter);
  });

  return firstInequalityIndex === -1;
}

function _compareObjects<F>(a: F, b: F, pojoFilter: FilterFromPOJOFunction<F>): boolean {
  // check constructors/types
  const firstType = (a as object)?.constructor.name;
  const secondType = (b as object)?.constructor.name;

  if (firstType !== secondType) {
    return false;
  }

  // check Date comparison
  if (isDate(a)) {
    return isEqualDate(a, b as Date);
  }

  // check object comparison via keys
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aObject = a as Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bObject = b as Record<string, any>;

  const aKeys = Object.keys(aObject);
  const bKeys = Object.keys(bObject);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  const firstInequalityIndex = aKeys.findIndex((key) => {
    const aKeyValue = aObject[key];
    const bKeyValue = bObject[key];
    return !areEqualPOJOValuesUsingPojoFilter(aKeyValue, bKeyValue, pojoFilter);
  });

  return firstInequalityIndex === -1;
}

// MARK: ObjectFieldEqualityChecker
/**
 * Configuration for an ObjectFieldEqualityChecker.
 */
export interface ObjectFieldEqualityCheckerConfig<T extends object> {
  /**
   * Fields to capture as part of the compressor.
   */
  readonly fields: (ObjectFieldEqualityCheckerFieldConfig<T, FieldOfType<T>> | FieldOfType<T>)[];
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
  readonly _fields: Map<keyof T, ObjectFieldEqualityCheckerFieldConfig<T, FieldOfType<T>>>;
};

/**
 * Creates an {@link ObjectFieldEqualityChecker} that compares two objects field-by-field using configured equality functions.
 *
 * Fields can be specified as simple field names (using the default `===` comparator) or as config objects with custom comparators.
 *
 * @param config - Configuration with the fields to compare and an optional default equality function
 * @returns A function that compares two objects and reports which fields are equal/unequal
 */
export function objectFieldEqualityChecker<T extends object>(config: ObjectFieldEqualityCheckerConfig<T>): ObjectFieldEqualityChecker<T> {
  const { fields, defaultEqualityFunction = (a, b) => a === b } = config;
  const _fields = new Map<keyof T, ObjectFieldEqualityCheckerFieldConfig<T, FieldOfType<T>>>();

  fields.forEach((input) => {
    let field: ObjectFieldEqualityCheckerFieldConfig<T, FieldOfType<T>>;

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
      if (isEqual(a[fieldName], b[fieldName])) {
        equalFields.push(fieldName);
      } else {
        unequalFields.push(fieldName);
      }
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
