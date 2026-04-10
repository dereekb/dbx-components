import type { FieldDef, BaseValueField } from '@ng-forge/dynamic-forms';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';
import { forgeRow } from '../../wrapper/wrapper';
import { forgeDbxSectionFieldWrapper } from '../../wrapper/section/section.field';
import { forgeTextField } from '../text/text.field';
import { forgeArrayField, type DbxForgeArrayTemplateField, type DbxForgeArrayFieldDef } from '../array/array.field';
import type { DbxForgePhoneFieldProps } from './phone.field.component';

// MARK: Phone Field
/**
 * The custom forge field type name for the phone field.
 */
export const FORGE_PHONE_FIELD_TYPE = 'phone' as const;

/**
 * Field definition type for a forge phone field.
 */
export type DbxForgePhoneFieldDef = BaseValueField<DbxForgePhoneFieldProps, string> & {
  readonly type: typeof FORGE_PHONE_FIELD_TYPE;
};

/**
 * Configuration for a forge international phone number input field.
 */
/**
 * Autocomplete values supported by the phone field.
 *
 * The underlying `ngx-mat-input-tel` component only supports `'off'` and `'tel'`.
 * Pass `false` to disable autocomplete (equivalent to `'off'`).
 */
export type DbxForgePhoneFieldAutocomplete = 'off' | 'tel' | false;

export interface DbxForgePhoneFieldConfig {
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
  /**
   * Whether or not to allow adding an extension. False by default.
   */
  readonly allowExtension?: boolean;
  /**
   * Sets the autocomplete attribute on the phone input.
   *
   * Pass `'tel'` to enable phone autofill, or `false`/`'off'` to disable.
   */
  readonly autocomplete?: DbxForgePhoneFieldAutocomplete;
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
export function forgePhoneField(config: DbxForgePhoneFieldConfig): DbxForgePhoneFieldDef {
  const { key, label = 'Phone Number', required, readonly: isReadonly, description, defaultValue = '', preferredCountries, onlyCountries, enableSearch, allowExtension, autocomplete } = config;

  const props: Partial<DbxForgePhoneFieldProps> = filterFromPOJO({
    hint: description,
    preferredCountries,
    onlyCountries,
    enableSearch,
    allowExtension,
    autocomplete: autocomplete === false ? 'off' : autocomplete
  });

  return forgeField(
    filterFromPOJO({
      key,
      type: FORGE_PHONE_FIELD_TYPE,
      label,
      value: defaultValue,
      required,
      readonly: isReadonly,
      props: Object.keys(props).length > 0 ? props : undefined
    }) as DbxForgePhoneFieldDef
  );
}

// MARK: Wrapped Phone And Label Field
/**
 * Configuration for a forge phone number field paired with a text label field.
 */
export interface DbxForgeWrappedPhoneAndLabelFieldConfig {
  readonly phoneField?: Partial<DbxForgePhoneFieldConfig>;
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
export function forgeWrappedPhoneAndLabelField(config: DbxForgeWrappedPhoneAndLabelFieldConfig = {}): FieldDef<unknown> {
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
export interface DbxForgePhoneAndLabelSectionFieldConfig extends DbxForgeWrappedPhoneAndLabelFieldConfig {
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
export function forgePhoneAndLabelSectionField(config: DbxForgePhoneAndLabelSectionFieldConfig = {}): FieldDef<unknown> {
  const { key, phoneField, labelField } = config;

  return forgeDbxSectionFieldWrapper({
    key,
    fields: [forgeWrappedPhoneAndLabelField({ phoneField, labelField })]
  });
}

// MARK: Phone List Field
/**
 * Configuration for a forge repeatable list of phone + label field pairs.
 */
export interface DbxForgePhoneListFieldConfig {
  readonly key?: string;
  /**
   * Template fields for each phone list item.
   *
   * If not provided, defaults to the phone and label field pair.
   */
  readonly template?: DbxForgeArrayTemplateField | readonly DbxForgeArrayTemplateField[];
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly addText?: string;
  readonly removeText?: string;
}

/**
 * Creates a forge drag array field for collecting multiple phone number entries.
 *
 * @param config - Phone list field configuration
 * @returns A {@link DbxForgeArrayFieldDef}
 *
 * @example
 * ```typescript
 * const field = forgePhoneListField({ maxLength: 3 });
 * ```
 */
export function forgePhoneListField(config: DbxForgePhoneListFieldConfig = {}): DbxForgeArrayFieldDef {
  const { key = 'phones', template, minLength, maxLength, addText = 'Add Phone Number', removeText = 'Remove Phone Number' } = config;

  const defaultTemplate: DbxForgeArrayTemplateField[] = [forgePhoneField({ key: 'phone' }), forgeTextField({ key: 'label', label: 'Label' })];

  return forgeArrayField({
    key,
    template: template ?? defaultTemplate,
    minLength,
    maxLength,
    addText,
    removeText
  });
}
