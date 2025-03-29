import { NgModule } from '@angular/core';
import { DbxActionKeyTriggerDirective } from './key.trigger.directive';
import { DbxCoreActionModule } from '@dereekb/dbx-core';
import { DbxActionConfirmDirective } from './action.confirm.directive';

const importsAndExports = [DbxCoreActionModule, DbxActionKeyTriggerDirective, DbxActionConfirmDirective];

/**
 * Provides the base DbxAction-related components from @dereekb/web.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxActionModule {}
