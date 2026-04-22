import type { BaseValueField } from '@ng-forge/dynamic-forms';
import { dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction } from '../../field';
import type { DbxForgeDateTimeFieldComponentProps } from './datetime.field.component';
import { type DbxDateTimeFieldSyncType } from '../../../../formly/field/value/date/datetime.field.component';

// MARK: Sync Field Types
/**
 * Sync field configuration for forge datetime fields.
 *
 * Same as formly's {@link DbxDateTimeFieldSyncField} but re-exported here so forge consumers
 * don't need to import from the formly module.
 */
export interface DbxForgeDateTimeSyncField {
  /**
   * Sibling field key/path to sync with.
   */
  readonly syncWith: string;
  /**
   * How to sync against the other field.
   *
   * - `'before'`: The synced field's value acts as a minimum for this field.
   * - `'after'`: The synced field's value acts as a maximum for this field.
   */
  readonly syncType: DbxDateTimeFieldSyncType;
}

// MARK: DateTime Field
/**
 * The custom forge field type name for the date-time field.
 */
export const FORGE_DATETIME_FIELD_TYPE = 'datetime' as const;

/**
 * Field definition type for a forge date-time field.
 */
export type DbxForgeDateTimeFieldDef = BaseValueField<DbxForgeDateTimeFieldComponentProps, unknown> & {
  readonly type: typeof FORGE_DATETIME_FIELD_TYPE;
};

/**
 * Configuration for a forge date-time picker field combining date and time selection.
 *
 * Full parity with the formly `DateTimeFieldConfig` — supports timezone, valueMode, timeMode,
 * pickerConfig, presets, field sync, and all other formly datetime features via `props`.
 */
export interface DbxForgeDateTimeFieldConfig extends DbxForgeFieldFunctionDef<DbxForgeDateTimeFieldDef> {}

/**
 * Creates a forge field definition for a combined date-time picker.
 *
 * Full parity with formly `dateTimeField()` — supports timezone, valueMode, timeMode,
 * pickerConfig, presets, and all other features via the `props` slot.
 *
 * @param config - Date-time field configuration
 * @returns A {@link DbxForgeDateTimeFieldDef}
 *
 * @example
 * ```typescript
 * const field = dbxForgeDateTimeField({
 *   key: 'eventStart',
 *   label: 'Start',
 *   required: true,
 *   props: {
 *     timezone: 'America/New_York',
 *     valueMode: DbxDateTimeValueMode.DATE_STRING,
 *     timeMode: DbxDateTimeFieldTimeMode.OPTIONAL
 *   }
 * });
 * ```
 */
export const dbxForgeDateTimeField = dbxForgeFieldFunction<DbxForgeDateTimeFieldConfig>({
  type: FORGE_DATETIME_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder()
}) as DbxForgeFieldFunction<DbxForgeDateTimeFieldConfig, DbxForgeDateTimeFieldDef>;
