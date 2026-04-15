import type { FieldDef, WrapperField, WrapperTypeDefinition } from '@ng-forge/dynamic-forms';
import type { DbxSectionHeaderConfig, DbxSectionHeaderHType } from '@dereekb/dbx-web';
import { filterFromPOJO } from '@dereekb/util';

// MARK: Wrapper Type
/**
 * Registered wrapper type name for the section wrapper.
 *
 * Used in {@link WrapperConfig.type} to identify this wrapper when building
 * wrapper chains.
 */
export const DBX_FORGE_SECTION_WRAPPER_TYPE_NAME = 'dbx-forge-section' as const;

/**
 * Configuration for the section wrapper type.
 *
 * Wraps child fields inside a `<dbx-section>` or `<dbx-subsection>` component
 * with proper semantic structure, header, and content area styling.
 *
 * @example
 * ```typescript
 * const wrapper: DbxForgeSectionWrapper = {
 *   type: 'dbx-forge-section',
 *   headerConfig: { header: 'Contact Info', h: 3 },
 *   elevate: true,
 * };
 * ```
 */
export interface DbxForgeSectionWrapper {
  readonly type: typeof DBX_FORGE_SECTION_WRAPPER_TYPE_NAME;
  /**
   * Section header configuration.
   */
  readonly headerConfig: DbxSectionHeaderConfig;
  /**
   * Whether to apply elevated card styling to the section.
   */
  readonly elevate?: boolean;
  /**
   * Whether to render as a `<dbx-subsection>` instead of `<dbx-section>`.
   */
  readonly subsection?: boolean;
}

/**
 * ng-forge {@link WrapperTypeDefinition} registration for the section wrapper.
 *
 * Lazy-loads {@link DbxForgeSectionWrapperComponent} which implements
 * {@link FieldWrapperContract} and injects {@link WRAPPER_FIELD_CONTEXT}
 * for its header, elevate, and subsection configuration.
 */
export const DBX_FORGE_SECTION_WRAPPER_TYPE: WrapperTypeDefinition<DbxForgeSectionWrapper> = {
  wrapperName: DBX_FORGE_SECTION_WRAPPER_TYPE_NAME,
  loadComponent: () => import('./section.wrapper.component').then((m) => m.DbxForgeSectionWrapperComponent)
};

// MARK: Config
/**
 * Configuration for creating a forge section wrapper field.
 */
export interface DbxForgeSectionFieldConfig {
  /**
   * Header text to display.
   */
  readonly header?: string;
  /**
   * Heading level (1-5). Defaults to 3 for sections.
   */
  readonly h?: DbxSectionHeaderHType;
  /**
   * Optional hint text displayed below or inline with the header.
   */
  readonly hint?: string;
  /**
   * Optional Material icon name displayed before the header text.
   */
  readonly icon?: string;
  /**
   * Whether the hint text displays inline with the header.
   */
  readonly hintInline?: boolean;
  /**
   * Whether to apply elevated card styling. Defaults to false.
   */
  readonly elevate?: boolean;
  /**
   * Whether to render as a `<dbx-subsection>` instead of `<dbx-section>`.
   * When true, defaults heading level to 4.
   */
  readonly subsection?: boolean;
  /**
   * Optional key override. Defaults to auto-generated `_section_N`.
   */
  readonly key?: string;
  /**
   * Child field definitions to render inside the section.
   */
  readonly fields: FieldDef<unknown>[];
}

let _forgeDbxSectionFieldWrapperCounter = 0;

/**
 * Creates a forge section wrapper field that renders child fields inside
 * a `<dbx-section>` component.
 *
 * Unlike `forgeSectionGroup` which prepends a header field alongside children,
 * this wraps child fields inside an actual `<dbx-section>` with proper semantic
 * structure, content area styling, and header configuration.
 *
 * @param config - Section wrapper configuration
 * @returns A {@link WrapperField}
 *
 * @example
 * ```typescript
 * const section = forgeDbxSectionFieldWrapper({
 *   header: 'Contact Info',
 *   hint: 'Required fields',
 *   icon: 'person',
 *   fields: [
 *     forgeTextField({ key: 'name', label: 'Name' }),
 *     forgeTextField({ key: 'email', label: 'Email' })
 *   ]
 * });
 * ```
 */
export function forgeDbxSectionFieldWrapper(config: DbxForgeSectionFieldConfig): WrapperField {
  const { header, h, hint, icon, hintInline, elevate, subsection, fields, key } = config;
  const defaultH = subsection ? 4 : 3;

  const headerConfig: DbxSectionHeaderConfig = filterFromPOJO({
    header,
    h: h ?? defaultH,
    hint,
    icon,
    hintInline
  });

  const wrapperConfig: DbxForgeSectionWrapper = filterFromPOJO({
    type: DBX_FORGE_SECTION_WRAPPER_TYPE_NAME,
    headerConfig,
    elevate,
    subsection
  }) as DbxForgeSectionWrapper;

  return {
    type: 'wrapper',
    key: key ?? `_section_${_forgeDbxSectionFieldWrapperCounter++}`,
    fields,
    wrappers: [wrapperConfig]
  } as unknown as WrapperField;
}

/**
 * Creates a forge subsection wrapper field that renders child fields inside
 * a `<dbx-subsection>` component. Defaults heading level to 4.
 *
 * @param config - Subsection wrapper configuration
 * @returns A {@link WrapperField}
 *
 * @example
 * ```typescript
 * const subsection = forgeDbxSubsectionFieldWrapper({
 *   header: 'Name',
 *   fields: [
 *     forgeTextField({ key: 'firstName', label: 'First Name' }),
 *     forgeTextField({ key: 'lastName', label: 'Last Name' })
 *   ]
 * });
 * ```
 */
export function forgeDbxSubsectionFieldWrapper(config: DbxForgeSectionFieldConfig): WrapperField {
  return forgeDbxSectionFieldWrapper({
    ...config,
    subsection: config.subsection ?? true
  });
}
