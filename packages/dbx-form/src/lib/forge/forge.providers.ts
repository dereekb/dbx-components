import { type FieldTypeDefinition, provideDynamicForm } from '@ng-forge/dynamic-forms';
import { withMaterialFields } from '@ng-forge/dynamic-forms-material';
import { phoneFieldMapper } from './field/value/phone/phone.field.component';
import { FORGE_DATETIME_FIELD_TYPE, FORGE_DATERANGE_FIELD_TYPE, FORGE_FIXEDDATERANGE_FIELD_TYPE } from './field/value/date/datetime.field';
import { FORGE_TIMEDURATION_FIELD_TYPE } from './field/value/duration/duration.field';
import { dateTimeFieldMapper } from './field/value/date/datetime.field.component';
import { dateRangeFieldMapper } from './field/value/date/daterange.field.component';
import { fixedDateRangeFieldMapper } from './field/value/date/fixeddaterange.field.component';
import { timeDurationFieldMapper } from './field/value/duration/duration.field.component';
import { DBX_SEARCHABLE_TEXT_FIELD_TYPE, DBX_SEARCHABLE_CHIP_FIELD_TYPE } from './field/selection/searchable/searchable.field';
import { DBX_PICKABLE_CHIP_FIELD_TYPE, DBX_PICKABLE_LIST_FIELD_TYPE } from './field/selection/pickable/pickable.field';
import { DBX_LIST_SELECTION_FIELD_TYPE } from './field/selection/list/list.field';
import { DBX_SOURCE_SELECT_FIELD_TYPE } from './field/selection/sourceselect/sourceselect.field';
import { DBX_TEXT_EDITOR_FIELD_TYPE } from './field/texteditor/texteditor.field';
import { DBX_COMPONENT_FIELD_TYPE } from './field/component/component.field';
import { DBX_FORGE_SECTION_HEADER_FIELD_TYPE } from './field/wrapper/section/section.header.field';
import { DBX_FORGE_EXPAND_FIELD_TYPE } from './field/wrapper/expand/expand.field';
import { DBX_FORGE_INFO_BUTTON_FIELD_TYPE } from './field/wrapper/info/info.field';
import { DBX_FORGE_WORKING_FIELD_TYPE } from './field/wrapper/working/working.field';
import { DBX_FORGE_AUTOTOUCH_FIELD_TYPE } from './field/wrapper/autotouch/autotouch.field';
import { DBX_FORGE_ARRAY_FIELD_TYPE } from './field/value/array/array.field';
import { FORGE_SLIDER_FIELD_TYPE } from './field/value/number/slider.field.component';
import { sliderFieldMapper } from './field/value/number/slider.field.component';

/**
 * Forge phone field type definition.
 *
 * Registers the custom phone field component with ng-forge's dynamic form system.
 * Uses lazy loading for the component and the custom phoneFieldMapper to bridge
 * ngx-mat-input-tel with Signal Forms.
 */
const ForgePhoneFieldType: FieldTypeDefinition = {
  name: 'phone',
  loadComponent: () => import('./field/value/phone/phone.field.component').then((m) => m.ForgePhoneFieldComponent),
  mapper: phoneFieldMapper
};

/**
 * Forge date-time field type definition.
 *
 * Registers the custom date-time field component with ng-forge's dynamic form system.
 * Provides combined date and time selection with Material Design inputs.
 */
const ForgeDateTimeFieldType: FieldTypeDefinition = {
  name: FORGE_DATETIME_FIELD_TYPE,
  loadComponent: () => import('./field/value/date/datetime.field.component').then((m) => m.ForgeDateTimeFieldComponent),
  mapper: dateTimeFieldMapper
};

/**
 * Forge date range field type definition.
 *
 * Registers the custom date range field component with ng-forge's dynamic form system.
 * Provides start and end date selection with optional time inputs.
 */
const ForgeDateRangeFieldType: FieldTypeDefinition = {
  name: FORGE_DATERANGE_FIELD_TYPE,
  loadComponent: () => import('./field/value/date/daterange.field.component').then((m) => m.ForgeDateRangeFieldComponent),
  mapper: dateRangeFieldMapper
};

/**
 * Forge fixed date range field type definition.
 *
 * Registers the custom fixed date range field component with ng-forge's dynamic form system.
 * Uses Angular Material's mat-date-range-input for inline start/end date picking.
 */
const ForgeFixedDateRangeFieldType: FieldTypeDefinition = {
  name: FORGE_FIXEDDATERANGE_FIELD_TYPE,
  loadComponent: () => import('./field/value/date/fixeddaterange.field.component').then((m) => m.ForgeFixedDateRangeFieldComponent),
  mapper: fixedDateRangeFieldMapper
};

/**
 * Forge time duration field type definition.
 *
 * Registers the custom time duration field component with ng-forge's dynamic form system.
 * Provides a text input that parses duration strings and a popover picker.
 */
const ForgeTimeDurationFieldType: FieldTypeDefinition = {
  name: FORGE_TIMEDURATION_FIELD_TYPE,
  loadComponent: () => import('./field/value/duration/duration.field.component').then((m) => m.ForgeTimeDurationFieldComponent),
  mapper: timeDurationFieldMapper
};

/**
 * Forge slider field type definition.
 *
 * Registers a custom slider component that wraps `<mat-slider>` inside `<mat-form-field>`
 * for consistent outlined appearance with label, hint, and error display.
 */
const ForgeSliderFieldType: FieldTypeDefinition = {
  name: FORGE_SLIDER_FIELD_TYPE,
  loadComponent: () => import('./field/value/number/slider.field.component').then((m) => m.ForgeSliderFieldComponent),
  mapper: sliderFieldMapper
};

/**
 * All custom dbx-form forge field type definitions.
 */
export const DBX_FORGE_FIELD_TYPES: FieldTypeDefinition[] = [
  ForgePhoneFieldType,
  ForgeDateTimeFieldType,
  ForgeDateRangeFieldType,
  ForgeFixedDateRangeFieldType,
  ForgeTimeDurationFieldType,
  ForgeSliderFieldType,
  DBX_SEARCHABLE_TEXT_FIELD_TYPE,
  DBX_SEARCHABLE_CHIP_FIELD_TYPE,
  DBX_PICKABLE_CHIP_FIELD_TYPE,
  DBX_PICKABLE_LIST_FIELD_TYPE,
  DBX_LIST_SELECTION_FIELD_TYPE,
  DBX_SOURCE_SELECT_FIELD_TYPE,
  DBX_TEXT_EDITOR_FIELD_TYPE,
  DBX_COMPONENT_FIELD_TYPE,
  DBX_FORGE_SECTION_HEADER_FIELD_TYPE,
  DBX_FORGE_EXPAND_FIELD_TYPE,
  DBX_FORGE_INFO_BUTTON_FIELD_TYPE,
  DBX_FORGE_WORKING_FIELD_TYPE,
  DBX_FORGE_AUTOTOUCH_FIELD_TYPE,
  DBX_FORGE_ARRAY_FIELD_TYPE
];

/**
 * Registers ng-forge dynamic form field declarations with Material Design field types
 * and custom dbx field types (phone, datetime, daterange, fixeddaterange, timeduration,
 * searchable text, searchable chip, text editor, component).
 *
 * Add this to your app's providers alongside provideDbxFormConfiguration().
 */
export function provideDbxForgeFormFieldDeclarations() {
  return provideDynamicForm(...withMaterialFields(), ...DBX_FORGE_FIELD_TYPES);
}
