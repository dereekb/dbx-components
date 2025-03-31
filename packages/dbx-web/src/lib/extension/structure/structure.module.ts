import { NgModule } from '@angular/core';
import { DbxStructureDirective } from './structure.structure.directive';
import { DbxBodyDirective } from './structure.body.directive';

const importsAndExports = [DbxBodyDirective, DbxStructureDirective];

/**
 * @deprecated Use DbxStructureDirective and DbxBodyDirective directly instead.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxStructureModule { }
