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

let _forgeRowCounter = 0;
let _forgeGroupCounter = 0;
let _forgeToggleCounter = 0;
let _forgeExpandCounter = 0;

// MARK: Row
/**
 * Configuration for a forge row layout that arranges fields horizontally.
 */
export interface DbxForgeRowConfig {
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
export function forgeRow(config: DbxForgeRowConfig): RowField {
  return {
    type: 'row',
    key: config.key ?? `_row_${_forgeRowCounter++}`,
    fields: config.fields as unknown as RowAllowedChildren[],
    ...(config.className != null && { className: config.className })
  } as RowField;
}

// MARK: Group
/**
 * Configuration for a forge group layout.
 */
export interface DbxForgeGroupConfig {
  /**
   * Optional key for the group.
   */
  readonly key?: string;
  /**
   * Fields contained in this group.
   */
  readonly fields: FieldDef<unknown>[];
  /**
   * Optional CSS class name applied to the group container.
   */
  readonly className?: string;
  /**
   * Optional conditional visibility logic for this group.
   */
  readonly logic?: DbxForgeContainerLogicConfig[];
}

/**
 * Creates a plain forge group layout field.
 *
 * Groups collect child field values into a nested object when a `key` is provided.
 * When used without a key, the group serves as a visual/logical grouping only.
 *
 * For sections with headers, use the section wrapper type instead.
 *
 * @param config - Group configuration with fields and optional key/className
 * @returns A {@link GroupField} with type `'group'`
 */
export function forgeGroup(config: DbxForgeGroupConfig): GroupField {
  return {
    type: 'group',
    key: config.key ?? `_group_${_forgeGroupCounter++}`,
    fields: config.fields as unknown as GroupAllowedChildren[],
    ...(config.className != null && { className: config.className }),
    ...(config.logic != null && { logic: config.logic })
  } as GroupField;
}

// MARK: Style Utilities
/**
 * Applies a CSS class name to a field definition.
 *
 * Returns a shallow copy of the field with the `className` property set.
 * This is the forge equivalent of applying the formly `formlyStyleWrapper`
 * for static class names.
 *
 * @param field - The field definition to style
 * @param className - CSS class name(s) to apply
 * @returns A copy of the field with `className` set
 *
 * @example
 * ```typescript
 * const styled = forgeWithClassName(forgeTextField({ key: 'name', label: 'Name' }), 'my-custom-class');
 * ```
 */
export function forgeWithClassName<T extends FieldDef<unknown>>(field: T, className: string): T {
  return { ...field, className };
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
 * Creates a forge toggle wrapper that shows/hides content via a Material slide toggle.
 *
 * Uses ng-forge's built-in `toggle` field type (MatSlideToggle) and
 * `FieldValueCondition` for conditional visibility. The toggle boolean value
 * IS part of the form model (standard ng-forge pattern).
 *
 * Structure produced:
 * ```
 * Row (outer)
 *   ├── toggle field (type: 'toggle', boolean value)
 *   └── Group (content, hidden when toggle === false)
 * ```
 *
 * This is the forge equivalent of the formly `formlyToggleWrapper`.
 *
 * @param config - Toggle wrapper configuration
 * @returns A {@link RowField} containing the toggle and content group
 *
 * @example
 * ```typescript
 * const toggle = forgeToggleWrapper({
 *   label: 'Show advanced options',
 *   fields: [
 *     forgeTextField({ key: 'advanced1', label: 'Option 1' }),
 *     forgeTextField({ key: 'advanced2', label: 'Option 2' })
 *   ]
 * });
 * ```
 */
export function forgeToggleWrapper(config: DbxForgeToggleWrapperConfig): RowField {
  const toggleKey = config.key ?? `_toggle_${_forgeToggleCounter++}`;

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

  const contentGroup = forgeGroup({
    key: config.contentKey,
    fields: config.fields,
    logic: [hiddenCondition]
  });

  return forgeRow({
    fields: [toggleField as FieldDef<unknown> & { col?: number }, contentGroup as unknown as FieldDef<unknown> & { col?: number }],
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
 * Creates a forge expand wrapper that shows/hides content via a button or text link.
 *
 * Uses a custom `dbx-forge-expand` field type for the expand trigger and
 * `FieldValueCondition` for conditional visibility on the content group.
 * The expand boolean value IS part of the form model.
 *
 * Structure produced:
 * ```
 * Row (outer)
 *   ├── expand field (type: 'dbx-forge-expand', boolean value)
 *   └── Group (content, hidden when expand field === false)
 * ```
 *
 * This is the forge equivalent of the formly `formlyExpandWrapper`.
 *
 * @param config - Expand wrapper configuration
 * @returns A {@link RowField} containing the expand control and content group
 *
 * @example
 * ```typescript
 * const expand = forgeExpandWrapper({
 *   label: 'Show more options',
 *   buttonType: 'button',
 *   fields: [
 *     forgeTextField({ key: 'extra1', label: 'Extra 1' }),
 *     forgeTextField({ key: 'extra2', label: 'Extra 2' })
 *   ]
 * });
 * ```
 */
export function forgeExpandWrapper(config: DbxForgeExpandWrapperConfig): RowField {
  const expandKey = config.key ?? `_expand_${_forgeExpandCounter++}`;

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

  const contentGroup = forgeGroup({
    key: config.contentKey,
    fields: config.fields,
    logic: [hiddenCondition]
  });

  return forgeRow({
    fields: [expandField as unknown as FieldDef<unknown> & { col?: number }, contentGroup as unknown as FieldDef<unknown> & { col?: number }],
    className: config.className ?? 'dbx-forge-expand-wrapper'
  });
}
