import type { WrapperTypeDefinition } from '@ng-forge/dynamic-forms';
import type { ObservableOrValue } from '@dereekb/rxjs';

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
  readonly classGetter?: ObservableOrValue<string>;
  /**
   * Observable or static value providing inline styles via `[ngStyle]`.
   */
  readonly styleGetter?: ObservableOrValue<DbxForgeStyleObject>;
}

/**
 * ng-forge {@link WrapperTypeDefinition} registration for the style wrapper.
 *
 * Lazy-loads {@link DbxForgeStyleWrapperComponent} which implements
 * {@link FieldWrapperContract} and receives classGetter and
 * styleGetter configuration via component inputs.
 */
export const DBX_FORGE_STYLE_WRAPPER_TYPE: WrapperTypeDefinition<DbxForgeStyleWrapper> = {
  wrapperName: DBX_FORGE_STYLE_WRAPPER_TYPE_NAME,
  loadComponent: () => import('./style.wrapper.component').then((m) => m.DbxForgeStyleWrapperComponent)
};
