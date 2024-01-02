import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyChipsModule } from '@angular/material/legacy-chips';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { FormlyModule } from '@ngx-formly/core';
import { DbxDateTimeFieldComponent } from './datetime.field.component';
import { DbxDatePipeModule, DbxValuePipeModule } from '@dereekb/dbx-core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { MatButtonModule } from '@angular/material/button';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { MatDividerModule } from '@angular/material/divider';
import { DbxFormFormlyWrapperModule } from '../../wrapper/form.wrapper.module';
import { DbxButtonModule } from '@dereekb/dbx-web';
import { DbxFixedDateRangeFieldComponent } from './fixeddaterange.field.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatLegacyInputModule,
    MatDividerModule,
    MatLegacyFormFieldModule,
    DbxButtonModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatLegacyMenuModule,
    ReactiveFormsModule,
    DbxDatePipeModule,
    DbxValuePipeModule,
    MatLegacyChipsModule,
    MatIconModule,
    FlexLayoutModule,
    FormlyModule.forChild({
      types: [
        //
        { name: 'datetime', component: DbxDateTimeFieldComponent, wrappers: ['style', 'form-field'] },
        { name: 'fixeddaterange', component: DbxFixedDateRangeFieldComponent, wrappers: ['style', 'form-field'] }
      ]
    })
  ],
  declarations: [DbxDateTimeFieldComponent, DbxFixedDateRangeFieldComponent],
  exports: [DbxFormFormlyWrapperModule]
})
export class DbxFormFormlyDateFieldModule {}
