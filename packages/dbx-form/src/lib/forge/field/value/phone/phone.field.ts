import type { FieldDef, SimplifiedArrayField, ArrayAllowedChildren } from '@ng-forge/dynamic-forms';

// MARK: Phone Field
/**
 * Configuration for a forge international phone number input field.
 */
export interface ForgePhoneFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  /**
   * Preferred countries to show at the top of the country selector.
   */
  readonly preferredCountries?: string[];
}

/**
 * Creates a forge field definition for an international phone number input.
 *
 * TODO: Requires custom ValueFieldComponent implementation.
 * Currently throws an error indicating it is not yet implemented.
 *
 * @param _config - Phone field configuration
 * @returns A {@link FieldDef}
 */
export function forgePhoneField(_config: ForgePhoneFieldConfig): FieldDef<unknown> {
  throw new Error('forgePhoneField requires a custom ValueFieldComponent. Not yet implemented.');
}

// MARK: Wrapped Phone And Label Field
/**
 * Configuration for a forge phone number field paired with a text label field.
 */
export interface ForgeWrappedPhoneAndLabelFieldConfig {
  readonly phoneField?: Partial<ForgePhoneFieldConfig>;
  readonly labelField?: {
    readonly key?: string;
    readonly label?: string;
    readonly placeholder?: string;
  };
}

/**
 * Creates a forge field group containing a phone number field and a label text field.
 *
 * TODO: Requires custom ValueFieldComponent implementation for the phone input.
 * Currently throws an error indicating it is not yet implemented.
 *
 * @param _config - Phone and label field configurations
 * @returns A {@link FieldDef}
 */
export function forgeWrappedPhoneAndLabelField(_config: ForgeWrappedPhoneAndLabelFieldConfig = {}): FieldDef<unknown> {
  throw new Error('forgeWrappedPhoneAndLabelField requires a custom ValueFieldComponent. Not yet implemented.');
}

// MARK: Phone And Label Section Field
/**
 * Configuration for a forge section-wrapped phone + label field pair.
 */
export interface ForgePhoneAndLabelSectionFieldConfig extends ForgeWrappedPhoneAndLabelFieldConfig {
  readonly key?: string;
  readonly header?: string;
  readonly hint?: string;
}

/**
 * Creates a forge section-wrapped phone + label field pair with a configurable header.
 *
 * TODO: Requires custom ValueFieldComponent implementation for the phone input.
 * Currently throws an error indicating it is not yet implemented.
 *
 * @param _config - Section configuration including phone and label fields
 * @returns A {@link FieldDef}
 */
export function forgePhoneAndLabelSectionField(_config: ForgePhoneAndLabelSectionFieldConfig = {}): FieldDef<unknown> {
  throw new Error('forgePhoneAndLabelSectionField requires a custom ValueFieldComponent. Not yet implemented.');
}

// MARK: Phone List Field
/**
 * Configuration for a forge repeatable list of phone + label field pairs.
 */
export interface ForgePhoneListFieldConfig {
  readonly key?: string;
  /**
   * Template fields for each phone list item.
   *
   * If not provided, defaults to the phone and label field pair
   * once the phone custom component is implemented.
   */
  readonly template?: ArrayAllowedChildren | readonly ArrayAllowedChildren[];
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly addButtonLabel?: string;
  readonly removeButtonLabel?: string;
}

/**
 * Creates a forge simplified array field for collecting multiple phone number entries.
 *
 * Uses the ng-forge SimplifiedArrayField with add/remove buttons.
 *
 * NOTE: The phone input template requires a custom ValueFieldComponent.
 * Currently throws an error indicating it is not yet implemented.
 *
 * @param _config - Phone list field configuration
 * @returns A {@link SimplifiedArrayField}
 */
export function forgePhoneListField(_config: ForgePhoneListFieldConfig = {}): SimplifiedArrayField {
  throw new Error('forgePhoneListField requires custom phone ValueFieldComponent template. Not yet implemented.');
}
