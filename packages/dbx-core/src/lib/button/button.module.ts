import { NgModule } from '@angular/core';
import { DbxActionButtonTriggerDirective, DbxActionButtonDirective } from './action';
import { DbxButtonDirective } from './button.directive';
import { DbxLoadingButtonDirective } from './button.loading.directive';
import { DbxButtonSegueDirective } from './router/button.segue.directive';

const importsAndExports = [DbxButtonDirective, DbxLoadingButtonDirective, DbxActionButtonTriggerDirective, DbxActionButtonDirective, DbxButtonSegueDirective];

/**
 * Exports the following directives:
 * - DbxButtonDirective
 * - DbxLoadingButtonDirective
 * - DbxActionButtonTriggerDirective
 * - DbxActionButtonDirective
 * - DbxButtonSegueDirective
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxCoreButtonModule {}
