import { MatListModule } from '@angular/material/list';
import { DbNgxButtonModule } from '../../../button/button.module';
import { DbNgxTextModule } from '@/app/common/responsive/text/text.module';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormlyModule } from '@ngx-formly/core';
import { DbNgxLoadingModule } from '@/app/common/loading/loading.module';
import { DbNgxDatePipesModule } from '@/app/common/date/pipe/date.pipe.module';
import { DbNgxSearchableChipFieldComponent } from './searchable.chip.field.component';
import { DbNgxFormRepeatTypeComponent } from './repeat.field.component';
import { MatButtonModule } from '@angular/material/button';
import {
  DbNgxDefaultSearchableAnchorFieldDisplayComponent, DbNgxDefaultSearchableFieldDisplayComponent,
  DbNgxSearchableFieldAutocompleteItemComponent
} from './searchable.field.autocomplete.item.component';
import { UIRouterModule } from '@uirouter/angular';
import { DbNgxAnchorModule } from '@/app/common/nav/anchor/anchor.module';
import { DbNgxSearchableTextFieldComponent } from './searchable.text.field.component';
import { DbNgxPickableChipFieldComponent } from './pickable.chip.field.component';
import { DbNgxPickableListFieldComponent } from './pickable.list.field.component';
import { DbNgxInjectedComponentModule } from '@/app/common/angular/injected/injected.component.module';

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
    DbNgxDatePipesModule,
    DbNgxAnchorModule,
    MatChipsModule,
    MatIconModule,
    UIRouterModule,
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
