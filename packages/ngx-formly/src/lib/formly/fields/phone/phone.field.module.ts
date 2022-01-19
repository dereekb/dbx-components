import { DbNgxButtonModule } from '../../../button/button.module';
import { DbNgxTextModule } from '@/app/common/responsive/text/text.module';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormlyModule } from '@ngx-formly/core';
import { DbNgxInternationalPhoneFieldComponent } from './phone.field.component';
import { DbNgxLoadingModule } from '@/app/common/loading/loading.module';
import { DbNgxDatePipeModule } from '@/app/common/date/pipe/date.pipe.module';
import { DbNgxGenericFieldModule } from '../generic/generic.field.module';
import { FlexLayoutModule } from '@angular/flex-layout';
import { NgxMatIntlTelInputModule } from 'ngx-mat-intl-tel-input';

@NgModule({
  imports: [
    CommonModule,
    MatInputModule,
    DbNgxTextModule,
    DbNgxLoadingModule,
    DbNgxButtonModule,
    FormsModule,
    NgxMatIntlTelInputModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    DbNgxDatePipeModule,
    MatChipsModule,
    MatIconModule,
    FlexLayoutModule,
    FormlyModule.forChild({
      types: [
        { name: 'intphone', component: DbNgxInternationalPhoneFieldComponent }
      ]
    })
  ],
  declarations: [
    DbNgxInternationalPhoneFieldComponent
  ],
  exports: [
    DbNgxGenericFieldModule
  ]
})
export class DbNgxPhoneFieldModule { }
