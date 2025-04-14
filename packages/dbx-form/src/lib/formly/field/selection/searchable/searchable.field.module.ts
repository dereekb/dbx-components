import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxSearchableChipFieldComponent } from './searchable.chip.field.component';
import { DbxDefaultSearchableFieldDisplayComponent, DbxSearchableFieldAutocompleteItemComponent } from './searchable.field.autocomplete.item.component';
import { DbxSearchableTextFieldComponent } from './searchable.text.field.component';

const importsAndExports = [DbxSearchableChipFieldComponent, DbxSearchableTextFieldComponent, DbxSearchableFieldAutocompleteItemComponent, DbxDefaultSearchableFieldDisplayComponent];

@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [
        { name: 'searchablechipfield', component: DbxSearchableChipFieldComponent, wrappers: ['form-field'] },
        { name: 'searchabletextfield', component: DbxSearchableTextFieldComponent, wrappers: ['form-field'] }
      ]
    })
  ],
  exports: importsAndExports
})
export class DbxFormFormlySearchableFieldModule {}
