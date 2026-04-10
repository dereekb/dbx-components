/**
 * Module augmentation that registers all custom dbx-form forge field types
 * with ng-forge's DynamicFormFieldRegistry.
 *
 * This enables TypeScript to recognize custom field types in FormConfig.fields
 * without requiring `as unknown` casts.
 *
 * @see https://www.ng-forge.com/dynamic-forms/custom/building-an-adapter
 */
import type { BaseValueField } from '@ng-forge/dynamic-forms';
import type { DbxForgeSliderFieldProps } from './field/value/number/slider.field.component';
import type { DbxForgeSectionFieldProps } from './field/wrapper/section/section.field';
import type { DbxForgeFormFieldWrapperProps } from './field/wrapper/formfield/formfield.field';

declare module '@ng-forge/dynamic-forms' {
  interface FieldRegistryLeaves {
    // Value fields
    phone: BaseValueField<unknown, unknown>;
    datetime: BaseValueField<unknown, unknown>;
    fixeddaterange: BaseValueField<unknown, unknown>;
    timeduration: BaseValueField<unknown, unknown>;
    'dbx-slider': BaseValueField<DbxForgeSliderFieldProps, number>;
    'dbx-searchable-text': BaseValueField<unknown, unknown>;
    'dbx-searchable-chip': BaseValueField<unknown, unknown>;
    'dbx-pickable-chip': BaseValueField<unknown, unknown>;
    'dbx-pickable-list': BaseValueField<unknown, unknown>;
    'dbx-list-selection': BaseValueField<unknown, unknown>;
    'dbx-source-select': BaseValueField<unknown, unknown>;
    'dbx-text-editor': BaseValueField<unknown, unknown>;
    'dbx-component': BaseValueField<unknown, unknown>;

    // Wrapper fields (registered as leaves since they use valueFieldMapper)
    'dbx-forge-form-field': BaseValueField<DbxForgeFormFieldWrapperProps, Record<string, unknown>>;
    'dbx-forge-section': BaseValueField<DbxForgeSectionFieldProps, Record<string, unknown>>;
    'dbx-forge-expand': BaseValueField<unknown, unknown>;
    'dbx-forge-info-button': BaseValueField<unknown, unknown>;
    'dbx-forge-info': BaseValueField<unknown, unknown>;
    'dbx-forge-style': BaseValueField<unknown, unknown>;
    'dbx-forge-working': BaseValueField<unknown, unknown>;
    'dbx-forge-working-wrapper': BaseValueField<unknown, unknown>;
    'dbx-forge-autotouch': BaseValueField<unknown, unknown>;
    'dbx-forge-array': BaseValueField<unknown, unknown>;
  }
}
