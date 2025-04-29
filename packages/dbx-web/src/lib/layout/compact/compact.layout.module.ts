import { NgModule } from '@angular/core';
import { DbxCompactDirective } from './compact.directive';

const importsAndExports = [DbxCompactDirective];

/**
 * @deprecated import DbxCompactDirective directly instead.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxCompactLayoutModule {}
