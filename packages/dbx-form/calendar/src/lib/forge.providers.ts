import { type FieldTypeDefinition, provideDynamicForm } from '@ng-forge/dynamic-forms';
import { FORGE_CALENDAR_DATE_SCHEDULE_RANGE_FIELD_TYPE } from './field/schedule/calendar.schedule.forge.field';
import { calendarDateScheduleRangeFieldMapper } from './field/schedule/calendar.schedule.forge.field.component';

/**
 * Forge calendar date schedule range field type definition.
 *
 * Registers the custom calendar date schedule range field component with ng-forge's dynamic form system.
 * Uses lazy loading for the component.
 */
const DbxForgeCalendarDateScheduleRangeFieldType: FieldTypeDefinition = {
  name: FORGE_CALENDAR_DATE_SCHEDULE_RANGE_FIELD_TYPE,
  loadComponent: () => import('./field/schedule/calendar.schedule.forge.field.component').then((m) => m.DbxForgeCalendarDateScheduleRangeFieldComponent),
  mapper: calendarDateScheduleRangeFieldMapper
};

/**
 * All custom dbx-form/calendar forge field type definitions.
 */
export const DBX_FORGE_CALENDAR_FIELD_TYPES: FieldTypeDefinition[] = [DbxForgeCalendarDateScheduleRangeFieldType];

/**
 * Registers ng-forge dynamic form field declarations for the calendar package.
 *
 * Add this to your app's providers alongside provideDbxForgeFormFieldDeclarations().
 */
export function provideDbxForgeCalendarFieldDeclarations() {
  return provideDynamicForm(...DBX_FORGE_CALENDAR_FIELD_TYPES);
}
