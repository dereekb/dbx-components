import type { BaseValueField } from '@ng-forge/dynamic-forms';
import { filterFromPOJO } from '@dereekb/util';
import type { DbxForgePhoneFieldProps } from './phone.field.component';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../../field';

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

export interface DbxForgePhoneFieldConfig extends DbxForgeFieldFunctionDef<DbxForgePhoneFieldDef> {
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
 * International phone number input backed by ngx-mat-input-tel. Supports preferred-country lists, search, and optional extension input.
 *
 * Uses the custom 'phone' field type which renders the ngx-mat-input-tel component
 * bridged to Signal Forms.
 *
 * @param config - Phone field configuration
 * @returns A forge field definition for the phone input
 *
 * @dbxFormField
 * @dbxFormSlug phone
 * @dbxFormTier field-factory
 * @dbxFormProduces string
 * @dbxFormArrayOutput no
 * @dbxFormNgFormType phone
 * @dbxFormWrapperPattern unwrapped
 * @dbxFormConfigInterface DbxForgePhoneFieldConfig
 *
 * @example
 * ```typescript
 * dbxForgePhoneField({ key: 'phone', label: 'Phone', preferredCountries: ['US', 'CA'] })
 * ```
 */
export const dbxForgePhoneField = dbxForgeFieldFunction<DbxForgePhoneFieldConfig>({
  type: FORGE_PHONE_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((config) =>
    filterFromPOJO({
      preferredCountries: config.preferredCountries,
      onlyCountries: config.onlyCountries,
      enableSearch: config.enableSearch,
      allowExtension: config.allowExtension,
      autocomplete: config.autocomplete === false ? 'off' : config.autocomplete
    })
  )
}) as DbxForgeFieldFunction<DbxForgePhoneFieldConfig, DbxForgePhoneFieldDef>;
