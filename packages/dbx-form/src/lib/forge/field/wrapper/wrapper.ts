import type { RowField, GroupField, FieldDef, RowAllowedChildren, GroupAllowedChildren, ConditionalExpression } from '@ng-forge/dynamic-forms';
import type { DbxSectionHeaderHType } from '@dereekb/dbx-web';
import { forgeDbxSectionFieldWrapper, forgeDbxSubsectionFieldWrapper, type ForgeSectionFieldDef } from './section/section.field';
import { forgeExpandField, type ForgeExpandButtonType } from './expand/expand.field';
import { forgeInfoButtonField } from './info/info.field';
import { forgeWorkingField } from './working/working.field';
import { forgeAutoTouchField } from './autotouch/autotouch.field';

/**
 * Logic configuration for container fields (group, row, array).
 *
 * Containers only support `'hidden'` since they are layout containers,
 * not form controls. This mirrors ng-forge's internal `ContainerLogicConfig`.
 */
export interface ForgeContainerLogicConfig {
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
  return {
    type: 'row',
    key: config.key ?? `_row_${_forgeRowCounter++}`,
    fields: config.fields as unknown as RowAllowedChildren[],
    ...(config.className != null && { className: config.className })
  } as RowField;
}

// MARK: Flex Row
/**
 * Configuration for a single field within a flex row,
 * pairing a field with an optional flex size.
 */
export interface ForgeFlexRowFieldConfig {
  /**
   * The field definition to include in the row.
   */
  readonly field: FieldDef<unknown>;
  /**
   * Flex size (1-6). Maps to col value via `col = size * 2`.
   * If undefined, defaults to the row's `defaultSize`.
   */
  readonly size?: number;
}

/**
 * Configuration for a forge flex row layout.
 *
 * This is the forge equivalent of formly's `formlyFlexLayoutWrapper()`,
 * accepting field/size pairs and a default size.
 */
export interface ForgeFlexRowConfig {
  /**
   * Optional key for the row.
   */
  readonly key?: string;
  /**
   * Fields to render. Can be plain field defs or field/size pairs.
   */
  readonly fields: (FieldDef<unknown> | ForgeFlexRowFieldConfig)[];
  /**
   * Default flex size for fields without an explicit size. Defaults to 2 (col 4).
   */
  readonly defaultSize?: number;
  /**
   * Whether to use relative sizing (equal columns based on field count).
   * When true, ignores `defaultSize` and `size` on individual fields,
   * and sets `--df-grid-columns` to the field count so each field gets equal space.
   */
  readonly relative?: boolean;
  /**
   * Optional CSS class name applied to the row container.
   */
  readonly className?: string;
}

/**
 * Type guard to check if input is a {@link ForgeFlexRowFieldConfig} with a `field` property.
 */
function isFlexRowFieldConfig(input: FieldDef<unknown> | ForgeFlexRowFieldConfig): input is ForgeFlexRowFieldConfig {
  return (input as ForgeFlexRowFieldConfig).field != null;
}

/**
 * Maps a flex size (1-6) to a col value (2-12).
 *
 * @param size - Flex size from 1 to 6
 * @returns Column span from 2 to 12
 */
export function flexSizeToCol(size: number): number {
  return Math.min(12, Math.max(1, size * 2));
}

/**
 * Creates a forge row layout that maps flex sizes to the 12-column grid.
 *
 * This is the forge equivalent of formly's `formlyFlexLayoutWrapper()`.
 * Each field can specify a flex `size` (1-6) which maps to a grid `col` (2-12)
 * via `col = size * 2`. Fields without an explicit size use `defaultSize`.
 *
 * @param config - Flex row configuration with fields, sizes, and optional className
 * @returns A {@link RowField} with type `'row'`
 *
 * @example
 * ```typescript
 * const row = forgeFlexRow({
 *   fields: [
 *     { field: forgeTextField({ key: 'first', label: 'First' }), size: 3 },
 *     { field: forgeTextField({ key: 'last', label: 'Last' }), size: 3 }
 *   ]
 * });
 * ```
 */
export function forgeFlexRow(config: ForgeFlexRowConfig): RowField {
  const { defaultSize = 2, relative = false } = config;

  if (relative) {
    // Relative mode: set --df-grid-columns to field count via CSS class
    // so each col:1 field gets equal 1/N space in the grid.
    const fields = config.fields.map((inputConfig) => {
      const field = isFlexRowFieldConfig(inputConfig) ? inputConfig.field : inputConfig;
      return { ...field, col: 1 };
    });

    const fieldCount = fields.length;
    const relativeClass = `dbx-forge-flex-${fieldCount}`;
    const className = config.className ? `${config.className} ${relativeClass}` : relativeClass;

    return forgeRow({
      key: config.key,
      fields,
      className
    });
  }

  const mappedFields = config.fields.map((inputConfig) => {
    const fieldConfig: ForgeFlexRowFieldConfig = isFlexRowFieldConfig(inputConfig) ? inputConfig : { field: inputConfig };

    const { field, size = defaultSize } = fieldConfig;
    const col = flexSizeToCol(size);

    return {
      ...field,
      col
    };
  });

  return forgeRow({
    key: config.key,
    fields: mappedFields,
    className: config.className ?? 'dbx-flex-group'
  });
}

// MARK: Group
/**
 * Configuration for a forge group layout.
 */
export interface ForgeGroupConfig {
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
  readonly logic?: ForgeContainerLogicConfig[];
}

/**
 * Creates a plain forge group layout field.
 *
 * Groups collect child field values into a nested object when a `key` is provided.
 * When used without a key, the group serves as a visual/logical grouping only.
 *
 * For sections with headers, use {@link forgeDbxSectionFieldWrapper} instead.
 *
 * @param config - Group configuration with fields and optional key/className
 * @returns A {@link GroupField} with type `'group'`
 */
export function forgeGroup(config: ForgeGroupConfig): GroupField {
  return {
    type: 'group',
    key: config.key ?? `_group_${_forgeGroupCounter++}`,
    fields: config.fields as unknown as GroupAllowedChildren[],
    ...(config.className != null && { className: config.className }),
    ...(config.logic != null && { logic: config.logic })
  } as GroupField;
}

// MARK: Section Group
/**
 * Configuration for a forge section group layout.
 *
 * @deprecated Use {@link ForgeSectionFieldConfig} with {@link forgeDbxSectionFieldWrapper} instead
 * for proper `<dbx-section>` wrapping.
 */
export interface ForgeSectionGroupConfig {
  readonly key?: string;
  readonly fields: FieldDef<unknown>[];
  readonly className?: string;
  readonly header?: string;
  readonly hint?: string;
  readonly icon?: string;
  readonly h?: DbxSectionHeaderHType;
  readonly logic?: ForgeContainerLogicConfig[];
}

/**
 * Creates a forge section field that wraps child fields inside `<dbx-section>`.
 *
 * @deprecated Use {@link forgeDbxSectionFieldWrapper} directly instead.
 */
export function forgeSectionGroup(config: ForgeSectionGroupConfig): ForgeSectionFieldDef {
  return forgeDbxSectionFieldWrapper({
    key: config.key,
    header: config.header,
    h: config.h,
    hint: config.hint,
    icon: config.icon,
    fields: config.fields
  });
}

// MARK: Subsection Group
/**
 * Configuration for a forge subsection group layout.
 *
 * @deprecated Use {@link ForgeSectionFieldConfig} with {@link forgeDbxSectionFieldWrapper} and `subsection: true` instead.
 */
export interface ForgeSubsectionGroupConfig {
  readonly key?: string;
  readonly fields: FieldDef<unknown>[];
  readonly className?: string;
  readonly header?: string;
  readonly hint?: string;
  readonly icon?: string;
  readonly h?: DbxSectionHeaderHType;
  readonly logic?: ForgeContainerLogicConfig[];
}

/**
 * Creates a forge subsection field that wraps child fields inside `<dbx-subsection>`.
 *
 * @deprecated Use {@link forgeDbxSubsectionFieldWrapper} or `forgeDbxSectionFieldWrapper({ subsection: true })` instead.
 */
export function forgeSubsectionGroup(config: ForgeSubsectionGroupConfig): ForgeSectionFieldDef {
  return forgeDbxSubsectionFieldWrapper({
    key: config.key,
    header: config.header,
    h: config.h,
    hint: config.hint,
    icon: config.icon,
    fields: config.fields
  });
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

/**
 * Configuration for a styled group.
 *
 * @deprecated Use {@link ForgeStyleFieldConfig} with {@link forgeStyleWrapper} instead for dynamic class/style support.
 */
export interface ForgeStyledGroupConfig {
  /**
   * Fields to wrap in the styled group.
   */
  readonly fields: FieldDef<unknown>[];
  /**
   * CSS class name(s) to apply to the group container.
   */
  readonly className: string;
  /**
   * Optional key for the group.
   */
  readonly key?: string;
}

/**
 * Wraps fields in a group with a CSS class applied.
 *
 * This is the forge equivalent of the formly `formlyStyleWrapper` for grouping
 * multiple fields under a common CSS class.
 *
 * @deprecated Use {@link forgeStyleWrapper} instead for proper wrapper support with dynamic class/style.
 *
 * @param config - Styled group configuration
 * @returns A {@link GroupField} with `className` set
 *
 * @example
 * ```typescript
 * const styled = forgeStyledGroup({
 *   className: 'highlight-section',
 *   fields: [
 *     forgeTextField({ key: 'a', label: 'A' }),
 *     forgeTextField({ key: 'b', label: 'B' })
 *   ]
 * });
 * ```
 */
export function forgeStyledGroup(config: ForgeStyledGroupConfig): GroupField {
  return forgeGroup({
    key: config.key,
    fields: config.fields,
    className: config.className
  });
}

// MARK: Toggle Wrapper
/**
 * Configuration for a forge toggle wrapper that shows/hides content via a slide toggle.
 */
export interface ForgeToggleWrapperConfig {
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
export function forgeToggleWrapper(config: ForgeToggleWrapperConfig): RowField {
  const toggleKey = config.key ?? `_toggle_${_forgeToggleCounter++}`;

  // Built-in ng-forge toggle field (renders <mat-slide-toggle>)
  const toggleField: FieldDef<unknown> = {
    key: toggleKey,
    type: 'toggle' as const,
    label: config.label ?? '',
    value: config.defaultOpen ?? false
  } as FieldDef<unknown>;

  // Content group with conditional visibility based on toggle value
  const hiddenCondition: ForgeContainerLogicConfig = {
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
export interface ForgeExpandWrapperConfig {
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
  readonly buttonType?: ForgeExpandButtonType;
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
export function forgeExpandWrapper(config: ForgeExpandWrapperConfig): RowField {
  const expandKey = config.key ?? `_expand_${_forgeExpandCounter++}`;

  const expandField = forgeExpandField({
    key: expandKey,
    label: config.label,
    buttonType: config.buttonType,
    defaultOpen: config.defaultOpen
  });

  const hiddenCondition: ForgeContainerLogicConfig = {
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

// MARK: Info Wrapper
/**
 * Configuration for a forge info wrapper that adds an info button beside a field.
 *
 * @deprecated Use {@link ForgeInfoWrapperFieldConfig} with {@link forgeInfoFieldWrapper} instead.
 */
export interface ForgeInfoWrapperConfig {
  /**
   * The field to display alongside the info button.
   */
  readonly field: FieldDef<unknown>;
  /**
   * Callback invoked when the info button is clicked.
   */
  readonly onInfoClick: () => void;
  /**
   * Column span for the main field. Defaults to 11.
   */
  readonly fieldCol?: number;
  /**
   * Column span for the info button. Defaults to 1.
   */
  readonly buttonCol?: number;
  /**
   * Accessible label for the info button.
   */
  readonly ariaLabel?: string;
}

/**
 * Creates a forge info wrapper that places an info icon button beside a field.
 *
 * Returns a RowField with the main field on the left and an info icon button
 * on the right. Clicking the button invokes the provided callback.
 *
 * @deprecated Use {@link forgeInfoFieldWrapper} instead for proper wrapper support with group wrapping.
 *
 * @param config - Info wrapper configuration
 * @returns A {@link RowField} containing the field and info button
 *
 * @example
 * ```typescript
 * const withInfo = forgeInfoWrapper({
 *   field: forgeTextField({ key: 'email', label: 'Email' }),
 *   onInfoClick: () => openEmailHelp()
 * });
 * ```
 */
export function forgeInfoWrapper(config: ForgeInfoWrapperConfig): RowField {
  const { field, onInfoClick, fieldCol = 11, buttonCol = 1, ariaLabel } = config;

  const infoButton = forgeInfoButtonField({ onInfoClick, ariaLabel });

  return forgeRow({
    fields: [{ ...field, col: fieldCol } as FieldDef<unknown> & { col?: number }, { ...(infoButton as unknown as FieldDef<unknown>), col: buttonCol } as FieldDef<unknown> & { col?: number }]
  });
}

// MARK: Working Wrapper
/**
 * Wraps a field with a loading indicator that shows during async validation.
 *
 * Returns a GroupField containing the original field and a working indicator
 * component that shows a progress bar when the field has pending validation.
 *
 * @deprecated Use {@link forgeWorkingFieldWrapper} instead for proper wrapper support.
 *
 * @param field - The field to wrap with a working indicator
 * @returns A {@link GroupField} containing the field and working indicator
 *
 * @example
 * ```typescript
 * const withWorking = forgeWorkingWrapper(
 *   forgeTextField({ key: 'username', label: 'Username' })
 * );
 * ```
 */
export function forgeWorkingWrapper(field: FieldDef<unknown>): GroupField {
  const workingField = forgeWorkingField({ watchFieldKey: field.key });

  return forgeGroup({
    fields: [field, workingField as FieldDef<unknown>],
    className: 'dbx-forge-working-wrapper'
  });
}

// MARK: AutoTouch Wrapper
/**
 * Wraps a field with auto-touch behavior that marks it as touched on value change.
 *
 * Returns a RowField containing the original field and a hidden autotouch
 * component that monitors value changes and triggers touch state.
 *
 * @deprecated Auto-touch behavior is no longer needed with ng-forge signal forms.
 *
 * @param field - The field to wrap with auto-touch behavior
 * @returns A {@link RowField} containing the field and autotouch component
 */
export function forgeAutoTouchWrapper(field: FieldDef<unknown>): RowField {
  const autoTouchField = forgeAutoTouchField({ watchFieldKey: field.key });

  return forgeRow({
    fields: [field as FieldDef<unknown> & { col?: number }, autoTouchField as unknown as FieldDef<unknown> & { col?: number }]
  });
}
