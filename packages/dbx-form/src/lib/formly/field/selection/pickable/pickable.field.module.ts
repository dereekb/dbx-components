import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxPickableChipListFieldComponent } from './pickable.chip.field.component';
import { DbxPickableListFieldComponent, DbxPickableListFieldItemListComponent, DbxPickableListFieldItemListViewComponent, DbxPickableListFieldItemListViewItemComponent } from './pickable.list.field.component';

const importsAndExports = [DbxPickableChipListFieldComponent, DbxPickableListFieldComponent, DbxPickableListFieldItemListComponent, DbxPickableListFieldItemListViewComponent, DbxPickableListFieldItemListViewItemComponent];

@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [
        { name: 'pickablechipfield', component: DbxPickableChipListFieldComponent, wrappers: ['form-field'] },
        { name: 'pickablelistfield', component: DbxPickableListFieldComponent, wrappers: ['form-field'] }
      ]
    })
  ],
  exports: importsAndExports
})
export class DbxFormFormlyPickableFieldModule {}
