import type { WrapperTypeDefinition } from '@ng-forge/dynamic-forms';

// MARK: Wrapper Type
/**
 * Registered wrapper type name for the working wrapper.
 *
 * Used in {@link WrapperConfig.type} to identify this wrapper when building
 * wrapper chains.
 */
export const DBX_FORGE_WORKING_WRAPPER_TYPE_NAME = 'dbx-forge-working-wrapper' as const;

/**
 * Configuration for the working wrapper type.
 *
 * Shows an indeterminate progress bar when any child field has pending
 * async validation. No additional configuration is needed — the wrapper
 * monitors the form tree's pending state automatically.
 *
 * @example
 * ```typescript
 * const wrapper: DbxForgeWorkingWrapper = {
 *   type: 'dbx-forge-working-wrapper',
 * };
 * ```
 */
export interface DbxForgeWorkingWrapper {
  readonly type: typeof DBX_FORGE_WORKING_WRAPPER_TYPE_NAME;
}
