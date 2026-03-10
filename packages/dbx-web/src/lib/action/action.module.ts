import { NgModule } from '@angular/core';
import { DbxActionKeyTriggerDirective } from './key.trigger.directive';
import { DbxActionButtonDirective, DbxCoreActionModule } from '@dereekb/dbx-core';
import { DbxActionConfirmDirective } from './action.confirm.directive';

const importsAndExports = [DbxCoreActionModule, DbxActionButtonDirective, DbxActionKeyTriggerDirective, DbxActionConfirmDirective];

/**
 * Convenience module that bundles all base dbxAction-related directives from
 * both @dereekb/dbx-core and @dereekb/dbx-web, including key triggers and confirmation dialogs.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxActionModule {}
