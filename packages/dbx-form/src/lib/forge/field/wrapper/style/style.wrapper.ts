import type { FieldDef, WrapperField, WrapperTypeDefinition } from '@ng-forge/dynamic-forms';
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
 * {@link FieldWrapperContract} and injects {@link WRAPPER_FIELD_CONTEXT}
 * for its classGetter and styleGetter configuration.
 */
export const DBX_FORGE_STYLE_WRAPPER_TYPE: WrapperTypeDefinition<DbxForgeStyleWrapper> = {
  wrapperName: DBX_FORGE_STYLE_WRAPPER_TYPE_NAME,
  loadComponent: () => import('./style.wrapper.component').then((m) => m.DbxForgeStyleWrapperComponent)
};

// MARK: Config
/**
 * Configuration for creating a forge style wrapper field.
 */
export interface DbxForgeStyleFieldConfig {
  /**
   * Child field definitions to render inside the style wrapper.
   */
  readonly fields: FieldDef<unknown>[];
  /**
   * Observable or static value providing CSS class names via `[ngClass]`.
   */
  readonly classGetter?: ObservableOrValue<string>;
  /**
   * Observable or static value providing inline styles via `[ngStyle]`.
   */
  readonly styleGetter?: ObservableOrValue<DbxForgeStyleObject>;
  /**
   * Optional key override. Defaults to auto-generated `_style_N`.
   */
  readonly key?: string;
}

let _forgeStyleFieldCounter = 0;

/**
 * Creates a forge style wrapper field that applies dynamic CSS classes and
 * inline styles to a container around child fields.
 *
 * Supports both static values and reactive observables for `classGetter`
 * and `styleGetter`.
 *
 * @param config - Style wrapper configuration
 * @returns A {@link WrapperField}
 *
 * @example
 * ```typescript
 * const styled = forgeStyleWrapper({
 *   classGetter: 'highlight-section',
 *   styleGetter: { background: 'rgba(255,0,0,0.3)' },
 *   fields: [
 *     forgeTextField({ key: 'name', label: 'Name' })
 *   ]
 * });
 * ```
 */
export function forgeStyleWrapper(config: DbxForgeStyleFieldConfig): WrapperField {
  const { fields, classGetter, styleGetter, key } = config;

  const wrapperConfig: DbxForgeStyleWrapper = {
    type: DBX_FORGE_STYLE_WRAPPER_TYPE_NAME,
    ...(classGetter != null && { classGetter }),
    ...(styleGetter != null && { styleGetter })
  };

  return {
    type: 'wrapper',
    key: key ?? `_style_${_forgeStyleFieldCounter++}`,
    fields,
    wrappers: [wrapperConfig]
  } as unknown as WrapperField;
}
