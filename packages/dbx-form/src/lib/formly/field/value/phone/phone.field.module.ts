import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormlyModule } from '@ngx-formly/core';
import { DbxPhoneFieldComponent } from './phone.field.component';
import { FlexLayoutModule } from '@angular/flex-layout';
import { NgxMatIntlTelInputModule } from 'ngx-mat-intl-tel-input';
import { FormlyMatFormFieldModule } from '@ngx-formly/material/form-field';

@NgModule({
  imports: [
    CommonModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
    NgxMatIntlTelInputModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatIconModule,
    FlexLayoutModule,
    FormlyMatFormFieldModule,
    FormlyModule.forChild({
      types: [
        { name: 'intphone', component: DbxPhoneFieldComponent, wrappers: ['form-field'] }
      ]
    })
  ],
  declarations: [
    DbxPhoneFieldComponent
  ],
  exports: []
})
export class DbxFormFormlyPhoneFieldModule { }
