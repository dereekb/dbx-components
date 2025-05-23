import { NgModule } from '@angular/core';
import { DbxActionKeyTriggerDirective } from './key.trigger.directive';
import { DbxActionButtonDirective, DbxCoreActionModule } from '@dereekb/dbx-core';
import { DbxActionConfirmDirective } from './action.confirm.directive';

const importsAndExports = [DbxCoreActionModule, DbxActionButtonDirective, DbxActionKeyTriggerDirective, DbxActionConfirmDirective];

/**
 * Provides all base dbxAction-related components from both @dereekb/core and @dereekb/web.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxActionModule {}
