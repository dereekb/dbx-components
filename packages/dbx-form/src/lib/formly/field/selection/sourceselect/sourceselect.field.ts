import { type PrimativeKey } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type LabeledFieldConfig, formlyField, propsAndConfigForFieldConfig, type DescriptionFieldConfig, type MaterialFormFieldConfig } from '../../field';
import { type SourceSelectFieldProps } from './sourceselect.field.component';

// MARK: Source Select
/**
 * Configuration for a source-select field that loads values from external sources.
 */
export interface SourceSelectFieldConfig<T extends PrimativeKey = PrimativeKey, M = unknown> extends LabeledFieldConfig, DescriptionFieldConfig, MaterialFormFieldConfig, SourceSelectFieldProps<T, M> {}

/**
 * Creates a Formly field configuration for a source-select field that loads and
 * displays selectable values from one or more external data sources.
 *
 * @param config - Source-select field configuration
 * @returns A validated {@link FormlyFieldConfig} with type `'sourceselectfield'`
 *
 * @example
 * ```typescript
 * const field = sourceSelectField({
 *   key: 'source',
 *   label: 'Source',
 *   loadSources: () => sources$,
 *   metaReader: (meta) => meta.id
 * });
 * ```
 */
export function sourceSelectField<T extends PrimativeKey = PrimativeKey, M = unknown>(config: SourceSelectFieldConfig<T, M>): FormlyFieldConfig {
  const { key, materialFormField } = config;
  return formlyField({
    key,
    type: 'sourceselectfield',
    ...propsAndConfigForFieldConfig(config, {
      ...materialFormField,
      ...config,
      autocomplete: false
    })
  });
}
