import { DbxCardBoxContainerDirective } from './card.box.container.directive';
import { DbxCardBoxComponent } from './card.box.component';
import { NgModule } from '@angular/core';

const importsAndExports = [DbxCardBoxComponent, DbxCardBoxContainerDirective];

/**
 * Convenience module that imports and exports all card box layout components and directives.
 *
 * Includes {@link DbxCardBoxComponent} and {@link DbxCardBoxContainerDirective}.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxCardBoxLayoutModule {}
