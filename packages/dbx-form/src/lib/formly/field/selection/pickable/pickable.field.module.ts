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
import { MatButtonModule } from '@angular/material/button';
import { DbxPickableChipListFieldComponent } from './pickable.chip.field.component';
import { DbxPickableListFieldComponent, DbxPickableListFieldItemListComponent, DbxPickableListFieldItemListViewComponent, DbxPickableListFieldItemListViewItemComponent } from './pickable.list.field.component';
import { DbxDatePipeModule, DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxRouterAnchorModule, DbxTextModule, DbxLoadingModule, DbxButtonModule, DbxListLayoutModule } from '@dereekb/dbx-web';

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
    DbxListLayoutModule,
    FormlyModule.forChild({
      types: [
        { name: 'pickablechipfield', component: DbxPickableChipListFieldComponent, wrappers: ['form-field'] },
        { name: 'pickablelistfield', component: DbxPickableListFieldComponent, wrappers: ['form-field'] }
      ]
    })
  ],
  declarations: [DbxPickableChipListFieldComponent, DbxPickableListFieldComponent, DbxPickableListFieldItemListComponent, DbxPickableListFieldItemListViewComponent, DbxPickableListFieldItemListViewItemComponent],
  exports: []
})
export class DbxFormFormlyPickableFieldModule {}
