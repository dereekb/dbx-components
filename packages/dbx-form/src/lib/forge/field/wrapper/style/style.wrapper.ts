import type { MaybeObservableOrValue } from '@dereekb/rxjs';

// MARK: Wrapper Type
/**
 * Registered wrapper type name for the style wrapper.
 *
 * Used in {@link WrapperConfig.type} to identify this wrapper when building
 * wrapper chains.
 */
export const DBX_FORGE_STYLE_WRAPPER_TYPE_NAME = 'dbx-forge-style' as const;

/**
 * A map of CSS style properties to their values, used with `[ngStyle]`.
 */
export type DbxForgeStyleObject = { [styleProperty: string]: unknown };

/**
 * Configuration for the style wrapper type.
 *
 * Applies dynamic CSS classes and inline styles around wrapped content.
 * Supports both static values and reactive observables via `ObservableOrValue`.
 *
 * @example
 * ```typescript
 * const wrapper: DbxForgeStyleWrapper = {
 *   type: 'dbx-forge-style',
 *   classGetter: 'highlight-section',
 *   styleGetter: { background: 'rgba(255,0,0,0.3)' },
 * };
 * ```
 */
export interface DbxForgeStyleWrapper {
  readonly type: typeof DBX_FORGE_STYLE_WRAPPER_TYPE_NAME;
  /**
   * Observable or static value providing CSS class names via `[ngClass]`.
   */
  readonly classGetter?: MaybeObservableOrValue<string>;
  /**
   * Observable or static value providing inline styles via `[ngStyle]`.
   */
  readonly styleGetter?: MaybeObservableOrValue<DbxForgeStyleObject>;
}

/**
 * Style wrapper config — applies dynamic CSS classes (`ngClass`) and/or inline styles (`ngStyle`) to any field via its `wrappers: []`.
 *
 * @param config - the style wrapper configuration without the `type` property
 * @returns a complete {@link DbxForgeStyleWrapper} config with the type set
 *
 * @dbxFormField
 * @dbxFormSlug style-wrapper
 * @dbxFormTier primitive
 * @dbxFormProduces WrapperConfig
 * @dbxFormReturns WrapperConfig
 * @dbxFormArrayOutput no
 * @dbxFormConfigInterface DbxForgeStyleWrapper
 *
 * @example
 * ```typescript
 * dbxForgeStyleWrapper({ classGetter: 'highlighted' })
 * ```
 */
export function dbxForgeStyleWrapper(config: Omit<DbxForgeStyleWrapper, 'type'>): DbxForgeStyleWrapper {
  return { type: DBX_FORGE_STYLE_WRAPPER_TYPE_NAME, ...config };
}
