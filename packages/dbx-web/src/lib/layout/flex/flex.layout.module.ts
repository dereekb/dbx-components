import { NgModule } from '@angular/core';
import { DbxFlexGroupDirective } from './flex.group.directive';
import { DbxFlexSizeDirective } from './flex.size.directive';

const importsAndExports = [DbxFlexGroupDirective, DbxFlexSizeDirective];

/**
 * @deprecated Import DbxFlexGroupDirective and DbxFlexSizeDirective instead.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFlexLayoutModule {}
