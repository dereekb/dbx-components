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
 * Section wrapper config — attach via a field's `wrappers: []` array for a semantic section with header and optional card elevation.
 *
 * @param config - the section wrapper configuration without the `type` property
 * @returns a complete {@link DbxForgeSectionWrapper} config with the type set
 *
 * @dbxFormField
 * @dbxFormSlug section-wrapper
 * @dbxFormTier primitive
 * @dbxFormProduces WrapperConfig
 * @dbxFormReturns WrapperConfig
 * @dbxFormArrayOutput no
 * @dbxFormConfigInterface DbxForgeSectionWrapper
 *
 * @example
 * ```typescript
 * dbxForgeSectionWrapper({ headerConfig: { text: 'Contact Details' } })
 * ```
 */
export function dbxForgeSectionWrapper(config: Omit<DbxForgeSectionWrapper, 'type'>): DbxForgeSectionWrapper {
  return { type: DBX_FORGE_SECTION_WRAPPER_TYPE_NAME, ...config };
}

/**
 * Subsection variant of `section-wrapper` — defaults to heading level 4 and `subsection: true`.
 *
 * @param config - the subsection wrapper configuration without the `type` and `subsection` properties
 * @returns a complete {@link DbxForgeSectionWrapper} config with `type` and `subsection: true` set
 *
 * @dbxFormField
 * @dbxFormSlug subsection-wrapper
 * @dbxFormTier primitive
 * @dbxFormProduces WrapperConfig
 * @dbxFormReturns WrapperConfig
 * @dbxFormArrayOutput no
 * @dbxFormConfigInterface DbxForgeSectionWrapper
 *
 * @example
 * ```typescript
 * dbxForgeSubsectionWrapper({ headerConfig: { text: 'Options' } })
 * ```
 */
export function dbxForgeSubsectionWrapper(config: Omit<DbxForgeSectionWrapper, 'type' | 'subsection'>): DbxForgeSectionWrapper {
  return { type: DBX_FORGE_SECTION_WRAPPER_TYPE_NAME, subsection: true, ...config };
}
