import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxItemListFieldComponent } from './list.field.component';

const importsAndExports = [DbxItemListFieldComponent];

/** Registers the `dbxlistfield` Formly field type for item list selection. */
@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [{ name: 'dbxlistfield', component: DbxItemListFieldComponent }]
    })
  ],
  exports: importsAndExports
})
export class DbxFormFormlyDbxListFieldModule {}
