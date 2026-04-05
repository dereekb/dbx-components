import type { FieldDef, SimplifiedArrayField, ArrayAllowedChildren, BaseValueField } from '@ng-forge/dynamic-forms';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';
import { forgeRow, forgeSectionGroup } from '../../wrapper/wrapper';
import { forgeTextField } from '../text/text.field';
import { forgeRepeatArrayField } from '../array/array.field';
import type { ForgePhoneFieldProps } from './phone.field.component';

// MARK: Phone Field
/**
 * Type alias for the forge phone field definition.
 */
export type ForgePhoneFieldDef = BaseValueField<ForgePhoneFieldProps, string>;

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
   * Default value for the phone field. Defaults to empty string.
   */
  readonly defaultValue?: string;
  /**
   * Preferred countries to show at the top of the country selector.
   */
  readonly preferredCountries?: string[];
  /**
   * ISO country codes to restrict the dropdown to.
   */
  readonly onlyCountries?: string[];
  /**
   * Whether or not to enable the search feature. True by default.
   */
  readonly enableSearch?: boolean;
}

/**
 * Creates a forge field definition for an international phone number input.
 *
 * Uses the custom 'phone' field type which renders the ngx-mat-input-tel component
 * bridged to Signal Forms.
 *
 * @param config - Phone field configuration
 * @returns A forge field definition for the phone input
 *
 * @example
 * ```typescript
 * const field = forgePhoneField({ key: 'phone', label: 'Phone Number', required: true });
 * ```
 */
export function forgePhoneField(config: ForgePhoneFieldConfig): FieldDef<ForgePhoneFieldProps> {
  const { key, label = 'Phone Number', required, readonly: isReadonly, description, defaultValue = '', preferredCountries, onlyCountries, enableSearch } = config;

  const props: Partial<ForgePhoneFieldProps> = filterFromPOJO({
    hint: description,
    preferredCountries,
    onlyCountries,
    enableSearch
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: 'phone' as const,
      label,
      value: defaultValue,
      required,
      readonly: isReadonly,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as FieldDef<ForgePhoneFieldProps>
  );
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
 * Creates a forge row layout containing a phone number field and a label text field,
 * useful for collecting named phone numbers (e.g., "Work", "Home").
 *
 * @param config - Phone and label field configurations
 * @returns A forge row field definition
 *
 * @example
 * ```typescript
 * const field = forgeWrappedPhoneAndLabelField({ phoneField: { required: true } });
 * ```
 */
export function forgeWrappedPhoneAndLabelField(config: ForgeWrappedPhoneAndLabelFieldConfig = {}): FieldDef<unknown> {
  const { phoneField: phone, labelField: labelConfig } = config;

  return forgeRow({
    fields: [
      { ...forgePhoneField({ key: 'phone', ...phone }), col: 8 },
      {
        ...forgeTextField({
          key: labelConfig?.key ?? 'label',
          label: labelConfig?.label ?? 'Label',
          placeholder: labelConfig?.placeholder ?? ''
        }),
        col: 4
      }
    ]
  });
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
 * @param config - Section configuration including phone and label fields
 * @returns A forge group field definition
 *
 * @example
 * ```typescript
 * const field = forgePhoneAndLabelSectionField({ header: 'Contact Phone' });
 * ```
 */
export function forgePhoneAndLabelSectionField(config: ForgePhoneAndLabelSectionFieldConfig = {}): FieldDef<unknown> {
  const { key, phoneField, labelField } = config;

  return forgeSectionGroup({
    key,
    fields: [forgeWrappedPhoneAndLabelField({ phoneField, labelField })]
  });
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
   * If not provided, defaults to the phone and label field pair.
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
 * @param config - Phone list field configuration
 * @returns A {@link SimplifiedArrayField}
 *
 * @example
 * ```typescript
 * const field = forgePhoneListField({ maxLength: 3 });
 * ```
 */
export function forgePhoneListField(config: ForgePhoneListFieldConfig = {}): SimplifiedArrayField {
  const { key = 'phones', template, minLength, maxLength, addButtonLabel = 'Add Phone Number', removeButtonLabel = 'Remove Phone Number' } = config;

  const defaultTemplate: ArrayAllowedChildren[] = [forgePhoneField({ key: 'phone' }) as ArrayAllowedChildren, forgeTextField({ key: 'label', label: 'Label' }) as ArrayAllowedChildren];

  return forgeRepeatArrayField({
    key,
    template: template ?? defaultTemplate,
    minLength,
    maxLength,
    addButton: { label: addButtonLabel },
    removeButton: { label: removeButtonLabel }
  });
}
