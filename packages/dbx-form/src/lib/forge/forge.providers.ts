import { type FieldTypeDefinition, provideDynamicForm, type WrapperTypeDefinition } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { withMaterialFields } from '@ng-forge/dynamic-forms-material';
import { phoneFieldMapper } from './field/value/phone/phone.field.component';
import { dateTimeFieldMapper } from './field/value/date/datetime.field.component';
import { fixedDateRangeFieldMapper } from './field/value/date/fixeddaterange.field.component';
import { dateRangeFieldMapper } from './field/value/date/daterange.field.component';
import { timeDurationFieldMapper } from './field/value/duration/duration.field.component';
import {
  FORGE_PHONE_FIELD_TYPE,
  FORGE_DATETIME_FIELD_TYPE,
  FORGE_FIXEDDATERANGE_FIELD_TYPE,
  FORGE_DATERANGE_FIELD_TYPE,
  FORGE_TIMEDURATION_FIELD_TYPE,
  DBX_FORGE_SEARCHABLE_TEXT_FIELD_TYPE_NAME,
  DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME,
  FORGE_PICKABLE_CHIP_FIELD_TYPE,
  FORGE_PICKABLE_LIST_FIELD_TYPE,
  FORGE_VALUE_SELECTION_FIELD_TYPE,
  FORGE_LIST_SELECTION_FIELD_TYPE,
  FORGE_SOURCE_SELECT_FIELD_TYPE,
  FORGE_TEXT_EDITOR_FIELD_TYPE,
  FORGE_COMPONENT_FIELD_TYPE,
  FORGE_EXPAND_FIELD_TYPE_NAME,
  FORGE_INFO_BUTTON_FIELD_TYPE_NAME,
  DBX_FORGE_FORM_FIELD_WRAPPER_NAME,
  DBX_FORGE_SECTION_WRAPPER_TYPE_NAME,
  DBX_FORGE_STYLE_WRAPPER_TYPE_NAME,
  DBX_FORGE_INFO_WRAPPER_TYPE_NAME,
  DBX_FORGE_WORKING_WRAPPER_TYPE_NAME,
  DBX_FORGE_FLEX_WRAPPER_TYPE_NAME
} from './field';

/**
 * All custom dbx-form forge field type definitions.
 */
export const DBX_FORGE_FIELD_TYPES: FieldTypeDefinition[] = [
  // -- Value fields with custom mappers --
  {
    name: FORGE_PHONE_FIELD_TYPE,
    loadComponent: () => import('./field/value/phone/phone.field.component').then((m) => m.DbxForgePhoneFieldComponent),
    mapper: phoneFieldMapper
  },
  {
    name: FORGE_DATETIME_FIELD_TYPE,
    loadComponent: () => import('./field/value/date/datetime.field.component').then((m) => m.DbxForgeDateTimeFieldComponent),
    mapper: dateTimeFieldMapper
  },
  {
    name: FORGE_DATERANGE_FIELD_TYPE,
    loadComponent: () => import('./field/value/date/daterange.field.component').then((m) => m.DbxForgeDateRangeFieldComponent),
    mapper: dateRangeFieldMapper
  },
  {
    name: FORGE_FIXEDDATERANGE_FIELD_TYPE,
    loadComponent: () => import('./field/value/date/fixeddaterange.field.component').then((m) => m.DbxForgeFixedDateRangeFieldComponent),
    mapper: fixedDateRangeFieldMapper
  },
  {
    name: FORGE_TIMEDURATION_FIELD_TYPE,
    loadComponent: () => import('./field/value/duration/duration.field.component').then((m) => m.DbxForgeTimeDurationFieldComponent),
    mapper: timeDurationFieldMapper
  },
  // -- Selection fields --
  {
    name: DBX_FORGE_SEARCHABLE_TEXT_FIELD_TYPE_NAME,
    loadComponent: () => import('./field/selection/searchable/searchable-text.field.component').then((m) => m.DbxForgeSearchableTextFieldComponent),
    mapper: valueFieldMapper
  },
  {
    name: DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME,
    loadComponent: () => import('./field/selection/searchable/searchable-chip.field.component').then((m) => m.DbxForgeSearchableChipFieldComponent),
    mapper: valueFieldMapper
  },
  {
    name: FORGE_PICKABLE_CHIP_FIELD_TYPE,
    loadComponent: () => import('./field/selection/pickable/pickable-chip.field.component').then((m) => m.DbxForgePickableChipFieldComponent),
    mapper: valueFieldMapper
  },
  {
    name: FORGE_PICKABLE_LIST_FIELD_TYPE,
    loadComponent: () => import('./field/selection/pickable/pickable-list.field.component').then((m) => m.DbxForgePickableListFieldComponent),
    mapper: valueFieldMapper
  },
  {
    name: FORGE_VALUE_SELECTION_FIELD_TYPE,
    loadComponent: () => import('./field/selection/selection.field.component').then((m) => m.DbxForgeValueSelectionFieldComponent),
    mapper: valueFieldMapper
  },
  {
    name: FORGE_LIST_SELECTION_FIELD_TYPE,
    loadComponent: () => import('./field/selection/list/list.field.component').then((m) => m.DbxForgeListSelectionFieldComponent),
    mapper: valueFieldMapper
  },
  {
    name: FORGE_SOURCE_SELECT_FIELD_TYPE,
    loadComponent: () => import('./field/selection/sourceselect/sourceselect.field.component').then((m) => m.DbxForgeSourceSelectFieldComponent),
    mapper: valueFieldMapper
  },
  // -- Other fields --
  {
    name: FORGE_TEXT_EDITOR_FIELD_TYPE,
    loadComponent: () => import('./field/texteditor/texteditor.field.component').then((m) => m.DbxForgeTextEditorFieldComponent),
    mapper: valueFieldMapper
  },
  {
    name: FORGE_COMPONENT_FIELD_TYPE,
    loadComponent: () => import('./field/component/component.field.component').then((m) => m.DbxForgeComponentFieldComponent),
    mapper: valueFieldMapper
  },
  // -- Wrapper-related fields --
  {
    name: FORGE_EXPAND_FIELD_TYPE_NAME,
    loadComponent: () => import('./field/wrapper/expand/expand.field.component').then((m) => m.DbxForgeExpandFieldComponent),
    mapper: valueFieldMapper
  },
  {
    name: FORGE_INFO_BUTTON_FIELD_TYPE_NAME,
    loadComponent: () => import('./field/wrapper/info/info.field.component').then((m) => m.DbxForgeInfoButtonFieldComponent),
    mapper: valueFieldMapper
  }
];

/**
 * All custom dbx-form forge wrapper type definitions.
 */
export const DBX_FORGE_FIELD_WRAPPER_TYPES: WrapperTypeDefinition[] = [
  {
    wrapperName: DBX_FORGE_FORM_FIELD_WRAPPER_NAME,
    loadComponent: () => import('./field/wrapper/formfield/formfield.wrapper.component').then((m) => m.DbxForgeFormFieldWrapperComponent)
  },
  {
    wrapperName: DBX_FORGE_SECTION_WRAPPER_TYPE_NAME,
    loadComponent: () => import('./field/wrapper/section/section.wrapper.component').then((m) => m.DbxForgeSectionWrapperComponent)
  },
  {
    wrapperName: DBX_FORGE_STYLE_WRAPPER_TYPE_NAME,
    loadComponent: () => import('./field/wrapper/style/style.wrapper.component').then((m) => m.DbxForgeStyleWrapperComponent)
  },
  {
    wrapperName: DBX_FORGE_INFO_WRAPPER_TYPE_NAME,
    loadComponent: () => import('./field/wrapper/info/info.wrapper.component').then((m) => m.DbxForgeInfoWrapperComponent)
  },
  {
    wrapperName: DBX_FORGE_WORKING_WRAPPER_TYPE_NAME,
    loadComponent: () => import('./field/wrapper/working/working.wrapper.component').then((m) => m.DbxForgeWorkingWrapperComponent)
  },
  {
    wrapperName: DBX_FORGE_FLEX_WRAPPER_TYPE_NAME,
    loadComponent: () => import('./field/wrapper/flex/flex.wrapper.component').then((m) => m.DbxForgeFlexWrapperComponent)
  }
];

/**
 * Registers ng-forge dynamic form field declarations with Material Design field types
 * and custom dbx field types (phone, datetime, fixeddaterange, timeduration,
 * searchable text, searchable chip, text editor, component).
 *
 * Pass additional field types from extension packages (e.g. `DBX_FORGE_CALENDAR_FIELD_TYPES`,
 * `DBX_FORGE_MAPBOX_FIELD_TYPES`) to register them in the same `provideDynamicForm()` call.
 * Only one `provideDynamicForm()` call should exist per app — multiple calls overwrite
 * rather than merge.
 *
 * Add this to your app's providers alongside provideDbxFormConfiguration().
 *
 * @example
 * ```typescript
 * provideDbxForgeFormFieldDeclarations(
 *   ...DBX_FORGE_CALENDAR_FIELD_TYPES,
 *   ...DBX_FORGE_MAPBOX_FIELD_TYPES
 * )
 * ```
 *
 * @param additionalFieldTypes - Extra field type definitions from extension packages to register alongside the built-in types
 * @returns An array of providers that register all forge field types with ng-forge's dynamic form system
 */
export function provideDbxForgeFormFieldDeclarations(...additionalFieldTypes: FieldTypeDefinition[]) {
  return provideDynamicForm(...withMaterialFields(), ...DBX_FORGE_FIELD_TYPES, ...DBX_FORGE_FIELD_WRAPPER_TYPES, ...additionalFieldTypes);
}
