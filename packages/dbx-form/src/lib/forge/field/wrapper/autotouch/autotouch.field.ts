import type { FieldTypeDefinition, BaseValueField } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';

// MARK: Field Type
export const FORGE_AUTOTOUCH_FIELD_TYPE_NAME = 'dbx-forge-autotouch' as const;

/**
 * Props interface for the forge autotouch field.
 */
export interface ForgeAutoTouchFieldProps {
  /**
   * Key of the sibling field to auto-touch on value change.
   */
  readonly watchFieldKey: string;
}

/**
 * Forge field definition for autotouch behavior.
 */
export interface ForgeAutoTouchFieldDef extends BaseValueField<ForgeAutoTouchFieldProps, unknown> {
  readonly type: typeof FORGE_AUTOTOUCH_FIELD_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the autotouch field.
 */
export const DBX_FORGE_AUTOTOUCH_FIELD_TYPE: FieldTypeDefinition<ForgeAutoTouchFieldDef> = {
  name: FORGE_AUTOTOUCH_FIELD_TYPE_NAME,
  loadComponent: () => import('./autotouch.field.component').then((m) => m.ForgeAutoTouchFieldComponent),
  mapper: valueFieldMapper
};

let _forgeAutoTouchCounter = 0;

// MARK: Config
/**
 * Configuration for creating a forge autotouch field.
 */
export interface ForgeAutoTouchFieldConfig {
  /**
   * Key of the sibling field to auto-touch on value change.
   */
  readonly watchFieldKey: string;
  /**
   * Optional key. Defaults to auto-generated.
   */
  readonly key?: string;
}

/**
 * Creates a forge autotouch field that marks a sibling field as touched
 * when its value changes.
 *
 * This is a hidden behavioral field with no visual output. It monitors
 * the form value for changes and marks the target field as touched,
 * triggering validation display.
 *
 * @param config - AutoTouch configuration
 * @returns A {@link ForgeAutoTouchFieldDef}
 */
export function forgeAutoTouchField(config: ForgeAutoTouchFieldConfig): ForgeAutoTouchFieldDef {
  const { watchFieldKey, key } = config;

  return forgeField(
    filterFromPOJO({
      key: key ?? `_autotouch_${_forgeAutoTouchCounter++}`,
      type: FORGE_AUTOTOUCH_FIELD_TYPE_NAME,
      label: '',
      value: undefined as unknown,
      hidden: true,
      props: { watchFieldKey } as ForgeAutoTouchFieldProps
    }) as ForgeAutoTouchFieldDef
  );
}
