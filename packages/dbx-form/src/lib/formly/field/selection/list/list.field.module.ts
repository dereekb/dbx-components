import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormlyModule } from '@ngx-formly/core';
import { MatButtonModule } from '@angular/material/button';
import { DbxDatePipeModule, DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxRouterAnchorModule, DbxTextModule, DbxLoadingModule, DbxButtonModule, DbxListLayoutModule } from '@dereekb/dbx-web';
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
    MatInputModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
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
