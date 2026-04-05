import { Component, ChangeDetectionStrategy, input, computed, effect, type Signal, type InputSignal, DestroyRef, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NgxMatInputTelComponent } from 'ngx-mat-input-tel';
import { MatInputModule } from '@angular/material/input';
import { AsyncPipe } from '@angular/common';
import { DynamicTextPipe, type DynamicText, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs, createResolvedErrorsSignal, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { MATERIAL_CONFIG } from '@ng-forge/dynamic-forms-material';
import type { FieldTree } from '@angular/forms/signals';
import type { Maybe } from '@dereekb/util';

/**
 * Custom props for the forge phone field.
 */
export interface ForgePhoneFieldProps {
  /**
   * ISO country codes for countries shown first in the dropdown.
   */
  readonly preferredCountries?: string[];
  /**
   * ISO country codes to restrict the dropdown to.
   */
  readonly onlyCountries?: string[];
  /**
   * Whether or not to enable the search feature. True by default.
   */
  readonly enableSearch?: boolean;
  /**
   * Material form field appearance.
   */
  readonly appearance?: 'fill' | 'outline';
  /**
   * Hint text displayed below the field.
   */
  readonly hint?: DynamicText;
}

/**
 * Default preferred countries shown at the top of the phone country dropdown.
 */
export const FORGE_DEFAULT_PREFERRED_COUNTRIES = ['us'];

/**
 * Custom ng-forge field component that wraps the ngx-mat-input-tel phone input.
 *
 * Since ngx-mat-input-tel uses ControlValueAccessor (reactive forms) and does not support
 * Signal Forms' [formField] directive, this component bridges the two systems by manually
 * syncing the FieldTree signal state with a FormControl.
 *
 * Registered as ng-forge type 'phone'.
 */
@Component({
  selector: 'dbx-forge-phone-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, ReactiveFormsModule, NgxMatInputTelComponent, DynamicTextPipe, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field [appearance]="effectiveAppearance()" subscriptSizing="dynamic">
      @if (label()) {
        <mat-label>{{ label() | dynamicText | async }}</mat-label>
      }
      <ngx-mat-input-tel name="phone" [formControl]="phoneCtrl" [enableSearch]="enableSearch()" [preferredCountries]="preferredCountries()" [onlyCountries]="onlyCountries()" [enablePlaceholder]="false" [placeholder]="(placeholder() | dynamicText | async) ?? ''"></ngx-mat-input-tel>
      @if (errorsToDisplay()[0]; as error) {
        <mat-error>{{ error.message }}</mat-error>
      } @else if (props()?.hint; as hint) {
        <mat-hint>{{ hint | dynamicText | async }}</mat-hint>
      }
    </mat-form-field>
  `
})
export class ForgePhoneFieldComponent {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  // Standard ng-forge value field inputs
  readonly field: InputSignal<FieldTree<string>> = input.required<FieldTree<string>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<ForgePhoneFieldProps | undefined> = input<ForgePhoneFieldProps | undefined>();
  readonly meta: InputSignal<Record<string, unknown> | undefined> = input<Record<string, unknown> | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  /**
   * Internal FormControl used to bridge ngx-mat-input-tel (reactive forms)
   * with the ng-forge Signal Forms field tree.
   */
  readonly phoneCtrl = new FormControl<string>('');

  // Computed props
  readonly preferredCountries: Signal<string[]> = computed(() => this.props()?.preferredCountries ?? FORGE_DEFAULT_PREFERRED_COUNTRIES);
  readonly onlyCountries: Signal<string[]> = computed(() => this.props()?.onlyCountries ?? []);
  readonly enableSearch: Signal<boolean> = computed(() => this.props()?.enableSearch ?? true);
  readonly effectiveAppearance = computed(() => this.props()?.appearance ?? this.materialConfig?.appearance ?? 'outline');

  // Error handling
  readonly resolvedErrors = createResolvedErrorsSignal(this.field, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field);
  readonly errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []));

  /**
   * Flag to prevent feedback loops during sync.
   */
  private _syncing = false;

  constructor() {
    // Sync Signal Forms field -> FormControl (inbound)
    effect(() => {
      const fieldTree = this.field();
      const fieldState = fieldTree();
      const signalValue: Maybe<string> = fieldState.value();

      if (!this._syncing) {
        this._syncing = true;
        const currentCtrlValue = this.phoneCtrl.value;

        if (signalValue !== currentCtrlValue) {
          this.phoneCtrl.setValue(signalValue ?? '', { emitEvent: false });
        }

        this._syncing = false;
      }
    });

    // Sync FormControl -> Signal Forms field (outbound)
    const sub = this.phoneCtrl.valueChanges.subscribe((value) => {
      if (!this._syncing) {
        this._syncing = true;

        const fieldTree = this.field();
        const fieldState = fieldTree();
        const currentSignalValue = fieldState.value();

        if (value !== currentSignalValue) {
          fieldState.value.set(value ?? '');
          fieldState.markAsTouched();
          fieldState.markAsDirty();
        }

        this._syncing = false;
      }
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }
}

// MARK: Mapper
/**
 * Custom mapper for the phone field type.
 *
 * Uses the standard valueFieldMapper pattern from ng-forge/integration to resolve
 * the field tree and build the standard inputs for the component.
 *
 * @param fieldDef - The phone field definition with a key property
 * @param fieldDef.key - The field key used to resolve the FieldTree from the form context
 * @returns Signal containing Record of input names to values for ngComponentOutlet
 */
export function phoneFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    return buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.(), defaultValidationMessages?.());
  });
}
