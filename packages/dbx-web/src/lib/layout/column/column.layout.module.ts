import { NgModule } from '@angular/core';
import { DbxTwoColumnLayoutModule } from './two';
import { DbxOneColumnComponent } from './one';

const importsAndExports = [DbxOneColumnComponent, DbxTwoColumnLayoutModule];

/**
 * Convenience module that bundles all column layout components and directives,
 * including both one-column and two-column layouts.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxColumnLayoutModule {}
