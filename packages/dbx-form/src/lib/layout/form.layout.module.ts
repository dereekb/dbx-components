import { NgModule } from '@angular/core';
import { DbxFormSpacerDirective } from './form.spacer.directive';

const importsAndExports = [DbxFormSpacerDirective];

/**
 * @deprecated import DbxFormSpacerDirective directly instead.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormLayoutModule {}
