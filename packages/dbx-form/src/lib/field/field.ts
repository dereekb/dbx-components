import { type MapFunction } from '@dereekb/util';
import { DisableAutocompleteForField } from './field.autocomplete';

/**
 * A value parser function that transforms a form field's value from one type to another.
 */
export type FieldValueParser<I = any, O = any> = MapFunction<I, O>;

/**
 * @deprecated Use FieldValueParser instead.
 */
export type FormlyValueParser<I = any, O = any> = FieldValueParser<I, O>;

/**
 * Reference to an array of value parsers applied to a field's value.
 */
export interface FieldConfigParsersRef {
  parsers: FieldValueParser[];
}

/**
 * Optional reference to value parsers for a field.
 */
export interface FieldConfigWithParsers {
  parsers?: FieldValueParser[];
}

/**
 * Base configuration for a form field, providing the key and required/readonly flags.
 *
 * This is the engine-agnostic base. Formly and forge extend this with their own
 * engine-specific properties.
 */
export interface BaseFieldConfig {
  key: string;
  required?: boolean;
  readonly?: boolean;
}

/**
 * Configuration for a labeled form field with label, placeholder, and autocomplete support.
 *
 * @deprecated
 */
export interface LabeledBaseFieldConfig extends BaseFieldConfig {
  label?: string;
  placeholder?: string;
  /**
   * Sets the autocomplete values. Pass `false` to disable autocomplete.
   */
  autocomplete?: string | DisableAutocompleteForField;
}

/**
 * Configuration mixin that provides a default value for a form field.
 *
 * @deprecated
 */
export interface DefaultValueFieldConfig<T = unknown> {
  defaultValue?: T;
}

/**
 * Configuration mixin for arbitrary HTML attributes on a form field element.
 *
 * @deprecated
 */
export interface AttributesFieldConfig {
  attributes?: {
    [key: string]: string | number;
  };
}

/**
 * Configuration mixin for a field hint/description/help text.
 *
 * @deprecated
 */
export interface DescriptionFieldConfig {
  /**
   * Description text.
   */
  description?: string;
}

/**
 * Configuration mixin for a field hint/help text.
 *
 * @deprecated
 */
export interface HintFieldConfig extends Partial<DescriptionFieldConfig> {
  /**
   * Description text. Alias for hint.
   *
   * @deprecated use hint instead.
   */
  description?: string;
  /**
   * Hint text.
   */
  hint?: string;
}

/**
 * Union of all partial shared field config types.
 *
 * This is the engine-agnostic version. Formly and forge may extend this
 * with their own engine-specific properties.
 */
export type BasePartialPotentialFieldConfig = Partial<BaseFieldConfig> & Partial<LabeledBaseFieldConfig> & Partial<AttributesFieldConfig> & Partial<DescriptionFieldConfig>;
