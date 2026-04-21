import type { DbxSectionHeaderConfig } from '@dereekb/dbx-web';

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
 * Creates a section wrapper config for use in a field's `wrappers` array.
 *
 * @example
 * ```typescript
 * dbxForgeNameField({
 *   wrappers: [dbxForgeSectionWrapper({ headerConfig: { header: 'Contact' } })]
 * })
 * ```
 */
export function dbxForgeSectionWrapper(config: Omit<DbxForgeSectionWrapper, 'type'>): DbxForgeSectionWrapper {
  return { type: DBX_FORGE_SECTION_WRAPPER_TYPE_NAME, ...config };
}

/**
 * Creates a subsection wrapper config for use in a field's `wrappers` array.
 * Sets `subsection: true` and defaults heading level to 4.
 *
 * @example
 * ```typescript
 * dbxForgeNameField({
 *   wrappers: [dbxForgeSubsectionWrapper({ headerConfig: { header: 'Name' } })]
 * })
 * ```
 */
export function dbxForgeSubsectionWrapper(config: Omit<DbxForgeSectionWrapper, 'type' | 'subsection'>): DbxForgeSectionWrapper {
  return { type: DBX_FORGE_SECTION_WRAPPER_TYPE_NAME, subsection: true, ...config };
}
