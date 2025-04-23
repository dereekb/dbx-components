import { DbxContentElevateDirective } from './content.elevate.directive';
import { NgModule } from '@angular/core';
import { DbxContentDirective } from './content.directive';
import { DbxContentBorderDirective } from './content.border.directive';
import { DbxContentContainerDirective } from './content.container.directive';
import { DbxContentBoxDirective } from './content.box.directive';
import { DbxContentPageDirective } from './content.page.directive';
import { DbxContentPitDirective } from './content.pit.directive';

const importsAndExports = [
  //
  DbxContentDirective,
  DbxContentContainerDirective,
  DbxContentBorderDirective,
  DbxContentElevateDirective,
  DbxContentBoxDirective,
  DbxContentPageDirective,
  DbxContentPitDirective
];

/**
 * Module for container-type components.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxContentLayoutModule {}
