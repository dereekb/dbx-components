import { NgModule } from '@angular/core';
import { DbxPromptModule } from './prompt/prompt.module';
import { DbxPopupModule } from './popup/popup.module';
import { DbxPopoverModule } from './popover/popover.module';

@NgModule({
  exports: [
    DbxPromptModule,
    DbxPopoverModule,
    DbxPopupModule
  ],
})
export class DbxInteractionModule { }
