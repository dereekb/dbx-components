import { NgModule } from '@angular/core';
import { DbxPromptModule } from './prompt/prompt.module';
import { DbxPopupModule } from './popup/popup.module';
import { DbxPopoverModule } from './popover/popover.module';
import { DbxFilterModule } from './filter/filter.module';

@NgModule({
  exports: [
    DbxFilterModule,
    DbxPromptModule,
    DbxPopoverModule,
    DbxPopupModule
  ],
})
export class DbxInteractionModule { }
