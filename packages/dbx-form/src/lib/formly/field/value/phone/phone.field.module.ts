import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatLegacyChipsModule } from '@angular/material/legacy-chips';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormlyModule } from '@ngx-formly/core';
import { DbxPhoneFieldComponent } from './phone.field.component';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { FormlyMatFormFieldModule } from '@ngx-formly/material/form-field';
import { NgxMatIntlTelInputComponent } from 'ngx-mat-intl-tel-input';

@NgModule({
  imports: [
    CommonModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
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
