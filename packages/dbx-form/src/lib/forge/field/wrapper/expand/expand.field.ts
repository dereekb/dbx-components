import type { FieldTypeDefinition, BaseValueField } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';

// MARK: Field Type
export const FORGE_EXPAND_FIELD_TYPE_NAME = 'dbx-forge-expand' as const;

/**
 * Visual style for the expand trigger.
 */
export type DbxForgeExpandButtonType = 'button' | 'text';

/**
 * Props interface for the forge expand field.
 */
export interface DbxForgeExpandFieldProps {
  /**
   * Visual style for the expand trigger. Defaults to `'text'`.
   */
  readonly buttonType: DbxForgeExpandButtonType;
  /**
   * Label displayed on the expand trigger.
   */
  readonly expandLabel: string;
}

/**
 * Forge field definition for the expand control.
 *
 * This is a boolean value field that renders as a clickable button or text link.
 * When toggled, it writes `true`/`false` to its FieldTree value, which
 * is used by a sibling group's `logic` to show/hide content.
 */
export interface DbxForgeExpandFieldDef extends BaseValueField<DbxForgeExpandFieldProps, boolean> {
  readonly type: typeof FORGE_EXPAND_FIELD_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the expand control field.
 */
export const DBX_FORGE_EXPAND_FIELD_TYPE: FieldTypeDefinition<DbxForgeExpandFieldDef> = {
  name: FORGE_EXPAND_FIELD_TYPE_NAME,
  loadComponent: () => import('./expand.field.component').then((m) => m.DbxForgeExpandFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Config
/**
 * Configuration for creating a forge expand control field.
 */
export interface DbxForgeExpandFieldConfig {
  /**
   * Key for the expand boolean field.
   */
  readonly key: string;
  /**
   * Label displayed on the expand trigger.
   */
  readonly label?: string;
  /**
   * Visual style for the expand trigger. Defaults to `'text'`.
   */
  readonly buttonType?: DbxForgeExpandButtonType;
  /**
   * Whether the expand starts open. Defaults to false.
   */
  readonly defaultOpen?: boolean;
}

/**
 * Creates a forge expand control field that toggles a boolean value.
 *
 * Renders as a clickable button or text link. The boolean value is used
 * by a sibling group's `logic` to show/hide content.
 *
 * @param config - Expand control configuration
 * @returns A {@link DbxForgeExpandFieldDef}
 */
export function forgeExpandField(config: DbxForgeExpandFieldConfig): DbxForgeExpandFieldDef {
  const { key, label, buttonType, defaultOpen } = config;

  return forgeField(
    filterFromPOJO({
      key,
      type: FORGE_EXPAND_FIELD_TYPE_NAME,
      label: '',
      value: defaultOpen ?? false,
      props: {
        buttonType: buttonType ?? 'text',
        expandLabel: label ?? ''
      } as DbxForgeExpandFieldProps
    }) as DbxForgeExpandFieldDef
  );
}
