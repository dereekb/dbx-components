import { Component, type OnInit, type OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FieldType } from '@ngx-formly/material'; // extend FieldType from Material, not core!
import { type FieldTypeConfig, type FormlyFieldProps } from '@ngx-formly/core';
import { isPhoneExtension } from '../../../../validator/phone';
import { type E164PhoneNumber, type E164PhoneNumberExtensionPair, type Maybe, e164PhoneNumberExtensionPair, e164PhoneNumberFromE164PhoneNumberExtensionPair, objectHasNoKeys } from '@dereekb/util';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { combineLatest, distinctUntilChanged, map, startWith } from 'rxjs';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { FormlyMatFormFieldModule } from '@ngx-formly/material/form-field';
import { NgxMatInputTelComponent } from 'ngx-mat-input-tel';
import { cleanSubscription } from '@dereekb/dbx-core';

/**
 * Formly field props for the international phone number component.
 */
export interface InternationalPhoneFormlyFieldProps extends FormlyFieldProps {
  /**
   * ISO country codes for countries shown first in the dropdown.
   */
  readonly preferredCountries?: Maybe<string[]>;
  /**
   * ISO country codes to restrict the dropdown to.
   */
  readonly onlyCountries?: Maybe<string[]>;
  /**
   * Whether or not to enable the search feature. True by default.
   */
  readonly enableSearch?: boolean;
  /**
   * Whether or not to allow adding an extension. False by default.
   */
  readonly allowExtension?: boolean;
}

/**
 * Default preferred countries shown at the top of the phone country dropdown.
 */
export const DEFAULT_PREFERRED_COUNTRIES = ['us'];

/**
 * Formly custom field type for international phone number input with optional extension support.
 *
 * Uses ngx-mat-input-tel for the country-aware phone input and manages E.164 phone number
 * formatting. Supports splitting phone + extension pairs for storage and display.
 *
 * Registered as Formly type `'intphone'`.
 */
@Component({
  templateUrl: 'phone.field.component.html',
  imports: [MatInputModule, MatFormFieldModule, FormsModule, ReactiveFormsModule, MatIconModule, FlexLayoutModule, FormlyMatFormFieldModule, NgxMatInputTelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPhoneFieldComponent extends FieldType<FieldTypeConfig<InternationalPhoneFormlyFieldProps>> implements OnInit, OnDestroy {
  readonly inputSync = cleanSubscription();
  readonly outputSync = cleanSubscription();
  readonly extensionErrorSync = cleanSubscription();
  readonly phoneErrorSync = cleanSubscription();

  readonly phoneCtrl = new FormControl<string>('');
  readonly extensionCtrl = new FormControl<string>('', {
    validators: [isPhoneExtension()]
  });

  readonly inputFormGroup = new FormGroup({
    phone: this.phoneCtrl,
    extension: this.extensionCtrl
  });

  get enableSearch(): boolean {
    return this.props.enableSearch ?? true;
  }

  get preferredCountries(): string[] {
    return this.props.preferredCountries ?? DEFAULT_PREFERRED_COUNTRIES;
  }

  get onlyCountries(): string[] {
    return this.props.onlyCountries ?? [];
  }

  get allowExtension(): boolean {
    return this.props.allowExtension ?? false;
  }

  ngOnInit(): void {
    this.inputSync.subscription = this.formControl.valueChanges.pipe(startWith(this.formControl.value), distinctUntilChanged()).subscribe((inputValue) => {
      let phone: Maybe<string>;
      let extension: Maybe<string>;

      if (inputValue) {
        const pair = e164PhoneNumberExtensionPair(inputValue);
        phone = pair.number;
        extension = pair.extension;
      }

      // do not clear/reset if phone is undefined and the phone value is currently null
      if (phone || (!phone && this.phoneCtrl.value !== null)) {
        this.phoneCtrl.setValue(phone || '');
        this.extensionCtrl.setValue(extension || '');
      }
    });

    this.outputSync.subscription = combineLatest([this.phoneCtrl.valueChanges.pipe(distinctUntilChanged()), this.extensionCtrl.valueChanges.pipe(startWith(this.extensionCtrl.value), distinctUntilChanged())])
      .pipe(
        map(([phone, extension]) => {
          if (phone) {
            if (this.allowExtension) {
              return e164PhoneNumberFromE164PhoneNumberExtensionPair({
                number: phone as E164PhoneNumber,
                extension
              } as E164PhoneNumberExtensionPair);
            }

            return phone;
          }

          return undefined;
        }),
        distinctUntilChanged()
      )
      .subscribe((x) => {
        this.formControl.setValue(x);
        this.formControl.markAsDirty();
        this.formControl.markAsTouched();
      });

    /*
     * The phoneCtrl's errors are being used to drive the error matcher for this. Sync any invalid states with errors to phoneCtrl.
     * PhoneCtrl updates when the input is updated so it works.
     */
    this.extensionErrorSync.subscription = this.extensionCtrl.statusChanges.subscribe((x) => {
      if (x === 'INVALID') {
        this.phoneCtrl.setErrors(this.formControl.errors, { emitEvent: true });
      }
    });

    // sync any phoneCtrl errors with the errors of the form control.
    this.phoneErrorSync.subscription = this.inputFormGroup.statusChanges.subscribe((_x) => {
      const errors = { ...this.phoneCtrl.errors, ...this.extensionCtrl.errors };
      this.formControl.setErrors(objectHasNoKeys(errors) ? null : errors, { emitEvent: true });
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
  }
}
