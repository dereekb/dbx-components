import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormlyModule } from '@ngx-formly/core';
import { DbxInternationalPhoneFieldComponent } from './phone.field.component';
import { DbxGenericFieldModule } from '../generic/generic.field.module';
import { FlexLayoutModule } from '@angular/flex-layout';
import { NgxMatIntlTelInputModule } from 'ngx-mat-intl-tel-input';

@NgModule({
  imports: [
    CommonModule,
    MatInputModule,
    FormsModule,
    NgxMatIntlTelInputModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatIconModule,
    FlexLayoutModule,
    FormlyModule.forChild({
      types: [
        { name: 'intphone', component: DbxInternationalPhoneFieldComponent }
      ]
    })
  ],
  declarations: [
    DbxInternationalPhoneFieldComponent
  ],
  exports: [
    DbxGenericFieldModule
  ]
})
export class DbxPhoneFieldModule { }
