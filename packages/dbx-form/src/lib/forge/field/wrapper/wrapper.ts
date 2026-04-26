import type { RowField, GroupField, FieldDef, RowAllowedChildren, GroupAllowedChildren, ConditionalExpression } from '@ng-forge/dynamic-forms';
import { FORGE_EXPAND_FIELD_TYPE_NAME, type DbxForgeExpandButtonType, type DbxForgeExpandFieldDef, type DbxForgeExpandFieldProps } from './expand/expand.field';
/**
 * Logic configuration for container fields (group, row, array).
 *
 * Containers only support `'hidden'` since they are layout containers,
 * not form controls. This mirrors ng-forge's internal `ContainerLogicConfig`.
 */
export interface DbxForgeContainerLogicConfig {
  readonly type: 'hidden';
  readonly condition: ConditionalExpression | boolean;
}

let _dbxForgeRowCounter = 0;
let _dbxForgeGroupCounter = 0;
let _dbxForgeToggleCounter = 0;
let _dbxForgeExpandCounter = 0;

// MARK: Row
/**
 * Configuration for a forge row layout that arranges fields horizontally.
 *
 * Extends {@link RowField} with `key` made optional (auto-generated if omitted)
 * and `type` omitted (always `'row'`).
 */
export interface DbxForgeRowConfig extends Omit<RowField, 'type' | 'key'> {
  /**
   * Optional key for the row. Defaults to a unique auto-generated key.
   *
   * Must be unique within the form config to avoid ng-forge duplicate key errors.
   */
  readonly key?: string;
}

/**
 * Flex row that lays child fields out in columns. Child fields typically carry a `col` property (1–12) for grid placement.
 *
 * Uses the `@ng-forge/dynamic-forms` `RowField` type with a 12-column grid system.
 * Each child field can specify a `col` value (1-12) for responsive sizing.
 *
 * @param config - Row layout configuration with fields and optional className
 * @returns A {@link RowField} with type `'row'`
 *
 * @dbxFormField
 * @dbxFormSlug row
 * @dbxFormTier primitive
 * @dbxFormProduces RowField
 * @dbxFormReturns RowField
 * @dbxFormArrayOutput no
 * @dbxFormConfigInterface DbxForgeRowConfig
 *
 * @example
 * ```typescript
 * dbxForgeRow({ fields: [ { ...dbxForgeTextField({ key: 'first' }), col: 6 }, { ...dbxForgeTextField({ key: 'last' }), col: 6 } ] })
 * ```
 */
export function dbxForgeRow(config: DbxForgeRowConfig): RowField {
  const { key: inputKey, ...rest } = config;

  return {
    ...rest,
    type: 'row',
    key: inputKey ?? `_row_${_dbxForgeRowCounter++}`
  } as RowField;
}

// MARK: Group
/**
 * Configuration for a forge group layout.
 *
 * Extends {@link GroupField} with `key` made optional (auto-generated if omitted)
 * and `type` omitted (always `'group'`).
 */
export interface DbxForgeGroupConfig extends Omit<GroupField, 'type' | 'key'> {
  /**
   * Optional key for the group. Defaults to a unique auto-generated key.
   *
   * Must be unique within the form config to avoid ng-forge duplicate key errors.
   */
  readonly key?: string;
}

/**
 * Group container nesting child fields so their values roll up into one object under the group's key.
 *
 * Groups collect child field values into a nested object when a `key` is provided.
 * When used without a key, the group serves as a visual/logical grouping only.
 *
 * For sections with headers, use the section wrapper type instead.
 *
 * @param config - Group configuration with fields and optional key/className
 * @returns A {@link GroupField} with type `'group'`
 *
 * @dbxFormField
 * @dbxFormSlug group
 * @dbxFormTier primitive
 * @dbxFormProduces GroupField
 * @dbxFormReturns GroupField
 * @dbxFormArrayOutput no
 * @dbxFormConfigInterface DbxForgeGroupConfig
 *
 * @example
 * ```typescript
 * dbxForgeGroup({ key: 'profile', fields: [dbxForgeTextField({ key: 'name' })] })
 * ```
 */
export function dbxForgeGroup(config: DbxForgeGroupConfig): GroupField {
  const { key: inputKey, ...rest } = config;

  return {
    ...rest,
    type: 'group',
    key: inputKey ?? `_group_${_dbxForgeGroupCounter++}`
  } as GroupField;
}

// MARK: Toggle Wrapper
/**
 * Configuration for a forge toggle wrapper that shows/hides content via a slide toggle.
 */
export interface DbxForgeToggleWrapperConfig {
  /**
   * Fields to show/hide based on the toggle state.
   */
  readonly fields: FieldDef<unknown>[];
  /**
   * Label for the toggle control.
   */
  readonly label?: string;
  /**
   * Key for the toggle boolean field. Defaults to auto-generated `_toggle_N`.
   */
  readonly key?: string;
  /**
   * Optional CSS class name applied to the outer row container.
   */
  readonly className?: string;
  /**
   * Whether the toggle starts in the open state. Defaults to false.
   */
  readonly defaultOpen?: boolean;
  /**
   * Optional key for the content group.
   */
  readonly contentKey?: string;
}

/**
 * Wraps content fields in a Material slide toggle — the toggle state controls conditional visibility of the inner fields.
 *
 * Uses ng-forge's built-in `toggle` field type (MatSlideToggle) and
 * `FieldValueCondition` for conditional visibility. The toggle boolean value
 * IS part of the form model (standard ng-forge pattern).
 *
 * @param config - Toggle wrapper configuration
 * @returns A {@link RowField} containing the toggle and content group
 *
 * @dbxFormField
 * @dbxFormSlug toggle-wrapper
 * @dbxFormTier composite-builder
 * @dbxFormSuffix Wrapper
 * @dbxFormProduces RowField
 * @dbxFormArrayOutput no
 * @dbxFormConfigInterface DbxForgeToggleWrapperConfig
 * @dbxFormComposesFrom toggle, group
 *
 * @example
 * ```typescript
 * dbxForgeToggleWrapper({ label: 'Advanced', fields: [dbxForgeTextField({ key: 'note' })] })
 * ```
 */
export function dbxForgeToggleWrapper(config: DbxForgeToggleWrapperConfig): RowField {
  const toggleKey = config.key ?? `_toggle_${_dbxForgeToggleCounter++}`;

  // Built-in ng-forge toggle field (renders <mat-slide-toggle>)
  const toggleField: FieldDef<unknown> = {
    key: toggleKey,
    type: 'toggle' as const,
    label: config.label ?? '',
    value: config.defaultOpen ?? false
  } as FieldDef<unknown>;

  // Content group with conditional visibility based on toggle value
  const hiddenCondition: DbxForgeContainerLogicConfig = {
    type: 'hidden',
    condition: {
      type: 'fieldValue',
      fieldPath: toggleKey,
      operator: 'equals',
      value: false
    }
  };

  const contentGroup = dbxForgeGroup({
    key: config.contentKey,
    fields: config.fields as unknown as GroupAllowedChildren[],
    logic: [hiddenCondition]
  });

  return dbxForgeRow({
    fields: [toggleField as unknown as RowAllowedChildren, contentGroup as unknown as RowAllowedChildren],
    className: config.className ?? 'dbx-forge-toggle-wrapper'
  });
}

// MARK: Expand Wrapper
/**
 * Configuration for a forge expand wrapper that shows/hides content via a button or text link.
 */
export interface DbxForgeExpandWrapperConfig {
  /**
   * Fields to show/hide when the expand control is toggled.
   */
  readonly fields: FieldDef<unknown>[];
  /**
   * Label for the expand trigger.
   */
  readonly label?: string;
  /**
   * Visual style for the expand trigger. Defaults to `'text'`.
   */
  readonly buttonType?: DbxForgeExpandButtonType;
  /**
   * Key for the expand boolean field. Defaults to auto-generated `_expand_N`.
   */
  readonly key?: string;
  /**
   * Optional CSS class name applied to the outer row container.
   */
  readonly className?: string;
  /**
   * Whether the expand starts in the open state. Defaults to false.
   */
  readonly defaultOpen?: boolean;
  /**
   * Optional key for the content group.
   */
  readonly contentKey?: string;
}

/**
 * Wraps content fields behind a button or text "expand" control. Use for optional sections like "Show advanced options".
 *
 * Uses a custom `dbx-forge-expand` field type for the expand trigger and
 * `FieldValueCondition` for conditional visibility on the content group.
 * The expand boolean value IS part of the form model.
 *
 * @param config - Expand wrapper configuration
 * @returns A {@link RowField} containing the expand control and content group
 *
 * @dbxFormField
 * @dbxFormSlug expand-wrapper
 * @dbxFormTier composite-builder
 * @dbxFormSuffix Wrapper
 * @dbxFormProduces RowField
 * @dbxFormArrayOutput no
 * @dbxFormConfigInterface DbxForgeExpandWrapperConfig
 * @dbxFormComposesFrom group
 *
 * @example
 * ```typescript
 * dbxForgeExpandWrapper({ label: 'Show details', fields: [dbxForgeTextField({ key: 'note' })] })
 * ```
 */
export function dbxForgeExpandWrapper(config: DbxForgeExpandWrapperConfig): RowField {
  const expandKey = config.key ?? `_expand_${_dbxForgeExpandCounter++}`;

  const expandField: DbxForgeExpandFieldDef = {
    key: expandKey,
    type: FORGE_EXPAND_FIELD_TYPE_NAME,
    label: '',
    value: config.defaultOpen ?? false,
    props: {
      buttonType: config.buttonType ?? 'text',
      expandLabel: config.label ?? ''
    } as DbxForgeExpandFieldProps
  } as DbxForgeExpandFieldDef;

  const hiddenCondition: DbxForgeContainerLogicConfig = {
    type: 'hidden',
    condition: {
      type: 'fieldValue',
      fieldPath: expandKey,
      operator: 'equals',
      value: false
    }
  };

  const contentGroup = dbxForgeGroup({
    key: config.contentKey,
    fields: config.fields as unknown as GroupAllowedChildren[],
    logic: [hiddenCondition]
  });

  return dbxForgeRow({
    fields: [expandField as unknown as RowAllowedChildren, contentGroup as unknown as RowAllowedChildren],
    className: config.className ?? 'dbx-forge-expand-wrapper'
  });
}
