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
import { DbxSearchableChipFieldComponent } from './searchable.chip.field.component';
import { MatButtonModule } from '@angular/material/button';
import {
  DbxDefaultSearchableAnchorFieldDisplayComponent, DbxDefaultSearchableFieldDisplayComponent,
  DbxSearchableFieldAutocompleteItemComponent
} from './searchable.field.autocomplete.item.component';
import { DbxSearchableTextFieldComponent } from './searchable.text.field.component';
import { DbxDatePipeModule, DbxInjectedComponentModule } from '@dereekb/dbx-core';
import { DbxAnchorModule, DbxTextModule, DbxLoadingModule, DbxButtonModule } from '@dereekb/dbx-web';

@NgModule({
  imports: [
    CommonModule,
    DbxTextModule,
    DbxLoadingModule,
    DbxButtonModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatListModule,
    DbxDatePipeModule,
    DbxAnchorModule,
    MatChipsModule,
    MatIconModule,
    DbxInjectedComponentModule,
    FormlyModule.forChild({
      types: [
        { name: 'searchablechipfield', component: DbxSearchableChipFieldComponent },
        { name: 'searchabletextfield', component: DbxSearchableTextFieldComponent }
      ]
    })
  ],
  declarations: [
    DbxSearchableChipFieldComponent,
    DbxSearchableTextFieldComponent,
    DbxSearchableFieldAutocompleteItemComponent,
    DbxDefaultSearchableFieldDisplayComponent,
    DbxDefaultSearchableAnchorFieldDisplayComponent
  ],
  exports: []
})
export class DbxFormFormlySearchableFieldModule { }
