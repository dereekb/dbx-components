import { isEqual } from 'lodash';
import { FieldOfType } from '../key';
import { EqualityComparatorFunction } from '../value/comparator';
import { Building } from '../value/build';

/**
 * Performs a deep comparison to check if all values on the input filters are equal.
 */
export function areEqualPOJOValues<F>(a: F, b: F): boolean {
  return isEqual(a, b);
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
