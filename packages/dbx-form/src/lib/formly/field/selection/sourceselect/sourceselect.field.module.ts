import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyChipsModule } from '@angular/material/legacy-chips';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
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
    MatLegacyInputModule,
    MatDividerModule,
    MatLegacyFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMenuModule,
    ReactiveFormsModule,
    DbxDatePipeModule,
    DbxLoadingModule,
    DbxButtonModule,
    DbxActionModule,
    MatLegacyChipsModule,
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
