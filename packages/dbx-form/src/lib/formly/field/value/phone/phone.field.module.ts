import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyAutocompleteModule } from '@angular/material/legacy-autocomplete';
import { MatLegacyChipsModule } from '@angular/material/legacy-chips';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { FormlyModule } from '@ngx-formly/core';
import { DbxPhoneFieldComponent } from './phone.field.component';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { FormlyMatFormFieldModule } from '@ngx-formly/material/form-field';
import { NgxMatIntlTelInputComponent } from 'ngx-mat-intl-tel-input';

@NgModule({
  imports: [
    CommonModule,
    MatLegacyInputModule,
    MatLegacyFormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    MatLegacyAutocompleteModule,
    MatLegacyChipsModule,
    MatIconModule,
    FlexLayoutModule,
    FormlyMatFormFieldModule,
    FormlyModule.forChild({
      types: [{ name: 'intphone', component: DbxPhoneFieldComponent, wrappers: ['form-field'] }]
    }),
    NgxMatIntlTelInputComponent
  ],
  declarations: [DbxPhoneFieldComponent],
  exports: []
})
export class DbxFormFormlyPhoneFieldModule {}
