import { NgModule } from '@angular/core';
import { DbxButtonComponent } from './button.component';
import { DbxButtonSpacerDirective } from './button.spacer.component';
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
 * Exports all dbx-core and dbx-web button components.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxButtonModule {}
