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
import { DBX_TEXT_EDITOR_FIELD_TYPE } from './field/texteditor/texteditor.field';
import { DBX_COMPONENT_FIELD_TYPE } from './field/component/component.field';

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
 * All custom dbx-form forge field type definitions.
 */
export const DBX_FORGE_FIELD_TYPES: FieldTypeDefinition[] = [ForgePhoneFieldType, ForgeDateTimeFieldType, ForgeDateRangeFieldType, ForgeFixedDateRangeFieldType, ForgeTimeDurationFieldType, DBX_SEARCHABLE_TEXT_FIELD_TYPE, DBX_SEARCHABLE_CHIP_FIELD_TYPE, DBX_TEXT_EDITOR_FIELD_TYPE, DBX_COMPONENT_FIELD_TYPE];

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
