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
 * Provides all base @dereekb/dbx-core and @dereekb/dbx-web button components.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxButtonModule {}
