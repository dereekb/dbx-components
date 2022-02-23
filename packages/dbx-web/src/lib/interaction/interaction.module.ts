import { NgModule } from '@angular/core';
import { DbxDialogInteractionModule } from './dialog/dialog.module';
import { DbxPromptModule } from './prompt/prompt.module';
import { DbxPopupInteractionModule } from './popup/popup.module';
import { DbxPopoverInteractionModule } from './popover/popover.module';
import { DbxFilterInteractionModule } from './filter/filter.module';

@NgModule({
  exports: [
    DbxDialogInteractionModule,
    DbxFilterInteractionModule,
    DbxPromptModule,
    DbxPopoverInteractionModule,
    DbxPopupInteractionModule
  ],
})
export class DbxInteractionModule { }
