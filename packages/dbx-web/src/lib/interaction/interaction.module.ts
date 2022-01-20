import { NgModule } from '@angular/core';
import { DbNgxPromptModule } from './prompt/prompt.module';
import { DbNgxPopupModule } from './popup/popup.module';
import { DbNgxPopoverModule } from './popover/popover.module';

@NgModule({
  exports: [
    DbNgxPromptModule,
    DbNgxPopoverModule,
    DbNgxPopupModule
  ],
})
export class DbNgxInteractionModule { }
