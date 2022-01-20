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
import { DbNgxSearchableChipFieldComponent } from './searchable.chip.field.component';
import { DbNgxFormRepeatTypeComponent } from './repeat.field.component';
import { MatButtonModule } from '@angular/material/button';
import {
  DbNgxDefaultSearchableAnchorFieldDisplayComponent, DbNgxDefaultSearchableFieldDisplayComponent,
  DbNgxSearchableFieldAutocompleteItemComponent
} from './searchable.field.autocomplete.item.component';
import { DbNgxSearchableTextFieldComponent } from './searchable.text.field.component';
import { DbNgxPickableChipFieldComponent } from './pickable.chip.field.component';
import { DbNgxPickableListFieldComponent } from './pickable.list.field.component';
import { DbNgxDatePipeModule, DbNgxInjectedComponentModule } from '@dereekb/ngx-core';
import { DbNgxAnchorModule, DbNgxTextModule, DbNgxLoadingModule, DbNgxButtonModule } from '@dereekb/ngx-web';

@NgModule({
  imports: [
    CommonModule,
    DbNgxTextModule,
    DbNgxLoadingModule,
    DbNgxButtonModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatListModule,
    DbNgxDatePipeModule,
    DbNgxAnchorModule,
    MatChipsModule,
    MatIconModule,
    DbNgxInjectedComponentModule,
    FormlyModule.forChild({
      types: [
        { name: 'repeat', component: DbNgxFormRepeatTypeComponent },
        { name: 'pickablechipfield', component: DbNgxPickableChipFieldComponent },
        { name: 'pickablelistfield', component: DbNgxPickableListFieldComponent },
        { name: 'searchablechipfield', component: DbNgxSearchableChipFieldComponent },
        { name: 'searchabletextfield', component: DbNgxSearchableTextFieldComponent }
      ]
    })
  ],
  declarations: [
    DbNgxFormRepeatTypeComponent,
    DbNgxPickableChipFieldComponent,
    DbNgxPickableListFieldComponent,
    DbNgxSearchableChipFieldComponent,
    DbNgxSearchableTextFieldComponent,
    DbNgxSearchableFieldAutocompleteItemComponent,
    DbNgxDefaultSearchableFieldDisplayComponent,
    DbNgxDefaultSearchableAnchorFieldDisplayComponent
  ],
  exports: []
})
export class DbNgxGenericFieldModule { }
