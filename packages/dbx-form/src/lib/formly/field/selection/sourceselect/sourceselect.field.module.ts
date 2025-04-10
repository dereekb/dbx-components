import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormlyModule } from '@ngx-formly/core';
import { DbxDatePipeModule } from '@dereekb/dbx-core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { DbxFormSourceSelectFieldComponent } from './sourceselect.field.component';
import { MatSelectModule } from '@angular/material/select';
import { DbxActionModule, DbxButtonModule, DbxLoadingModule } from '@dereekb/dbx-web';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatDividerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatMenuModule,
    ReactiveFormsModule,
    DbxDatePipeModule,
    DbxLoadingModule,
    DbxButtonModule,
    DbxActionModule,
    MatChipsModule,
    MatIconModule,
    FlexLayoutModule,
    FormlyModule.forChild({
      types: [{ name: 'sourceselectfield', component: DbxFormSourceSelectFieldComponent, wrappers: ['form-field'] }]
    })
  ],
  declarations: [DbxFormSourceSelectFieldComponent],
  exports: [DbxFormSourceSelectFieldComponent]
})
export class DbxFormFormlySourceSelectModule {}
