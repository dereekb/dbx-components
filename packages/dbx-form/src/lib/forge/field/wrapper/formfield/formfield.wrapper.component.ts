import { ChangeDetectionStrategy, Component, computed, inject, input, viewChild, ViewContainerRef } from '@angular/core';
import { DynamicTextPipe, FIELD_SIGNAL_CONTEXT, FieldSignalContext, FieldWrapperContract, WrapperFieldInputs, type DynamicText, type FieldWithValidation } from '@ng-forge/dynamic-forms';
import { forgeFieldDisabled } from '../../field.util';
import { AsyncPipe } from '@angular/common';

/**
 * Forge wrapper field component that renders child fields inside a Material-style
 * outlined container with a notched outline, floating label, and hint/error subscript.
 *
 * Reads wrapper config (label, hint, className) from component inputs
 * and the parent {@link FieldSignalContext} to observe form validation state.
 */
@Component({
  selector: 'dbx-forge-form-field-wrapper',
  templateUrl: './formfield.wrapper.component.html',
  styles: [
    `
      .dbx-forge-form-field-wrapper {
        position: relative;
        margin-top: 8px;
      }

      /* --- Notched outline --- */
      .dbx-forge-form-field-outline {
        display: flex;
        position: absolute;
        top: 0;
        right: 0;
        left: 0;
        bottom: 0;
        pointer-events: none;
      }

      .dbx-forge-form-field-outline-leading {
        border: 1px solid var(--mdc-outlined-text-field-outline-color, var(--mat-sys-outline, rgba(0, 0, 0, 0.38)));
        border-right: none;
        border-radius: var(--mdc-outlined-text-field-container-shape, 8px) 0 0 var(--mdc-outlined-text-field-container-shape, 8px);
        width: 12px;
      }

      .dbx-forge-form-field-outline-notch {
        border-bottom: 1px solid var(--mdc-outlined-text-field-outline-color, var(--mat-sys-outline, rgba(0, 0, 0, 0.38)));
        display: flex;
        align-items: flex-start;
        max-width: calc(100% - 24px);
      }

      .dbx-forge-form-field-outline-notch-empty {
        border-top: 1px solid var(--mdc-outlined-text-field-outline-color, var(--mat-sys-outline, rgba(0, 0, 0, 0.38)));
        width: 0;
        padding: 0;
      }

      .dbx-forge-form-field-outline-label {
        display: inline-block;
        transform: translateY(-50%);
        padding: 0 4px;
        background: var(--mat-sys-surface, white);
        white-space: nowrap;
        -moz-osx-font-smoothing: grayscale;
        -webkit-font-smoothing: antialiased;
        font-family: var(--mat-form-field-outlined-label-text-populated-font, var(--mat-sys-body-small-font));
        font-size: var(--mat-form-field-outlined-label-text-populated-size, var(--mat-sys-body-small-size));
        line-height: var(--mat-form-field-outlined-label-text-populated-line-height, var(--mat-sys-body-small-line-height));
        letter-spacing: var(--mat-form-field-outlined-label-text-populated-tracking, var(--mat-sys-body-small-tracking));
        font-weight: var(--mat-form-field-outlined-label-text-populated-weight, var(--mat-sys-body-small-weight));
        color: var(--mdc-outlined-text-field-label-text-color, var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6)));
      }

      .dbx-forge-form-field-outline-trailing {
        border: 1px solid var(--mdc-outlined-text-field-outline-color, var(--mat-sys-outline, rgba(0, 0, 0, 0.38)));
        border-left: none;
        border-radius: 0 var(--mdc-outlined-text-field-container-shape, 8px) var(--mdc-outlined-text-field-container-shape, 8px) 0;
        flex-grow: 1;
      }

      /* --- Hover state --- */
      .dbx-forge-form-field-wrapper:hover .dbx-forge-form-field-outline-leading,
      .dbx-forge-form-field-wrapper:hover .dbx-forge-form-field-outline-notch,
      .dbx-forge-form-field-wrapper:hover .dbx-forge-form-field-outline-trailing {
        border-color: var(--mdc-outlined-text-field-hover-outline-color, var(--mat-sys-on-surface, rgba(0, 0, 0, 0.87)));
      }

      /* --- Focus state --- */
      .dbx-forge-form-field-wrapper:focus-within .dbx-forge-form-field-outline-leading,
      .dbx-forge-form-field-wrapper:focus-within .dbx-forge-form-field-outline-notch,
      .dbx-forge-form-field-wrapper:focus-within .dbx-forge-form-field-outline-trailing {
        border-color: var(--mdc-outlined-text-field-focus-outline-color, var(--mat-sys-primary));
        border-width: 2px;
      }

      .dbx-forge-form-field-wrapper:focus-within .dbx-forge-form-field-outline-label {
        color: var(--mdc-outlined-text-field-focus-label-text-color, var(--mat-sys-primary));
        padding: 0 3px;
      }

      /* --- Error state --- */
      .dbx-forge-form-field-wrapper-error .dbx-forge-form-field-outline-leading,
      .dbx-forge-form-field-wrapper-error .dbx-forge-form-field-outline-notch,
      .dbx-forge-form-field-wrapper-error .dbx-forge-form-field-outline-trailing {
        border-color: var(--mdc-outlined-text-field-error-outline-color, var(--mat-sys-error, #f44336));
      }

      .dbx-forge-form-field-wrapper-error .dbx-forge-form-field-outline-label {
        color: var(--mdc-outlined-text-field-error-label-text-color, var(--mat-sys-error, #f44336));
      }

      /* --- Content area --- */
      .dbx-forge-form-field-content {
        position: relative;
        padding: var(--mat-form-field-container-vertical-padding, 16px) 16px 8px;
        min-height: 56px;
        box-sizing: border-box;
      }

      /* --- Disabled state --- */
      .dbx-forge-form-field-wrapper-disabled .dbx-forge-form-field-content {
        opacity: 0.38;
        pointer-events: none;
      }

      .dbx-forge-form-field-wrapper-disabled .dbx-forge-form-field-outline-leading,
      .dbx-forge-form-field-wrapper-disabled .dbx-forge-form-field-outline-notch,
      .dbx-forge-form-field-wrapper-disabled .dbx-forge-form-field-outline-trailing {
        border-color: var(--mdc-outlined-text-field-disabled-outline-color, rgba(0, 0, 0, 0.12));
      }

      .dbx-forge-form-field-wrapper-disabled:hover .dbx-forge-form-field-outline-leading,
      .dbx-forge-form-field-wrapper-disabled:hover .dbx-forge-form-field-outline-notch,
      .dbx-forge-form-field-wrapper-disabled:hover .dbx-forge-form-field-outline-trailing {
        border-color: var(--mdc-outlined-text-field-disabled-outline-color, rgba(0, 0, 0, 0.12));
      }

      .dbx-forge-form-field-wrapper-disabled .dbx-forge-form-field-outline-label {
        color: var(--mdc-outlined-text-field-disabled-label-text-color, rgba(0, 0, 0, 0.38));
      }
    `
  ],
  imports: [DynamicTextPipe, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    class: 'mat-mdc-form-field mat-form-field-animations-enabled',
    '[class]': 'classNameSignal()'
  }
})
export class DbxForgeFormFieldWrapperComponent implements FieldWrapperContract {
  readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });

  // Root form state from the flattened field signal context
  private readonly formState = computed(() => this.fieldInputs()?.field);

  // Disabled state
  readonly isDisabled = computed(() => this.formState()?.disabled);

  // Props from wrapper config
  readonly fieldInputs = input<WrapperFieldInputs>();

  readonly label = computed(() => this.fieldInputs()?.label);
  readonly hintSignal = computed(() => (this.fieldInputs()?.props as any)?.hint);
  readonly classNameSignal = computed(() => this.fieldInputs()?.className ?? '');

  // Key for ARIA IDs
  private readonly keySignal = computed(() => this.fieldInputs()?.key ?? '');

  // Validation state from form tree
  readonly childErrors = computed(() => this.formState()?.errors());
  readonly childTouched = computed(() => this.formState()?.touched());
  readonly childDirty = computed(() => this.formState()?.dirty());

  readonly showErrors = computed(() => {
    const errors = this.childErrors();
    const touched = this.childTouched();
    const dirty = this.childDirty();
    return (touched || dirty) && (errors?.length ?? 0) > 0;
  });

  readonly hasError = computed(() => this.showErrors());

  readonly firstErrorMessage = computed(() => {
    const errors = this.childErrors();
    const error = errors?.[0];
    return 'ERROR'; // TODO?
  });

  /**
   * Whether any child field has `required` state, used to show the asterisk in the label.
   */
  readonly isRequired = computed(() => this.formState()?.required());

  // ARIA IDs
  protected readonly labelId = computed(() => `${this.keySignal()}-label`);
  protected readonly errorId = computed(() => `${this.keySignal()}-error`);
  protected readonly hintId = computed(() => `${this.keySignal()}-hint`);
}
