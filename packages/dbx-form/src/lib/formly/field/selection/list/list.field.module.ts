import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyAutocompleteModule } from '@angular/material/legacy-autocomplete';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { FormlyModule } from '@ngx-formly/core';
import { MatButtonModule } from '@angular/material/button';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxTextModule, DbxLoadingModule, DbxButtonModule, DbxListLayoutModule } from '@dereekb/dbx-web';
import { DbxItemListFieldComponent } from './list.field.component';
import { MatDividerModule } from '@angular/material/divider';

@NgModule({
  imports: [
    CommonModule,
    DbxTextModule,
    DbxLoadingModule,
    DbxButtonModule,
    FormsModule,
    MatDividerModule,
    MatButtonModule,
    MatLegacyInputModule,
    MatLegacyFormFieldModule,
    ReactiveFormsModule,
    MatLegacyAutocompleteModule,
    MatIconModule,
    DbxInjectionComponentModule,
    DbxListLayoutModule,
    FormlyModule.forChild({
      types: [{ name: 'dbxlistfield', component: DbxItemListFieldComponent }]
    })
  ],
  declarations: [DbxItemListFieldComponent],
  exports: [DbxItemListFieldComponent]
})
export class DbxFormFormlyDbxListFieldModule {}
