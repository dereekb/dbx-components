import type { FieldDef, GroupField, GroupAllowedChildren } from '@ng-forge/dynamic-forms';
import type { DbxFlexSize, ScreenMediaWidthType } from '@dereekb/dbx-web';
import { dbxForgeGroup } from '../wrapper';

// MARK: Wrapper Type
/**
 * Registered wrapper type name for the flex layout wrapper.
 */
export const DBX_FORGE_FLEX_WRAPPER_TYPE_NAME = 'dbx-forge-flex' as const;

/**
 * Wrapper config for the flex layout wrapper.
 *
 * Provides responsive flex layout behavior via the `dbxFlexGroup` directive.
 */
export interface DbxForgeFlexWrapper {
  readonly type: typeof DBX_FORGE_FLEX_WRAPPER_TYPE_NAME;
  /**
   * Breakpoint based on the screen width below which fields stack.
   */
  readonly breakpoint?: ScreenMediaWidthType;
  /**
   * Whether to use relative sizing (removes max-width constraints).
   */
  readonly relative?: boolean;
  /**
   * Whether to break to a column layout when the breakpoint is reached.
   */
  readonly breakToColumn?: boolean;
}

// MARK: Flex Layout
/**
 * Configuration for a single field within a flex layout,
 * pairing a field definition with an optional flex size.
 */
export interface DbxForgeFlexLayoutFieldConfig {
  readonly field: FieldDef<unknown>;
  /**
   * Flex space sizing for the field (1-6). Defaults to the layout-level default size.
   */
  readonly size?: DbxFlexSize;
}

/**
 * Default configuration for a flex layout, combining flex wrapper settings
 * with a default size for fields that don't specify their own.
 */
export interface DbxForgeFlexLayoutConfig extends Omit<DbxForgeFlexWrapper, 'type'> {
  /**
   * Default flex size for fields that don't specify their own.
   *
   * @defaultValue 2
   */
  readonly size?: DbxFlexSize;
}

/**
 * Type guard that checks if the input is a {@link DbxForgeFlexLayoutFieldConfig}
 * (has a `field` property) rather than a plain {@link FieldDef}.
 *
 * @param input - the field definition or flex layout field config to check
 * @returns true if the input is a {@link DbxForgeFlexLayoutFieldConfig} with a `field` property
 */
function isFlexFieldConfig(input: FieldDef<unknown> | DbxForgeFlexLayoutFieldConfig): input is DbxForgeFlexLayoutFieldConfig {
  return (input as DbxForgeFlexLayoutFieldConfig).field != null;
}

/**
 * Responsive flex group — children lay out horizontally at wide breakpoints and stack at narrow ones. Per-field `size` overrides the default column weight.
 *
 * Each child field gets a `dbx-flex-N` CSS class applied (merged with any existing className).
 * The group is wrapped with the `dbx-forge-flex` wrapper that renders the `dbxFlexGroup` directive
 * for responsive breakpoint handling.
 *
 * This is the forge equivalent of {@link formlyFlexLayoutWrapper}.
 *
 * @param fieldConfigs - Array of field definitions or `{ field, size }` pairs with size overrides
 * @param config - Flex layout defaults including breakpoint, relative sizing, and default size
 * @returns A {@link GroupField} with flex wrapper applied and sized children
 *
 * @dbxFormField
 * @dbxFormSlug flex-layout
 * @dbxFormTier composite-builder
 * @dbxFormSuffix Layout
 * @dbxFormProduces GroupField
 * @dbxFormArrayOutput no
 * @dbxFormConfigInterface DbxForgeFlexLayoutConfig
 * @dbxFormComposesFrom group
 *
 * @example
 * ```typescript
 * dbxForgeFlexLayout({ fieldConfigs: [dbxForgeTextField({ key: 'a' }), dbxForgeTextField({ key: 'b' })] })
 * ```
 */
export function dbxForgeFlexLayout(fieldConfigs: (FieldDef<unknown> | DbxForgeFlexLayoutFieldConfig)[], config: DbxForgeFlexLayoutConfig = {}): GroupField {
  const { breakpoint, relative, breakToColumn, size: defaultSize = 2 } = config;

  const mappedFields = fieldConfigs.map((input) => {
    const { field, size = defaultSize } = isFlexFieldConfig(input) ? input : { field: input };
    const flexClassName = `dbx-flex-${size}`;
    const className = field.className ? `${field.className} ${flexClassName}` : flexClassName;
    return { ...field, className };
  });

  const flexWrapper: DbxForgeFlexWrapper = {
    type: DBX_FORGE_FLEX_WRAPPER_TYPE_NAME,
    ...(breakpoint != null && { breakpoint }),
    ...(relative != null && { relative }),
    ...(breakToColumn != null && { breakToColumn })
  };

  return dbxForgeGroup({
    fields: mappedFields as unknown as GroupAllowedChildren[],
    className: 'dbx-flex-group',
    wrappers: [flexWrapper]
  });
}
