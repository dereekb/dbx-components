import { AbstractControl, ValidatorFn } from "@angular/forms";
import { KeyValueTupleFilter, allObjectsAreEqual, IsEqualFunction, KeyValueTypleValueFilter, ObjectMap, valuesFromPOJO } from "@dereekb/util";

export const FIELD_VALUES_ARE_EQUAL_VALIDATION_KEY = 'fieldValuesAreEqual';

export interface FieldValuesAreEqualValidatorConfig<T extends object = object> {

  /**
   * Keys of the value to match on. 
   * 
   * If none are defined, then all fields from the control are matched.
   */
  keysFilter?: (keyof T)[];

  /**
   * Full filter to use, if defined.
   */
  valuesFilter?: KeyValueTupleFilter<T>;

  /**
   * Optional equivalence comparator.
   */
  isEqual?: IsEqualFunction<T>;

  /**
   * Custom message for this validator.
   */
  message?: string;

}

/**
 * Validator for validating all values within an object. 
 * 
 * This is useful for validating a control group where two or more values are expected to be the same, such as a password and a password verification field.
 * 
 * @param config 
 * @returns 
 */
export function fieldValuesAreEqualValidator<T extends object = object>(config: FieldValuesAreEqualValidatorConfig<T> = {}): ValidatorFn {
  const {
    keysFilter,
    valuesFilter: inputValuesFilter,
    isEqual = ((a, b) => a === b),
    message = 'Field values are not equal.'
  } = config;

  const valuesFilter: KeyValueTupleFilter<T, keyof T> = inputValuesFilter ?? {
    valueFilter: KeyValueTypleValueFilter.NONE, // keep all values. Null/undefined should be processed.
    keysFilter
  };

  return (control: AbstractControl) => {
    const object: ObjectMap<T> = control.value;
    const values: T[] = valuesFromPOJO(object as T, valuesFilter);
    const isValid = allObjectsAreEqual(values, isEqual);

    if (isValid) {
      return null;
    } else {
      return {
        [FIELD_VALUES_ARE_EQUAL_VALIDATION_KEY]: { message }
      };
    }
  };
}
