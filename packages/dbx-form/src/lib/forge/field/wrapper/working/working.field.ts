import type { FieldTypeDefinition, BaseValueField } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';

// MARK: Field Type
export const FORGE_WORKING_FIELD_TYPE_NAME = 'dbx-forge-working' as const;

/**
 * Props interface for the forge working indicator field.
 */
export interface ForgeWorkingFieldProps {
  /**
   * Key of the sibling field to monitor for pending validation state.
   */
  readonly watchFieldKey: string;
}

/**
 * Forge field definition for a working indicator.
 */
export interface ForgeWorkingFieldDef extends BaseValueField<ForgeWorkingFieldProps, unknown> {
  readonly type: typeof FORGE_WORKING_FIELD_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the working indicator field.
 */
export const DBX_FORGE_WORKING_FIELD_TYPE: FieldTypeDefinition<ForgeWorkingFieldDef> = {
  name: FORGE_WORKING_FIELD_TYPE_NAME,
  loadComponent: () => import('./working.field.component').then((m) => m.ForgeWorkingFieldComponent),
  mapper: valueFieldMapper
};

let _forgeWorkingCounter = 0;

// MARK: Config
/**
 * Configuration for creating a forge working indicator field.
 */
export interface ForgeWorkingFieldConfig {
  /**
   * Key of the sibling field to monitor for pending validation state.
   */
  readonly watchFieldKey: string;
  /**
   * Optional key. Defaults to auto-generated.
   */
  readonly key?: string;
}

/**
 * Creates a forge working indicator field that shows a loading bar
 * when a sibling field is in a pending validation state.
 *
 * @param config - Working indicator configuration
 * @returns A {@link ForgeWorkingFieldDef}
 */
export function forgeWorkingField(config: ForgeWorkingFieldConfig): ForgeWorkingFieldDef {
  const { watchFieldKey, key } = config;

  return forgeField(
    filterFromPOJO({
      key: key ?? `_working_${_forgeWorkingCounter++}`,
      type: FORGE_WORKING_FIELD_TYPE_NAME,
      label: '',
      value: undefined as unknown,
      props: { watchFieldKey } as ForgeWorkingFieldProps
    }) as ForgeWorkingFieldDef
  );
}
