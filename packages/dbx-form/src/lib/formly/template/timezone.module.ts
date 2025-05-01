import { NgModule } from '@angular/core';
import { DbxFormFormlySearchableFieldModule } from '../field/selection/searchable/searchable.field.module';

const importsAndExports = [DbxFormFormlySearchableFieldModule];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormTimezoneStringFieldModule {}
