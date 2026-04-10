import { Component, ChangeDetectionStrategy, input, computed, type Signal, type InputSignal, inject } from '@angular/core';
import { MatSliderModule } from '@angular/material/slider';
import { type ThemePalette } from '@angular/material/core';
import { AsyncPipe } from '@angular/common';
import { DynamicTextPipe, type DynamicText, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES, type BaseValueField } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs, createResolvedErrorsSignal, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { MATERIAL_CONFIG } from '@ng-forge/dynamic-forms-material';
import type { FieldTree } from '@angular/forms/signals';
import { forgeFieldDisabled } from '../../field.disabled';

/**
 * Custom props for the forge slider field.
 */
export interface ForgeSliderFieldProps {
  readonly hint?: DynamicText;
  readonly appearance?: 'fill' | 'outline';
  readonly color?: 'primary' | 'accent' | 'warn';
  readonly thumbLabel?: boolean;
  readonly showThumbLabel?: boolean;
  readonly tickInterval?: number | 'auto';
  readonly step?: number;
  readonly min?: number;
  readonly max?: number;
}

/**
 * Custom forge field type name for the slider wrapped in an outlined container.
 */
export const FORGE_SLIDER_FIELD_TYPE = 'dbx-slider' as const;

/**
 * Field definition type for a forge slider field.
 */
export type ForgeSliderFieldDef = BaseValueField<ForgeSliderFieldProps, number> & {
  readonly type: typeof FORGE_SLIDER_FIELD_TYPE;
};

/**
 * Custom ng-forge field component that wraps a Material slider inside an outlined container
 * that mimics the Material form field appearance (notched outline with label, hint, error).
 *
 * The built-in ng-forge slider renders `<mat-slider>` directly without any outline container.
 * Since `<mat-slider>` is not a `MatFormFieldControl`, it cannot be placed inside `<mat-form-field>` directly.
 * This component recreates the outlined appearance using Material CSS tokens.
 *
 * Registered as ng-forge type 'dbx-slider'.
 */
@Component({
  selector: 'dbx-forge-slider-field',
  standalone: true,
  imports: [MatSliderModule, DynamicTextPipe, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'className()'
  },
  templateUrl: './slider.field.component.html',
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .dbx-forge-slider-outline {
        border: 1px solid var(--mdc-outlined-text-field-outline-color, var(--mat-sys-outline, rgba(0, 0, 0, 0.38)));
        border-radius: var(--mdc-outlined-text-field-container-shape, 8px);
        padding: 8px 16px 0;
        position: relative;

        &:hover {
          border-color: var(--mdc-outlined-text-field-hover-outline-color, var(--mat-sys-on-surface, rgba(0, 0, 0, 0.87)));
        }

        mat-slider {
          display: block;
          width: 100%;
        }
      }

      .dbx-forge-slider-label {
        display: block;
        -moz-osx-font-smoothing: grayscale;
        -webkit-font-smoothing: antialiased;
        font-family: var(--mat-form-field-outlined-label-text-populated-font, var(--mat-sys-body-small-font));
        font-size: var(--mat-form-field-outlined-label-text-populated-size, var(--mat-sys-body-small-size));
        line-height: var(--mat-form-field-outlined-label-text-populated-line-height, var(--mat-sys-body-small-line-height));
        letter-spacing: var(--mat-form-field-outlined-label-text-populated-tracking, var(--mat-sys-body-small-tracking));
        font-weight: var(--mat-form-field-outlined-label-text-populated-weight, var(--mat-sys-body-small-weight));
        color: var(--mdc-outlined-text-field-label-text-color, var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6)));
      }

      .dbx-forge-slider-subscript {
        display: block;
        padding: 0 16px;
        -moz-osx-font-smoothing: grayscale;
        -webkit-font-smoothing: antialiased;
        font-family: var(--mat-form-field-subscript-text-font, var(--mat-sys-body-small-font));
        line-height: var(--mat-form-field-subscript-text-line-height, var(--mat-sys-body-small-line-height));
        font-size: var(--mat-form-field-subscript-text-size, var(--mat-sys-body-small-size));
        letter-spacing: var(--mat-form-field-subscript-text-tracking, var(--mat-sys-body-small-tracking));
        font-weight: var(--mat-form-field-subscript-text-weight, var(--mat-sys-body-small-weight));
        color: var(--mat-form-field-subscript-text-color, var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6)));

        &::before {
          content: '';
          display: inline-block;
          height: 16px;
        }
      }

      .dbx-forge-slider-error {
        color: var(--mat-form-field-error-text-color, var(--mat-sys-error, #f44336));
      }

      .dbx-forge-slider-disabled {
        opacity: 0.38;
        pointer-events: none;
      }

      .dbx-forge-slider-disabled:hover {
        border-color: var(--mdc-outlined-text-field-outline-color, var(--mat-sys-outline, rgba(0, 0, 0, 0.38)));
      }
    `
  ]
})
export class ForgeSliderFieldComponent {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });

  // Standard ng-forge value field inputs
  readonly field: InputSignal<FieldTree<number>> = input.required<FieldTree<number>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<ForgeSliderFieldProps | undefined> = input<ForgeSliderFieldProps | undefined>();
  readonly meta: InputSignal<Record<string, unknown> | undefined> = input<Record<string, unknown> | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  // Computed props from field config
  readonly min: Signal<number> = computed(() => this.field()().min?.() ?? this.props()?.min ?? 0);
  readonly max: Signal<number> = computed(() => this.field()().max?.() ?? this.props()?.max ?? 100);
  readonly step: Signal<number> = computed(() => this.props()?.step ?? 1);
  readonly discrete: Signal<boolean> = computed(() => this.props()?.thumbLabel ?? this.props()?.showThumbLabel ?? false);
  readonly showTickMarks: Signal<boolean> = computed(() => this.props()?.tickInterval !== undefined);
  readonly color: Signal<ThemePalette> = computed(() => this.props()?.color ?? 'primary');

  // Disabled state
  readonly isDisabled = forgeFieldDisabled();

  // Current value from field tree
  readonly currentValue: Signal<number> = computed(() => this.field()().value() ?? 0);

  // Error handling
  readonly resolvedErrors = createResolvedErrorsSignal(this.field, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field);
  readonly errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []));

  /**
   * Sync slider value changes back to the Signal Forms field tree.
   */
  onValueChange(value: number): void {
    const fieldState = this.field()();
    fieldState.value.set(value);

    if (!fieldState.touched()) {
      fieldState.markAsTouched();
    }
  }
}

/**
 * Mapper function for the dbx-slider field type.
 *
 * @param fieldDef - The slider field definition
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
export function sliderFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    return buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.(), defaultValidationMessages?.());
  });
}
