import type { ContainerField, FieldDef } from '@ng-forge/dynamic-forms';
import type { DbxFlexSize, ScreenMediaWidthType } from '@dereekb/dbx-web';
import { dbxForgeContainer } from '../wrapper';

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
   * Fields to include in the layout. Each entry may be a plain {@link FieldDef}
   * or a {@link DbxForgeFlexLayoutFieldConfig} with a per-field size override.
   */
  readonly fields?: readonly (FieldDef<unknown> | DbxForgeFlexLayoutFieldConfig)[];
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

export function dbxForgeFlexLayout(config: DbxForgeFlexLayoutConfig): ContainerField;
/**
 * @deprecated Pass a {@link DbxForgeFlexLayoutConfig} object instead — the array form
 * diverges from how every other forge field factory is configured. Move array entries
 * into the `fields` property of the config object.
 */
export function dbxForgeFlexLayout(fields: readonly (FieldDef<unknown> | DbxForgeFlexLayoutFieldConfig)[], config?: Omit<DbxForgeFlexLayoutConfig, 'fields'>): ContainerField;
/**
 * Creates a responsive flex layout container that arranges child fields horizontally
 * with configurable sizing, breakpoints, and responsive behavior.
 *
 * Each child field gets a `dbx-flex-N` CSS class applied (merged with any existing className).
 * The container hosts the `dbx-forge-flex` wrapper, which renders the `dbxFlexGroup`
 * directive for responsive breakpoint handling.
 *
 * A `container` is used (not a `group`) because flex layout is purely visual —
 * the wrapped fields should remain at the same level in the form value, not be
 * nested under an extra object.
 *
 * This is the forge equivalent of {@link formlyFlexLayoutWrapper}.
 *
 * @param input - {@link DbxForgeFlexLayoutConfig} with a `fields` property and layout defaults.
 *   For backwards compatibility, may also be passed as a deprecated array of fields paired with an optional config.
 * @returns A {@link ContainerField} with the flex wrapper applied and sized children
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
 * // Simple: all fields get default size (2)
 * dbxForgeFlexLayout({ fields: [dbxForgeCityField({}), dbxForgeStateField({}), dbxForgeZipCodeField({})] })
 *
 * // Resulting form value shape (flat — no wrapper property):
 * // { city: '...', state: '...', zip: '...' }
 *
 * // With per-field sizing and breakpoint
 * dbxForgeFlexLayout({
 *   breakpoint: 'small',
 *   size: 1,
 *   fields: [
 *     { field: dbxForgeCityField({}), size: 4 },
 *     dbxForgeStateField({}),
 *     dbxForgeZipCodeField({})
 *   ]
 * })
 *
 * // Full config
 * dbxForgeFlexLayout({ breakpoint: 'large', breakToColumn: true, relative: true, size: 1, fields: [...] })
 * ```
 */
export function dbxForgeFlexLayout(input: DbxForgeFlexLayoutConfig | readonly (FieldDef<unknown> | DbxForgeFlexLayoutFieldConfig)[], legacyConfig?: Omit<DbxForgeFlexLayoutConfig, 'fields'>): ContainerField {
  const config: DbxForgeFlexLayoutConfig = Array.isArray(input) ? { ...legacyConfig, fields: input } : (input as DbxForgeFlexLayoutConfig);
  const { breakpoint, relative, breakToColumn, size: defaultSize = 2, fields = [] } = config;

  const mappedFields = fields.map((entry) => {
    const { field, size = defaultSize } = isFlexFieldConfig(entry) ? entry : { field: entry };
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

  return dbxForgeContainer({
    fields: mappedFields as unknown as ContainerField['fields'],
    className: 'dbx-flex-group',
    wrappers: [flexWrapper]
  });
}
