import type { FieldTypeDefinition, BaseValueField } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';

// MARK: Field Type
export const FORGE_WORKING_FIELD_TYPE_NAME = 'dbx-forge-working' as const;

/**
 * Props interface for the forge working indicator field.
 */
export interface DbxForgeWorkingFieldProps {
  /**
   * Key of the sibling field to monitor for pending validation state.
   */
  readonly watchFieldKey: string;
}

/**
 * Forge field definition for a working indicator.
 */
export interface DbxForgeWorkingFieldDef extends BaseValueField<DbxForgeWorkingFieldProps, unknown> {
  readonly type: typeof FORGE_WORKING_FIELD_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the working indicator field.
 */
export const DBX_FORGE_WORKING_FIELD_TYPE: FieldTypeDefinition<DbxForgeWorkingFieldDef> = {
  name: FORGE_WORKING_FIELD_TYPE_NAME,
  loadComponent: () => import('./working.field.component').then((m) => m.DbxForgeWorkingFieldComponent),
  mapper: valueFieldMapper
};
