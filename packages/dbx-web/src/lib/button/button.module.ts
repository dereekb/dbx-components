import { NgModule } from '@angular/core';
import { DbxButtonComponent } from './button.component';
import { DbxButtonSpacerDirective } from './button.spacer.directive';
import { DbxCoreButtonModule } from '@dereekb/dbx-core';
import { DbxIconButtonComponent } from './icon';
import { DbxProgressSpinnerButtonComponent, DbxProgressBarButtonComponent } from './progress';

const importsAndExports = [
  DbxCoreButtonModule,
  DbxIconButtonComponent,
  // buttons
  DbxButtonComponent,
  DbxButtonSpacerDirective,
  // progress
  DbxProgressSpinnerButtonComponent,
  DbxProgressBarButtonComponent
];

/**
 * Convenience module that bundles all button components and directives from
 * both @dereekb/dbx-core and @dereekb/dbx-web, including progress buttons and icon buttons.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxButtonModule {}
