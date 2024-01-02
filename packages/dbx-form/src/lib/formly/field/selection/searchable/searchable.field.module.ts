import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyAutocompleteModule } from '@angular/material/legacy-autocomplete';
import { MatLegacyListModule } from '@angular/material/legacy-list';
import { MatLegacyChipsModule } from '@angular/material/legacy-chips';
import { MatLegacyFormFieldModule } from '@angular/material/legacy-form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { FormlyModule } from '@ngx-formly/core';
import { DbxSearchableChipFieldComponent } from './searchable.chip.field.component';
import { MatButtonModule } from '@angular/material/button';
import { DbxDefaultSearchableFieldDisplayComponent, DbxSearchableFieldAutocompleteItemComponent } from './searchable.field.autocomplete.item.component';
import { DbxSearchableTextFieldComponent } from './searchable.text.field.component';
import { DbxDatePipeModule, DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxRouterAnchorModule, DbxTextModule, DbxLoadingModule, DbxButtonModule } from '@dereekb/dbx-web';

@NgModule({
  imports: [
    CommonModule,
    DbxTextModule,
    DbxLoadingModule,
    DbxButtonModule,
    FormsModule,
    MatButtonModule,
    MatLegacyInputModule,
    MatLegacyFormFieldModule,
    ReactiveFormsModule,
    MatLegacyAutocompleteModule,
    MatLegacyListModule,
    DbxDatePipeModule,
    DbxRouterAnchorModule,
    MatLegacyChipsModule,
    MatIconModule,
    DbxInjectionComponentModule,
    FormlyModule.forChild({
      types: [
        { name: 'searchablechipfield', component: DbxSearchableChipFieldComponent, wrappers: ['form-field'] },
        { name: 'searchabletextfield', component: DbxSearchableTextFieldComponent, wrappers: ['form-field'] }
      ]
    })
  ],
  declarations: [DbxSearchableChipFieldComponent, DbxSearchableTextFieldComponent, DbxSearchableFieldAutocompleteItemComponent, DbxDefaultSearchableFieldDisplayComponent],
  exports: [DbxSearchableChipFieldComponent, DbxSearchableTextFieldComponent]
})
export class DbxFormFormlySearchableFieldModule {}
