import type { RowField, GroupField, FieldDef, RowAllowedChildren, GroupAllowedChildren } from '@ng-forge/dynamic-forms';

let _forgeRowCounter = 0;

// MARK: Row
/**
 * Configuration for a forge row layout that arranges fields horizontally.
 */
export interface ForgeRowConfig {
  /**
   * Optional key for the row. Defaults to a unique auto-generated key.
   *
   * Must be unique within the form config to avoid ng-forge duplicate key errors.
   */
  readonly key?: string;
  /**
   * Fields to render inside this row. Each field may specify a `col` for grid sizing.
   */
  readonly fields: (FieldDef<unknown> & { col?: number })[];
  /**
   * Optional CSS class name applied to the row container.
   */
  readonly className?: string;
}

/**
 * Creates a forge row layout field that arranges child fields horizontally.
 *
 * Uses the `@ng-forge/dynamic-forms` `RowField` type with a 12-column grid system.
 * Each child field can specify a `col` value (1-12) for responsive sizing.
 *
 * @param config - Row layout configuration with fields and optional className
 * @returns A {@link RowField} with type `'row'`
 *
 * @example
 * ```typescript
 * const row = forgeRow({
 *   fields: [
 *     { ...forgeTextField({ key: 'first', label: 'First' }), col: 6 },
 *     { ...forgeTextField({ key: 'last', label: 'Last' }), col: 6 }
 *   ]
 * });
 * ```
 */
export function forgeRow(config: ForgeRowConfig): RowField {
  const result: RowField = {
    type: 'row',
    key: config.key ?? `_row_${_forgeRowCounter++}`,
    fields: config.fields as unknown as RowAllowedChildren[]
  };

  if (config.className) {
    (result as RowField & { className?: string }).className = config.className;
  }

  return result;
}

// MARK: Section Group
/**
 * Configuration for a forge section group layout.
 */
export interface ForgeSectionGroupConfig {
  /**
   * Optional key for the group. Groups with keys create nested objects in the form model.
   */
  readonly key?: string;
  /**
   * Fields contained in this section group.
   */
  readonly fields: FieldDef<unknown>[];
  /**
   * Optional CSS class name applied to the group container.
   */
  readonly className?: string;
}

/**
 * Creates a forge group layout field for a logical section of fields.
 *
 * Groups collect child field values into a nested object when a `key` is provided.
 * When used without a key, the group serves as a visual/logical grouping only.
 *
 * This is the forge equivalent of the formly `formlySectionWrapper`.
 *
 * @param config - Section group configuration with fields and optional key/className
 * @returns A {@link GroupField} with type `'group'`
 *
 * @example
 * ```typescript
 * const section = forgeSectionGroup({
 *   key: 'address',
 *   fields: [
 *     forgeTextField({ key: 'street', label: 'Street' }),
 *     forgeTextField({ key: 'city', label: 'City' })
 *   ]
 * });
 * ```
 */
export function forgeSectionGroup(config: ForgeSectionGroupConfig): GroupField {
  const result: GroupField = {
    type: 'group',
    key: config.key ?? '_section',
    fields: config.fields as unknown as GroupAllowedChildren[]
  };

  if (config.className) {
    (result as GroupField & { className?: string }).className = config.className;
  }

  return result;
}

// MARK: Subsection Group
/**
 * Configuration for a forge subsection group layout.
 */
export interface ForgeSubsectionGroupConfig {
  /**
   * Optional key for the subsection group.
   */
  readonly key?: string;
  /**
   * Fields contained in this subsection group.
   */
  readonly fields: FieldDef<unknown>[];
  /**
   * Optional CSS class name applied to the subsection container.
   */
  readonly className?: string;
}

/**
 * Creates a forge group layout field for a subsection of fields.
 *
 * Subsection groups are a semantic variant of section groups, typically used
 * for smaller groupings within a section. This is the forge equivalent of
 * the formly `formlySubsectionWrapper`.
 *
 * @param config - Subsection group configuration with fields and optional key/className
 * @returns A {@link GroupField} with type `'group'`
 *
 * @example
 * ```typescript
 * const subsection = forgeSubsectionGroup({
 *   fields: [
 *     forgeTextField({ key: 'firstName', label: 'First Name' }),
 *     forgeTextField({ key: 'lastName', label: 'Last Name' })
 *   ]
 * });
 * ```
 */
export function forgeSubsectionGroup(config: ForgeSubsectionGroupConfig): GroupField {
  const result: GroupField = {
    type: 'group',
    key: config.key ?? '_subsection',
    fields: config.fields as unknown as GroupAllowedChildren[]
  };

  if (config.className) {
    (result as GroupField & { className?: string }).className = config.className;
  }

  return result;
}
