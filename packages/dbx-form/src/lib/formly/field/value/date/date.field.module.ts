import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormlyModule } from '@ngx-formly/core';
import { DbxDateTimeFieldComponent } from './datetime.field.component';
import { DbxDatePipeModule } from '@dereekb/dbx-core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatDividerModule,
    MatFormFieldModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMenuModule,
    ReactiveFormsModule,
    DbxDatePipeModule,
    MatChipsModule,
    MatIconModule,
    FlexLayoutModule,
    FormlyModule.forChild({
      types: [
        { name: 'datetime', component: DbxDateTimeFieldComponent }
      ]
    })
  ],
  declarations: [
    DbxDateTimeFieldComponent
  ],
  exports: []
})
export class DbxFormFormlyDateFieldModule { }
