import { NgModule } from '@angular/core';
import { DbxFormFormlySearchableFieldModule } from '../field/selection/searchable/searchable.field.module';

const importsAndExports = [DbxFormFormlySearchableFieldModule];

/**
 * Angular module that provides the dependencies needed for the timezone string field template.
 *
 * Imports and re-exports the searchable field module required by {@link timezoneStringField}.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormTimezoneStringFieldModule {}
