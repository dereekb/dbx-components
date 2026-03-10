import { NgModule } from '@angular/core';
import { DbxFlexGroupDirective } from './flex.group.directive';
import { DbxFlexSizeDirective } from './flex.size.directive';

const importsAndExports = [DbxFlexGroupDirective, DbxFlexSizeDirective];

/**
 * Module that exports {@link DbxFlexGroupDirective} and {@link DbxFlexSizeDirective}.
 *
 * @deprecated Import `DbxFlexGroupDirective` and `DbxFlexSizeDirective` directly instead.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFlexLayoutModule {}
