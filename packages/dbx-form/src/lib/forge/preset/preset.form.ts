import { type Maybe } from '@dereekb/util';
import { type MatInputField, type MatInputProps } from '@ng-forge/dynamic-forms-material';
import { dbxForgeTextField } from '../field';
import { type DbxForgeField } from '../form';

export interface DbxForgePresetSearchFormFieldsValue {
  readonly search: string;
}

export interface DbxForgePresetSearchFormFieldsConfig {
  readonly key?: string;
  readonly label?: string;
  readonly placeholder?: string;
  /**
   * Escape hatch for Material form field styling (appearance, floatLabel, hideRequiredMarker, subscriptSizing, etc.).
   * Forwarded to the underlying forge text field's `props`. `type` is fixed to `'text'`.
   */
  readonly props?: Partial<Omit<MatInputProps, 'type'>>;
}

/**
 * Creates a forge field array for a simple search form with a single text input.
 *
 * @param config - Optional search field configuration with label and placeholder.
 * @returns The forge field defs for the search form.
 */
export function dbxForgePresetSearchFormFields(config: Maybe<DbxForgePresetSearchFormFieldsConfig>) {
  const { key = 'search', label, placeholder = 'Search', props } = config ?? {};

  const field: DbxForgeField<MatInputField> = dbxForgeTextField({
    key,
    label,
    placeholder,
    autocomplete: false,
    props
  });

  return [field];
}
