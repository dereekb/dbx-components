import type { WrapperTypeDefinition } from '@ng-forge/dynamic-forms';
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
 * ng-forge {@link WrapperTypeDefinition} registration for the section wrapper.
 *
 * Lazy-loads {@link DbxForgeSectionWrapperComponent} which implements
 * {@link FieldWrapperContract} and receives header, elevate, and
 * subsection configuration via component inputs.
 */
export const DBX_FORGE_SECTION_WRAPPER_TYPE: WrapperTypeDefinition<DbxForgeSectionWrapper> = {
  wrapperName: DBX_FORGE_SECTION_WRAPPER_TYPE_NAME,
  loadComponent: () => import('./section.wrapper.component').then((m) => m.DbxForgeSectionWrapperComponent)
};
