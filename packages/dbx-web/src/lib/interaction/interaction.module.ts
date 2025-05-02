import { NgModule } from '@angular/core';
import { DbxDialogModule } from './dialog/dialog.module';
import { DbxPromptModule } from './prompt/prompt.module';
import { DbxPopupInteractionModule } from './popup/popup.module';
import { DbxPopoverInteractionModule } from './popover/popover.module';
import { DbxFilterInteractionModule } from './filter/filter.module';

const importsAndExports = [DbxPromptModule, DbxDialogModule, DbxFilterInteractionModule, DbxPopoverInteractionModule, DbxPopupInteractionModule];

/**
 * @deprecated import individual modules instead.
 *
 * @see DbxDialogModule
 * @see DbxFilterInteractionModule
 * @see DbxPromptModule
 * @see DbxPopoverInteractionModule
 * @see DbxPopupInteractionModule
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxInteractionModule {}
