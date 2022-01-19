import { DbNgxButtonModule } from './../../../button/button.module';
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
import { DbNgxEmailUserSummaryPickerFieldComponent } from './user.summary.picker.field.component';
import { DbNgxLoadingModule } from '@/app/common/loading/loading.module';
import { DbNgxDatePipeModule } from '@/app/common/date/pipe/date.pipe.module';
import { DbNgxGenericFieldModule } from '../generic/generic.field.module';

@NgModule({
  imports: [
    CommonModule,
    DbNgxTextModule,
    DbNgxLoadingModule,
    DbNgxButtonModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    DbNgxDatePipeModule,
    MatChipsModule,
    MatIconModule,
    DbNgxGenericFieldModule,
    FormlyModule.forChild({
      types: [
        { name: 'emailusersummarypicker', component: DbNgxEmailUserSummaryPickerFieldComponent }
      ]
    })
  ],
  declarations: [
    DbNgxEmailUserSummaryPickerFieldComponent
  ],
  exports: [
    DbNgxGenericFieldModule
  ]
})
export class DbNgxEmailFieldModule { }
