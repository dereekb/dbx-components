import { NgModule } from '@angular/core';
import { DbxProgressBarButtonComponent } from './bar.button.component';
import { DbxProgressSpinnerButtonComponent } from './spinner.button.component';

const importsAndExports = [DbxProgressSpinnerButtonComponent, DbxProgressBarButtonComponent];

/**
 * @deprecated import DbxProgressSpinnerButtonComponent, DbxProgressBarButtonComponent directly instead.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxProgressButtonsModule {}
