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
import { FORGE_PHONE_FIELD_TYPE, type DbxForgePhoneFieldDef } from './field/value/phone/phone.field';
import { FORGE_DATETIME_FIELD_TYPE, FORGE_FIXEDDATERANGE_FIELD_TYPE, type DbxForgeDateTimeFieldDef, type DbxForgeFixedDateRangeFieldDef } from './field/value/date/datetime.field';
import { FORGE_TIMEDURATION_FIELD_TYPE, type DbxForgeTimeDurationFieldDef } from './field/value/duration/duration.field';

// Selection field types
import type { DbxForgeSearchableTextFieldDef, DbxForgeSearchableChipFieldDef, DBX_FORGE_SEARCHABLE_TEXT_FIELD_TYPE_NAME, DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME } from './field/selection/searchable/searchable.field';
import { FORGE_PICKABLE_CHIP_FIELD_TYPE, FORGE_PICKABLE_LIST_FIELD_TYPE, type DbxForgePickableChipFieldDef, type DbxForgePickableListFieldDef } from './field/selection/pickable/pickable.field';
import { FORGE_LIST_SELECTION_FIELD_TYPE, type DbxForgeListSelectionFieldDef } from './field/selection/list/list.field';
import { FORGE_VALUE_SELECTION_FIELD_TYPE, type DbxForgeValueSelectionFieldDef } from './field/selection/selection.field.component';
import { FORGE_SOURCE_SELECT_FIELD_TYPE, type DbxForgeSourceSelectFieldDef } from './field/selection/sourceselect/sourceselect.field.component';

// Other field types
import { FORGE_TEXT_EDITOR_FIELD_TYPE, type DbxForgeTextEditorFieldDef } from './field/texteditor/texteditor.field.component';
import { FORGE_COMPONENT_FIELD_TYPE, type DbxForgeComponentFieldDef } from './field/component/component.field.component';

// Wrapper types
import type { DBX_FORGE_FORM_FIELD_WRAPPER_NAME, DbxForgeFormFieldWrapperDef } from './field/wrapper/formfield/formfield.wrapper';
import type { DBX_FORGE_SECTION_WRAPPER_TYPE_NAME, DbxForgeSectionWrapper } from './field/wrapper/section/section.wrapper';
import type { DBX_FORGE_INFO_WRAPPER_TYPE_NAME, DbxForgeInfoWrapper } from './field/wrapper/info/info.wrapper';
import type { DBX_FORGE_STYLE_WRAPPER_TYPE_NAME, DbxForgeStyleWrapper } from './field/wrapper/style/style.wrapper';
import type { DBX_FORGE_WORKING_WRAPPER_TYPE_NAME, DbxForgeWorkingWrapper } from './field/wrapper/working/working.wrapper';
import type { DBX_FORGE_FLEX_WRAPPER_TYPE_NAME, DbxForgeFlexWrapper } from './field/wrapper/flex/flex.wrapper';
import { DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME, DbxForgeArrayFieldElementWrapperDef } from './field/wrapper/array-field/array-field.element.wrapper';
import { DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME, DbxForgeArrayFieldWrapperDef } from './field/wrapper/array-field/array-field.wrapper';

declare module '@ng-forge/dynamic-forms' {
  interface FieldRegistryLeaves {
    // Value fields
    [FORGE_PHONE_FIELD_TYPE]: DbxForgePhoneFieldDef;
    [FORGE_DATETIME_FIELD_TYPE]: DbxForgeDateTimeFieldDef;
    [FORGE_FIXEDDATERANGE_FIELD_TYPE]: DbxForgeFixedDateRangeFieldDef;
    [FORGE_TIMEDURATION_FIELD_TYPE]: DbxForgeTimeDurationFieldDef;
    [DBX_FORGE_SEARCHABLE_TEXT_FIELD_TYPE_NAME]: DbxForgeSearchableTextFieldDef<any, any, any>;
    [DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME]: DbxForgeSearchableChipFieldDef<any, any, any>;
    [FORGE_PICKABLE_CHIP_FIELD_TYPE]: DbxForgePickableChipFieldDef<any, any, any>;
    [FORGE_PICKABLE_LIST_FIELD_TYPE]: DbxForgePickableListFieldDef<any, any, any>;
    [FORGE_LIST_SELECTION_FIELD_TYPE]: DbxForgeListSelectionFieldDef<any, any, any>;
    [FORGE_VALUE_SELECTION_FIELD_TYPE]: DbxForgeValueSelectionFieldDef<any>;
    [FORGE_SOURCE_SELECT_FIELD_TYPE]: DbxForgeSourceSelectFieldDef<any, any>;
    [FORGE_TEXT_EDITOR_FIELD_TYPE]: DbxForgeTextEditorFieldDef;
    [FORGE_COMPONENT_FIELD_TYPE]: DbxForgeComponentFieldDef<any>;
  }
  interface FieldRegistryWrappers {
    [DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME]: DbxForgeArrayFieldWrapperDef;
    [DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME]: DbxForgeArrayFieldElementWrapperDef;
    [DBX_FORGE_FORM_FIELD_WRAPPER_NAME]: DbxForgeFormFieldWrapperDef;
    [DBX_FORGE_SECTION_WRAPPER_TYPE_NAME]: DbxForgeSectionWrapper;
    [DBX_FORGE_STYLE_WRAPPER_TYPE_NAME]: DbxForgeStyleWrapper;
    [DBX_FORGE_INFO_WRAPPER_TYPE_NAME]: DbxForgeInfoWrapper;
    [DBX_FORGE_WORKING_WRAPPER_TYPE_NAME]: DbxForgeWorkingWrapper;
    [DBX_FORGE_FLEX_WRAPPER_TYPE_NAME]: DbxForgeFlexWrapper;
  }
}
