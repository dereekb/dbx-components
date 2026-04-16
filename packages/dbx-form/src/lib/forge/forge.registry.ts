/**
 * Module augmentation that registers all custom dbx-form forge field types
 * with ng-forge's DynamicFormFieldRegistry.
 *
 * This enables TypeScript to recognize custom field types in FormConfig.fields
 * without requiring `as unknown` casts.
 *
 * @see https://www.ng-forge.com/dynamic-forms/custom/building-an-adapter
 */

// Value field types
import type { DbxForgePhoneFieldDef } from './field/value/phone/phone.field';
import type { DbxForgeDateTimeFieldDef, DbxForgeFixedDateRangeFieldDef } from './field/value/date/datetime.field';
import type { DbxForgeTimeDurationFieldDef } from './field/value/duration/duration.field';
import type { DbxForgeArrayFieldDef } from './field/value/array/array.field';

// Selection field types
import type { DbxForgeSearchableTextFieldDef, DbxForgeSearchableChipFieldDef } from './field/selection/searchable/searchable.field';
import type { DbxForgePickableChipFieldDef, DbxForgePickableListFieldDef } from './field/selection/pickable/pickable.field';
import type { DbxForgeListSelectionFieldDef } from './field/selection/list/list.field';
import type { DbxForgeValueSelectionFieldDef } from './field/selection/selection.field.component';
import type { DbxForgeSourceSelectFieldDef } from './field/selection/sourceselect/sourceselect.field.component';

// Other field types
import type { DbxForgeTextEditorFieldDef } from './field/texteditor/texteditor.field.component';
import type { DbxForgeComponentFieldDef } from './field/component/component.field.component';

// Wrapper types
import type { DBX_FORGE_FORM_FIELD_WRAPPER_TYPE_NAME, DbxForgeFormFieldWrapperFieldDef } from './field/wrapper/formfield/formfield.wrapper';
import type { DBX_FORGE_SECTION_WRAPPER_TYPE_NAME, DbxForgeSectionWrapper } from './field/wrapper/section/section.wrapper';
import type { DBX_FORGE_INFO_WRAPPER_TYPE_NAME, DbxForgeInfoWrapper } from './field/wrapper/info/info.wrapper';
import type { DBX_FORGE_STYLE_WRAPPER_TYPE_NAME, DbxForgeStyleWrapper } from './field/wrapper/style/style.wrapper';
import type { DBX_FORGE_WORKING_WRAPPER_TYPE_NAME, DbxForgeWorkingWrapper } from './field/wrapper/working/working.wrapper';

declare module '@ng-forge/dynamic-forms' {
  interface FieldRegistryLeaves {
    // Value fields
    phone: DbxForgePhoneFieldDef;
    datetime: DbxForgeDateTimeFieldDef;
    fixeddaterange: DbxForgeFixedDateRangeFieldDef;
    timeduration: DbxForgeTimeDurationFieldDef;
    'dbx-searchable-text': DbxForgeSearchableTextFieldDef<any, any, any>;
    'dbx-searchable-chip': DbxForgeSearchableChipFieldDef<any, any, any>;
    'dbx-pickable-chip': DbxForgePickableChipFieldDef<any, any, any>;
    'dbx-pickable-list': DbxForgePickableListFieldDef<any, any, any>;
    'dbx-list-selection': DbxForgeListSelectionFieldDef<any, any, any>;
    'dbx-value-selection': DbxForgeValueSelectionFieldDef<any>;
    'dbx-source-select': DbxForgeSourceSelectFieldDef<any, any>;
    'dbx-text-editor': DbxForgeTextEditorFieldDef;
    'dbx-component': DbxForgeComponentFieldDef<any>;
  }
  interface FieldRegistryWrappers {
    [DBX_FORGE_FORM_FIELD_WRAPPER_TYPE_NAME]: DbxForgeFormFieldWrapperFieldDef;
    [DBX_FORGE_SECTION_WRAPPER_TYPE_NAME]: DbxForgeSectionWrapper;
    [DBX_FORGE_STYLE_WRAPPER_TYPE_NAME]: DbxForgeStyleWrapper;
    [DBX_FORGE_INFO_WRAPPER_TYPE_NAME]: DbxForgeInfoWrapper;
    [DBX_FORGE_WORKING_WRAPPER_TYPE_NAME]: DbxForgeWorkingWrapper;
  }
}
