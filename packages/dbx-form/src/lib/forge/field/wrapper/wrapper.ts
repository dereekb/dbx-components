import type { RowField, GroupField, ContainerField, FieldDef, ConditionalExpression, WrapperConfig } from '@ng-forge/dynamic-forms';
import { FORGE_EXPAND_FIELD_TYPE_NAME, type DbxForgeExpandButtonType, type DbxForgeExpandFieldDef, type DbxForgeExpandFieldProps } from './expand/expand.field';
import { DBX_FORGE_FLEX_WRAPPER_TYPE_NAME, type DbxForgeFlexWrapper } from './flex/flex.wrapper';
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
let _dbxForgeContainerCounter = 0;
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
 * Extends {@link GroupField} with `type` omitted (always `'group'`). The `key`
 * is required because a `group` field creates a nested object in the form value
 * under that key — it is part of the value shape, not a display-only identifier.
 */
export interface DbxForgeGroupConfig extends Omit<GroupField, 'type'> {}

/**
 * Creates a plain ng-forge `group` field. A group produces a nested object in
 * the form value under its `key`, so the key is semantically significant and
 * must be chosen deliberately.
 *
 * For visual-only grouping (conditional visibility, layout wrappers, shared
 * CSS class) that should NOT introduce a nested object in the form value, use
 * {@link dbxForgeContainer} instead — that is what ng-forge's `container`
 * field type is for.
 *
 * For sections with headers, use the section wrapper type instead.
 *
 * @param config - Group configuration with fields and required key
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
 * // Groups the address sub-fields under an `address` property in the form value.
 * const group = dbxForgeGroup({
 *   key: 'address',
 *   fields: [
 *     dbxForgeTextField({ key: 'city', label: 'City' }),
 *     dbxForgeTextField({ key: 'state', label: 'State' })
 *   ]
 * });
 *
 * // Resulting form value shape:
 * // { address: { city: '...', state: '...' } }
 * ```
 *
 * @example
 * ```typescript
 * // Wrong: if the intent is purely visual (e.g. conditional visibility) and
 * // the fields should remain at the parent level in the form value, do NOT
 * // use a group — use dbxForgeContainer instead. Otherwise you end up with a
 * // spurious nested object:
 * //   { _group_0: { city: '...', state: '...' } }   // ← unwanted wrapper
 * ```
 */
export function dbxForgeGroup(config: DbxForgeGroupConfig): GroupField {
  return {
    ...config,
    type: 'group'
  } as GroupField;
}

// MARK: Container
/**
 * Configuration for a forge container layout.
 *
 * Extends {@link ContainerField} with `type` omitted (always `'container'`),
 * `key` made optional (auto-generated if omitted), and `wrappers` made optional
 * (defaults to an empty array).
 */
export interface DbxForgeContainerConfig extends Omit<ContainerField, 'type' | 'key' | 'wrappers'> {
  /**
   * Optional key for the container. Defaults to a unique auto-generated key.
   *
   * Containers do not introduce a nested object in the form value — the key is
   * only an identifier and is not part of the value shape. Must still be unique
   * within the form config to avoid ng-forge duplicate key errors.
   */
  readonly key?: string;
  /**
   * Optional wrapper configs to chain around the children. Defaults to `[]`.
   */
  readonly wrappers?: readonly WrapperConfig[];
}

/**
 * Creates an ng-forge `container` field. Containers group child fields for
 * layout, conditional visibility, or wrapper application WITHOUT introducing
 * a nested object in the form value — child values remain at the same level
 * as the container itself.
 *
 * Use this (not {@link dbxForgeGroup}) whenever the grouping is purely visual
 * or structural. Use {@link dbxForgeGroup} when the intent is to nest the
 * child values under a named key in the form value.
 *
 * @param config - Container configuration with fields and optional key/wrappers
 * @returns A {@link ContainerField} with type `'container'`
 *
 * @example
 * ```typescript
 * // Visual-only grouping (e.g. to apply a CSS class or a wrapper). Children
 * // remain at the parent level in the form value — the container itself
 * // does not add a property.
 * const container = dbxForgeContainer({
 *   className: 'dbx-highlight-group',
 *   fields: [
 *     dbxForgeTextField({ key: 'city', label: 'City' }),
 *     dbxForgeTextField({ key: 'state', label: 'State' })
 *   ]
 * });
 *
 * // Resulting form value shape (flat):
 * // { city: '...', state: '...' }
 * ```
 *
 * @example
 * ```typescript
 * // Conditional visibility without altering the value shape — a common use
 * // case that should NOT use dbxForgeGroup.
 * const container = dbxForgeContainer({
 *   fields: [dbxForgeTextField({ key: 'jwks_uri', label: 'JWKS URI' })],
 *   logic: [{
 *     type: 'hidden',
 *     condition: { type: 'fieldValue', fieldPath: 'authMethod', operator: 'notEquals', value: 'private_key_jwt' }
 *   }]
 * });
 *
 * // Resulting form value shape (jwks_uri stays flat, not nested):
 * // { authMethod: '...', jwks_uri: '...' }
 * ```
 */
export function dbxForgeContainer(config: DbxForgeContainerConfig): ContainerField {
  const { key: inputKey, wrappers, ...rest } = config;

  return {
    ...rest,
    type: 'container',
    key: inputKey ?? `_container_${_dbxForgeContainerCounter++}`,
    wrappers: wrappers ?? []
  } as ContainerField;
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
   * Optional key for the content container. Auto-generated if omitted.
   *
   * The container does not add a property to the form value; this is only a
   * stable identifier for the container field.
   */
  readonly contentKey?: string;
}

/**
 * Wraps content fields in a Material slide toggle — the toggle state controls conditional visibility of the inner fields.
 *
 * Uses ng-forge's built-in `toggle` field type (MatSlideToggle) and
 * `FieldValueCondition` for conditional visibility. The toggle boolean value
 * IS part of the form model. The hidden content is wrapped in a `container`
 * (not a `group`), so the wrapped fields sit at the same level as the toggle
 * in the form value — they are NOT nested under an extra object.
 *
 * Structure produced:
 * ```
 * Container (outer, with flex wrapper)
 *   ├── toggle field (type: 'toggle', boolean value)
 *   └── Container (content, hidden when toggle === false)
 * ```
 *
 * This is the forge equivalent of the formly `formlyToggleWrapper`.
 *
 * @param config - Toggle wrapper configuration
 * @returns A {@link ContainerField} containing the toggle and content container
 *
 * @dbxFormField
 * @dbxFormSlug toggle-wrapper
 * @dbxFormTier composite-builder
 * @dbxFormSuffix Wrapper
 * @dbxFormProduces ContainerField
 * @dbxFormArrayOutput no
 * @dbxFormConfigInterface DbxForgeToggleWrapperConfig
 * @dbxFormComposesFrom toggle, group
 *
 * @example
 * ```typescript
 * const toggle = dbxForgeToggleWrapper({
 *   key: 'showAdvanced',
 *   label: 'Show advanced options',
 *   fields: [
 *     dbxForgeTextField({ key: 'advanced1', label: 'Option 1' }),
 *     dbxForgeTextField({ key: 'advanced2', label: 'Option 2' })
 *   ]
 * });
 *
 * // Resulting form value (flat — no nesting under the container):
 * // { showAdvanced: true, advanced1: '...', advanced2: '...' }
 * ```
 */
export function dbxForgeToggleWrapper(config: DbxForgeToggleWrapperConfig): ContainerField {
  const toggleKey = config.key ?? `_toggle_${_dbxForgeToggleCounter++}`;

  // Built-in ng-forge toggle field (renders <mat-slide-toggle>)
  const toggleField: FieldDef<unknown> = {
    key: toggleKey,
    type: 'toggle',
    label: config.label ?? '',
    value: config.defaultOpen ?? false
  } as FieldDef<unknown>;

  // Content container with conditional visibility based on toggle value.
  // A container is used (not a group) so the wrapped fields stay at the same
  // level in the form value as the toggle itself.
  const hiddenCondition: DbxForgeContainerLogicConfig = {
    type: 'hidden',
    condition: {
      type: 'fieldValue',
      fieldPath: toggleKey,
      operator: 'equals',
      value: false
    }
  };

  const contentContainer = dbxForgeContainer({
    ...(config.contentKey != null && { key: config.contentKey }),
    fields: config.fields as unknown as ContainerField['fields'],
    logic: [hiddenCondition]
  });

  const flexWrapper: DbxForgeFlexWrapper = { type: DBX_FORGE_FLEX_WRAPPER_TYPE_NAME };

  return dbxForgeContainer({
    fields: [toggleField, contentContainer] as unknown as ContainerField['fields'],
    className: config.className ?? 'dbx-forge-toggle-wrapper',
    wrappers: [flexWrapper]
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
   * Optional key for the content container. Auto-generated if omitted.
   *
   * The container does not add a property to the form value; this is only a
   * stable identifier for the container field.
   */
  readonly contentKey?: string;
}

/**
 * Wraps content fields behind a button or text "expand" control. Use for optional sections like "Show advanced options".
 *
 * Uses a custom `dbx-forge-expand` field type for the expand trigger and
 * `FieldValueCondition` for conditional visibility on the content. The
 * expand boolean value IS part of the form model. The hidden content is
 * wrapped in a `container` (not a `group`), so the wrapped fields sit at the
 * same level as the expand control in the form value — they are NOT nested
 * under an extra object.
 *
 * Structure produced:
 * ```
 * Container (outer, with flex wrapper)
 *   ├── expand field (type: 'dbx-forge-expand', boolean value)
 *   └── Container (content, hidden when expand field === false)
 * ```
 *
 * This is the forge equivalent of the formly `formlyExpandWrapper`.
 *
 * @param config - Expand wrapper configuration
 * @returns A {@link ContainerField} containing the expand control and content container
 *
 * @dbxFormField
 * @dbxFormSlug expand-wrapper
 * @dbxFormTier composite-builder
 * @dbxFormSuffix Wrapper
 * @dbxFormProduces ContainerField
 * @dbxFormArrayOutput no
 * @dbxFormConfigInterface DbxForgeExpandWrapperConfig
 * @dbxFormComposesFrom group
 *
 * @example
 * ```typescript
 * const expand = dbxForgeExpandWrapper({
 *   key: 'showMore',
 *   label: 'Show more options',
 *   buttonType: 'button',
 *   fields: [
 *     dbxForgeTextField({ key: 'extra1', label: 'Extra 1' }),
 *     dbxForgeTextField({ key: 'extra2', label: 'Extra 2' })
 *   ]
 * });
 *
 * // Resulting form value (flat — no nesting under the container):
 * // { showMore: true, extra1: '...', extra2: '...' }
 * ```
 */
export function dbxForgeExpandWrapper(config: DbxForgeExpandWrapperConfig): ContainerField {
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

  const contentContainer = dbxForgeContainer({
    ...(config.contentKey != null && { key: config.contentKey }),
    fields: config.fields as unknown as ContainerField['fields'],
    logic: [hiddenCondition]
  });

  const flexWrapper: DbxForgeFlexWrapper = { type: DBX_FORGE_FLEX_WRAPPER_TYPE_NAME };

  return dbxForgeContainer({
    fields: [expandField, contentContainer] as unknown as ContainerField['fields'],
    className: config.className ?? 'dbx-forge-expand-wrapper',
    wrappers: [flexWrapper]
  });
}
