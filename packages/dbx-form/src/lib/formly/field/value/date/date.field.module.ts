import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormlyModule } from '@ngx-formly/core';
import { DbxDateTimeFieldComponent } from './datetime.field.component';
import { DbxDatePipeModule, DbxValuePipeModule } from '@dereekb/dbx-core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { DbxFormFormlyWrapperModule } from '../../wrapper/form.wrapper.module';
import { DbxButtonModule } from '@dereekb/dbx-web';
import { DbxFixedDateRangeFieldComponent } from './fixeddaterange.field.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatDividerModule,
    MatFormFieldModule,
    DbxButtonModule,
    MatButtonModule,
    MatDatepickerModule,
    MatMenuModule,
    ReactiveFormsModule,
    DbxDatePipeModule,
    DbxValuePipeModule,
    MatChipsModule,
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
