import { Maybe } from '@dereekb/util';

/**
 * Semantic type to disable autocomplete on a field. Pass `false` to the autocomplete property.
 */
export type DisableAutocompleteForField = false;

/**
 * Autocomplete configuration/attribute option for an input field.
 *
 * Pass a string for a specific autocomplete value (e.g., `'email'`, `'name'`),
 * or `false` to disable browser autofill.
 */
export type FieldAutocompleteAttributeOption = string | DisableAutocompleteForField;

/**
 * Autocomplete configuration/attribute for an input field.
 *
 * @see {FieldAutocompleteAttributeOption}
 */
export type FieldAutocompleteAttributeValue = string;

/**
 * Reference to an autocomplete attribute.
 */
export interface FieldAutocompleteAttributeOptionRef {
  readonly autocomplete?: FieldAutocompleteAttributeOption;
}

/**
 * The output attributes to apply to an input element.
 */
export interface FieldAutocompleteAttributes {
  readonly name?: string;
  readonly autocomplete: FieldAutocompleteAttributeValue;
}

/**
 * Builds a {@link FieldMeta} object for the given autocomplete configuration.
 *
 * When `false`, disables browser autofill by setting `name: 'password'` and `autocomplete: 'off'`
 * (matching the Chrome autofill workaround). When a string, sets the `autocomplete` attribute
 * to that value.
 */
export function fieldAutocompleteAttributeValue(autocomplete?: Maybe<FieldAutocompleteAttributeOption>): Maybe<FieldAutocompleteAttributes> {
  let result: Maybe<FieldAutocompleteAttributes>;

  if (autocomplete === false) {
    // https://stackoverflow.com/questions/15738259/disabling-chrome-autofill
    result = disableAutofillAttributes();
  } else if (autocomplete != null) {
    result = {
      autocomplete
    };
  }

  return result;
}

/**
 * Returns the attributes to disable autofill on an input element.
 *
 * @see https://stackoverflow.com/questions/15738259/disabling-chrome-autofill
 */
export function disableAutofillAttributes(): FieldAutocompleteAttributes {
  return {
    name: 'password',
    autocomplete: 'off'
  };
}
