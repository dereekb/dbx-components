import { Component, ChangeDetectionStrategy, input, computed, effect, type Signal, type InputSignal, DestroyRef, inject, ElementRef } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NgxMatInputTelComponent } from 'ngx-mat-input-tel';
import { MatInputModule } from '@angular/material/input';
import { AsyncPipe } from '@angular/common';
import { DynamicTextPipe, type DynamicText, type FieldMeta, type ValidationMessages, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES } from '@ng-forge/dynamic-forms';
import { resolveValueFieldContext, buildValueFieldInputs, createResolvedErrorsSignal, shouldShowErrors, setupMetaTracking } from '@ng-forge/dynamic-forms/integration';
import { MATERIAL_CONFIG } from '@ng-forge/dynamic-forms-material';
import type { FieldTree } from '@angular/forms/signals';
import { type Maybe, e164PhoneNumberExtensionPair, e164PhoneNumberFromE164PhoneNumberExtensionPair, type E164PhoneNumber, type E164PhoneNumberExtensionPair } from '@dereekb/util';
import { isPhoneExtension } from '../../../../validator/phone';
import { dbxForgeFieldDisabled } from '../../field.util';
import { toggleDisableFormControl } from '../../../../form/form';

/**
 * Custom props for the forge phone field.
 */
export interface DbxForgePhoneFieldProps {
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
   * Whether or not to allow adding an extension. False by default.
   */
  readonly allowExtension?: boolean;
  /**
   * Material form field appearance.
   */
  readonly appearance?: 'fill' | 'outline';
  /**
   * Hint text displayed below the field.
   */
  readonly hint?: DynamicText;
  /**
   * Autocomplete value for the phone input. The underlying `ngx-mat-input-tel`
   * component supports `'off'` and `'tel'`.
   */
  readonly autocomplete?: 'off' | 'tel';
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
  templateUrl: './phone.field.component.html',
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      :host mat-form-field {
        width: 100%;
      }
    `
  ]
})
export class DbxForgePhoneFieldComponent {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  // Standard ng-forge value field inputs
  readonly field: InputSignal<FieldTree<string>> = input.required<FieldTree<string>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<DbxForgePhoneFieldProps | undefined> = input<DbxForgePhoneFieldProps | undefined>();
  readonly meta: InputSignal<FieldMeta | undefined> = input<FieldMeta | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  /**
   * Internal FormControl used to bridge ngx-mat-input-tel (reactive forms)
   * with the ng-forge Signal Forms field tree.
   */
  readonly phoneCtrl = new FormControl<string>('');
  readonly extensionCtrl = new FormControl<string>('', { validators: [isPhoneExtension()] });

  // Computed props
  readonly preferredCountries: Signal<string[]> = computed(() => this.props()?.preferredCountries ?? FORGE_DEFAULT_PREFERRED_COUNTRIES);
  readonly onlyCountries: Signal<string[]> = computed(() => this.props()?.onlyCountries ?? []);
  readonly enableSearch: Signal<boolean> = computed(() => this.props()?.enableSearch ?? true);
  readonly allowExtension: Signal<boolean> = computed(() => this.props()?.allowExtension ?? false);
  readonly effectiveAppearance = computed(() => this.props()?.appearance ?? this.materialConfig?.appearance ?? 'outline');
  readonly effectiveAutocomplete = computed(() => this.props()?.autocomplete ?? 'off');

  // Disabled state
  readonly isDisabled = dbxForgeFieldDisabled();

  // Error handling
  readonly resolvedErrors = createResolvedErrorsSignal(this.field, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field);
  readonly errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []));

  // ARIA
  protected readonly hintId = computed(() => `${this.key()}-hint`);
  protected readonly errorId = computed(() => `${this.key()}-error`);
  protected readonly ariaInvalid = computed(() => (this.showErrors() ? 'true' : null));
  protected readonly ariaRequired = computed(() => (this.field()().required() ? 'true' : null));
  protected readonly ariaDescribedBy = computed(() => {
    if (this.errorsToDisplay().length > 0) return this.errorId();
    if (this.props()?.hint) return this.hintId();
    return null;
  });

  /**
   * Flag to prevent feedback loops during sync.
   */
  private _syncing = false;

  constructor() {
    setupMetaTracking(this.elementRef, this.meta as any, { selector: 'ngx-mat-input-tel' });

    // Disabled state propagation
    effect(() => {
      const disabled = this.isDisabled();
      toggleDisableFormControl(this.phoneCtrl, disabled);
      toggleDisableFormControl(this.extensionCtrl, disabled);
    });

    // Sync Signal Forms field -> FormControl (inbound)
    effect(() => {
      const fieldTree = this.field();
      const fieldState = fieldTree();
      const signalValue: Maybe<string> = fieldState.value();

      if (!this._syncing) {
        this._syncing = true;

        if (signalValue) {
          const pair = e164PhoneNumberExtensionPair(signalValue);
          const phone = pair.number ?? '';
          const extension = pair.extension ?? '';

          if (phone !== this.phoneCtrl.value) {
            this.phoneCtrl.setValue(phone, { emitEvent: false });
          }

          if (extension !== this.extensionCtrl.value) {
            this.extensionCtrl.setValue(extension, { emitEvent: false });
          }
        } else if (this.phoneCtrl.value !== '') {
          this.phoneCtrl.setValue('', { emitEvent: false });
          this.extensionCtrl.setValue('', { emitEvent: false });
        }

        this._syncing = false;
      }
    });

    // Sync FormControl -> Signal Forms field (outbound)
    const phoneSub = this.phoneCtrl.valueChanges.subscribe((phone) => {
      this._syncOutbound(phone, this.extensionCtrl.value);
    });

    const extSub = this.extensionCtrl.valueChanges.subscribe((ext) => {
      this._syncOutbound(this.phoneCtrl.value, ext);
    });

    this.destroyRef.onDestroy(() => {
      phoneSub.unsubscribe();
      extSub.unsubscribe();
    });
  }

  private _syncOutbound(phone: Maybe<string>, extension: Maybe<string>): void {
    if (this._syncing) {
      return;
    }

    this._syncing = true;

    const fieldTree = this.field();
    const fieldState = fieldTree();
    let outputValue: string;

    if (phone && this.allowExtension()) {
      outputValue = e164PhoneNumberFromE164PhoneNumberExtensionPair({
        number: phone as E164PhoneNumber,
        extension: extension ?? undefined
      } as E164PhoneNumberExtensionPair);
    } else {
      outputValue = phone ?? '';
    }

    const currentSignalValue = fieldState.value();

    if (outputValue !== currentSignalValue) {
      fieldState.value.set(outputValue);
      fieldState.markAsTouched();
      fieldState.markAsDirty();
    }

    this._syncing = false;
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
