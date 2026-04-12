import type { FieldTypeDefinition, BaseValueField, FieldDef } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import type { ObservableOrValue } from '@dereekb/rxjs';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field.util.meta';
import type { DbxForgeWrapperFieldProps } from '../wrapper.field';

// MARK: Field Type
export const FORGE_STYLE_FIELD_TYPE_NAME = 'dbx-forge-style' as const;

/**
 * A map of CSS style properties to their values, used with `[ngStyle]`.
 */
export type DbxForgeStyleObject = { [styleProperty: string]: unknown };

/**
 * Props interface for the forge style wrapper field.
 */
export interface DbxForgeStyleFieldProps extends DbxForgeWrapperFieldProps {
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
 * Forge field definition for a style wrapper.
 *
 * Renders child fields inside a container with dynamic CSS classes and
 * inline styles applied.
 */
export interface DbxForgeStyleFieldDef extends BaseValueField<DbxForgeStyleFieldProps, Record<string, unknown>> {
  readonly type: typeof FORGE_STYLE_FIELD_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the style wrapper field.
 */
export const DBX_FORGE_STYLE_FIELD_TYPE: FieldTypeDefinition<DbxForgeStyleFieldDef> = {
  name: FORGE_STYLE_FIELD_TYPE_NAME,
  loadComponent: () => import('./style.field.component').then((m) => m.DbxForgeStyleFieldComponent),
  mapper: valueFieldMapper
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
 * and `styleGetter`, matching the formly `formlyStyleWrapper` behavior.
 *
 * Uses `_` key prefix so `stripForgeInternalKeys` flattens child values into
 * the parent form value.
 *
 * @param config - Style wrapper configuration
 * @returns A {@link DbxForgeStyleFieldDef}
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
export function forgeStyleWrapper(config: DbxForgeStyleFieldConfig): DbxForgeStyleFieldDef {
  const { fields, classGetter, styleGetter, key } = config;

  return forgeField({
    key: key ?? `_style_${_forgeStyleFieldCounter++}`,
    type: FORGE_STYLE_FIELD_TYPE_NAME,
    label: '',
    value: {} as Record<string, unknown>,
    props: filterFromPOJO({
      fields,
      classGetter,
      styleGetter
    }) as DbxForgeStyleFieldProps
  } as DbxForgeStyleFieldDef);
}
