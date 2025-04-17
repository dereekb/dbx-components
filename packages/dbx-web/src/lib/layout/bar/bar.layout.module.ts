import { NgModule } from '@angular/core';
import { DbxBarDirective } from './bar.directive';
import { DbxBarHeaderComponent } from './bar.header.component';
import { DbxPagebarComponent } from './pagebar.component';

const importsAndExports = [DbxBarDirective, DbxBarHeaderComponent, DbxPagebarComponent];

/**
 * Module for dbx-bar components.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxBarLayoutModule {}
