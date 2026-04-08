import type { FieldTypeDefinition, BaseValueField } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import type { DbxSectionHeaderConfig, DbxSectionHeaderHType } from '@dereekb/dbx-web';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';

// MARK: Field Type
export const FORGE_SECTION_HEADER_FIELD_TYPE_NAME = 'dbx-forge-section-header' as const;

/**
 * Props interface for the forge section header field.
 */
export interface ForgeSectionHeaderFieldProps {
  /**
   * Section header configuration.
   */
  readonly headerConfig: DbxSectionHeaderConfig;
}

/**
 * Forge field definition for a section header.
 */
export interface ForgeSectionHeaderFieldDef extends BaseValueField<ForgeSectionHeaderFieldProps, unknown> {
  readonly type: typeof FORGE_SECTION_HEADER_FIELD_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the section header field.
 */
export const DBX_FORGE_SECTION_HEADER_FIELD_TYPE: FieldTypeDefinition<ForgeSectionHeaderFieldDef> = {
  name: FORGE_SECTION_HEADER_FIELD_TYPE_NAME,
  loadComponent: () => import('./section.header.field.component').then((m) => m.ForgeSectionHeaderFieldComponent),
  mapper: valueFieldMapper
};

// MARK: Config
/**
 * Configuration for creating a forge section header field.
 */
export interface ForgeSectionHeaderFieldConfig {
  /**
   * Header text to display.
   */
  readonly header: string;
  /**
   * Heading level (1-5). Defaults to 3 for sections, 4 for subsections.
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
   * Optional key override. Defaults to `_section_header`.
   */
  readonly key?: string;
}

let _forgeSectionHeaderCounter = 0;

/**
 * Creates a forge field definition that renders a section header.
 *
 * Uses {@link DbxSectionHeaderComponent} from `@dereekb/dbx-web` to render
 * a heading with optional icon and hint text. This field produces no form value.
 *
 * @param config - Section header configuration
 * @returns A {@link ForgeSectionHeaderFieldDef}
 *
 * @example
 * ```typescript
 * const header = forgeSectionHeaderField({ header: 'Contact Info', hint: 'Required fields', icon: 'person' });
 * ```
 */
export function forgeSectionHeaderField(config: ForgeSectionHeaderFieldConfig): ForgeSectionHeaderFieldDef {
  const { header, h, hint, icon, hintInline, key } = config;

  const headerConfig: DbxSectionHeaderConfig = filterFromPOJO({
    header,
    h,
    hint,
    icon,
    hintInline
  });

  return forgeField(
    filterFromPOJO({
      key: key ?? `_section_header_${_forgeSectionHeaderCounter++}`,
      type: FORGE_SECTION_HEADER_FIELD_TYPE_NAME,
      label: '',
      value: undefined as unknown,
      props: { headerConfig } as ForgeSectionHeaderFieldProps
    }) as ForgeSectionHeaderFieldDef
  );
}
