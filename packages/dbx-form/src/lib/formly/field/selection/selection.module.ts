import { NgModule } from '@angular/core';
import { DbxFormFormlyPickableFieldModule } from './pickable/pickable.field.module';
import { DbxFormFormlySearchableFieldModule } from './searchable/searchable.field.module';
import { DbxFormFormlyDbxListFieldModule } from './list/list.field.module';
import { DbxFormFormlySourceSelectModule } from './sourceselect/sourceselect.field.module';

const importsAndExports = [DbxFormFormlyDbxListFieldModule, DbxFormFormlyPickableFieldModule, DbxFormFormlySearchableFieldModule, DbxFormFormlySourceSelectModule];

/**
 * @deprecated import the modules directly instead
 *
 * @see DbxFormFormlyDbxListFieldModule
 * @see DbxFormFormlyPickableFieldModule
 * @see DbxFormFormlySearchableFieldModule
 * @see DbxFormFormlySourceSelectModule
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormFormlySelectionModule {}
