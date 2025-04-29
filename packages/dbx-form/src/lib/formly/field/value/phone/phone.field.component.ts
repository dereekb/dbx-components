import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FieldType } from '@ngx-formly/material'; // extend FieldType from Material, not core!
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { isPhoneExtension } from '../../../../validator/phone';
import { E164PhoneNumber, E164PhoneNumberExtensionPair, Maybe, e164PhoneNumberExtensionPair, e164PhoneNumberFromE164PhoneNumberExtensionPair, objectHasNoKeys } from '@dereekb/util';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SubscriptionObject } from '@dereekb/rxjs';
import { combineLatest, distinctUntilChanged, map, startWith } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { FormlyMatFormFieldModule } from '@ngx-formly/material/form-field';
import { NgxMatIntlTelInputComponent } from 'ngx-mat-intl-tel-input';

export interface InternationalPhoneFormlyFieldProps extends FormlyFieldProps {
  readonly preferredCountries?: Maybe<string[]>;
  readonly onlyCountries?: Maybe<string[]>;
  /**
   * Whether or not to allow adding an extension. False by default.
   */
  readonly allowExtension?: boolean;
}

export const DEFAULT_PREFERRED_COUNTRIES = ['us'];

@Component({
  templateUrl: 'phone.field.component.html',
  imports: [CommonModule, MatInputModule, MatFormFieldModule, FormsModule, ReactiveFormsModule, MatIconModule, FlexLayoutModule, FormlyMatFormFieldModule, NgxMatIntlTelInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPhoneFieldComponent extends FieldType<FieldTypeConfig<InternationalPhoneFormlyFieldProps>> implements OnInit, OnDestroy {
  readonly inputSync = new SubscriptionObject();
  readonly outputSync = new SubscriptionObject();
  readonly extensionErrorSync = new SubscriptionObject();
  readonly phoneErrorSync = new SubscriptionObject();

  readonly phoneCtrl = new FormControl<string>('');
  readonly extensionCtrl = new FormControl<string>('', {
    validators: [isPhoneExtension()]
  });

  readonly inputFormGroup = new FormGroup({
    phone: this.phoneCtrl,
    extension: this.extensionCtrl
  });

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
            } else {
              return phone;
            }
          } else {
            return undefined;
          }
        }),
        distinctUntilChanged()
      )
      .subscribe((x) => {
        this.formControl.setValue(x);
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
    this.phoneErrorSync.subscription = this.inputFormGroup.statusChanges.subscribe((x) => {
      const errors = { ...this.phoneCtrl.errors, ...this.extensionCtrl.errors };
      this.formControl.setErrors(objectHasNoKeys(errors) ? null : errors, { emitEvent: true });
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.inputSync.destroy();
    this.outputSync.destroy();
    this.extensionErrorSync.destroy();
    this.phoneErrorSync.destroy();
  }
}
