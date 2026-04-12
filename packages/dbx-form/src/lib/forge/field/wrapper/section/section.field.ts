import type { FieldTypeDefinition, BaseValueField, FieldDef } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import type { DbxSectionHeaderConfig, DbxSectionHeaderHType } from '@dereekb/dbx-web';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field.util.meta';
import type { DbxForgeWrapperFieldProps } from '../wrapper.field';

// MARK: Field Type
export const FORGE_SECTION_FIELD_TYPE_NAME = 'dbx-forge-section' as const;

/**
 * Props interface for the forge section wrapper field.
 */
export interface DbxForgeSectionFieldProps extends DbxForgeWrapperFieldProps {
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
 * Forge field definition for a section wrapper.
 *
 * Renders child fields inside a `<dbx-section>` component with proper
 * header, content area styling, and semantic section structure.
 */
export interface DbxForgeSectionFieldDef extends BaseValueField<DbxForgeSectionFieldProps, Record<string, unknown>> {
  readonly type: typeof FORGE_SECTION_FIELD_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the section wrapper field.
 */
export const DBX_FORGE_SECTION_FIELD_TYPE: FieldTypeDefinition<DbxForgeSectionFieldDef> = {
  name: FORGE_SECTION_FIELD_TYPE_NAME,
  loadComponent: () => import('./section.field.component').then((m) => m.DbxForgeDbxSectionFieldWrapperComponent),
  mapper: valueFieldMapper
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
 * Uses `_` key prefix so `stripForgeInternalKeys` flattens child values into
 * the parent form value.
 *
 * @param config - Section wrapper configuration
 * @returns A {@link DbxForgeSectionFieldDef}
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
export function forgeDbxSectionFieldWrapper(config: DbxForgeSectionFieldConfig): DbxForgeSectionFieldDef {
  const { header, h, hint, icon, hintInline, elevate, subsection, fields, key } = config;
  const defaultH = subsection ? 4 : 3;

  const headerConfig: DbxSectionHeaderConfig = filterFromPOJO({
    header,
    h: h ?? defaultH,
    hint,
    icon,
    hintInline
  });

  return forgeField({
    key: key ?? `_section_${_forgeDbxSectionFieldWrapperCounter++}`,
    type: FORGE_SECTION_FIELD_TYPE_NAME,
    label: '',
    value: {} as Record<string, unknown>,
    props: filterFromPOJO({
      headerConfig,
      elevate,
      subsection,
      fields
    }) as DbxForgeSectionFieldProps
  } as DbxForgeSectionFieldDef);
}

/**
 * Creates a forge subsection wrapper field that renders child fields inside
 * a `<dbx-subsection>` component. Defaults heading level to 4.
 *
 * @param config - Subsection wrapper configuration
 * @returns A {@link DbxForgeSectionFieldDef}
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
export function forgeDbxSubsectionFieldWrapper(config: DbxForgeSectionFieldConfig): DbxForgeSectionFieldDef {
  return forgeDbxSectionFieldWrapper({
    ...config,
    subsection: config.subsection ?? true
  });
}
