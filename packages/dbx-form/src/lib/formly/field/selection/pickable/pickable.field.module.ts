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
import { DbxPickableChipListFieldComponent } from './pickable.chip.field.component';
import { DbxPickableListFieldComponent, DbxPickableListFieldItemListComponent, DbxPickableListFieldItemListViewComponent, DbxPickableListFieldItemListViewItemComponent } from './pickable.list.field.component';
import { DbxDatePipeModule, DbxInjectedComponentModule } from '@dereekb/dbx-core';
import { DbxAnchorModule, DbxTextModule, DbxLoadingModule, DbxButtonModule, DbxListLayoutModule } from '@dereekb/dbx-web';

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
    DbxListLayoutModule,
    FormlyModule.forChild({
      types: [

        { name: 'pickablechipfield', component: DbxPickableChipListFieldComponent, wrappers: ['form-field'] },
        { name: 'pickablelistfield', component: DbxPickableListFieldComponent, wrappers: ['form-field'] },
      ]
    })
  ],
  declarations: [
    DbxPickableChipListFieldComponent,
    DbxPickableListFieldComponent,
    DbxPickableListFieldItemListComponent,
    DbxPickableListFieldItemListViewComponent,
    DbxPickableListFieldItemListViewItemComponent
  ],
  exports: []
})
export class DbxFormFormlyPickableFieldModule { }
