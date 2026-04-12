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
import type { DbxForgeSearchableTextFieldDef, DbxForgeSearchableChipFieldDef } from './field/selection/searchable/searchable.field.directive';
import type { DbxForgePickableChipFieldDef, DbxForgePickableListFieldDef } from './field/selection/pickable/pickable.field.directive';
import type { DbxForgeListSelectionFieldDef } from './field/selection/list/list.field.component';
import type { DbxForgeValueSelectionFieldDef } from './field/selection/selection.field.component';
import type { DbxForgeSourceSelectFieldDef } from './field/selection/sourceselect/sourceselect.field.component';

// Other field types
import type { DbxForgeTextEditorFieldDef } from './field/texteditor/texteditor.field.component';
import type { DbxForgeComponentFieldDef } from './field/component/component.field.component';

// Wrapper field types
import type { DbxForgeFormFieldWrapperFieldDef } from './field/wrapper/formfield/formfield.field';
import type { DbxForgeSectionFieldDef } from './field/wrapper/section/section.field';
import type { DbxForgeExpandFieldDef } from './field/wrapper/expand/expand.field';
import type { DbxForgeInfoButtonFieldDef } from './field/wrapper/info/info.field';
import type { DbxForgeInfoWrapperFieldDef } from './field/wrapper/info/info.wrapper.field';
import type { DbxForgeStyleFieldDef } from './field/wrapper/style/style.field';
import type { DbxForgeWorkingFieldDef } from './field/wrapper/working/working.field';
import type { DbxForgeWorkingWrapperFieldDef } from './field/wrapper/working/working.wrapper.field';

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

    // Wrapper fields (registered as leaves since they use valueFieldMapper)
    'dbx-forge-form-field': DbxForgeFormFieldWrapperFieldDef;
    'dbx-forge-section': DbxForgeSectionFieldDef;
    'dbx-forge-expand': DbxForgeExpandFieldDef;
    'dbx-forge-info-button': DbxForgeInfoButtonFieldDef;
    'dbx-forge-info': DbxForgeInfoWrapperFieldDef;
    'dbx-forge-style': DbxForgeStyleFieldDef;
    'dbx-forge-working': DbxForgeWorkingFieldDef;
    'dbx-forge-working-wrapper': DbxForgeWorkingWrapperFieldDef;
    'dbx-forge-array': DbxForgeArrayFieldDef<any>;
  }
}
