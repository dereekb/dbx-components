import { NgModule } from '@angular/core';
import { DbxSectionLayoutModule } from './section/section.layout.module';
import { DbxListLayoutModule } from './list/list.layout.module';
import { DbxItemLayoutModule } from './item/item.layout.module';
import { DbxFlagLayoutModule } from './flag/flag.layout.module';
import { DbxDialogLayoutModule } from './dialog/dialog.layout.module';
import { DbxContentLayoutModule } from './content/content.layout.module';
import { DbxColumnLayoutModule } from './column/column.layout.module';
import { DbxCardBoxLayoutModule } from './card/card.box.layout.module';
import { DbxBlockLayoutModule } from './block/block.layout.module';
import { DbxCompactLayoutModule } from './compact/compact.layout.module';
import { DbxStepLayoutModule } from './step/step.layout.module';

@NgModule({
  exports: [
    DbxBlockLayoutModule,
    DbxCardBoxLayoutModule,
    DbxColumnLayoutModule,
    DbxCompactLayoutModule,
    DbxContentLayoutModule,
    DbxDialogLayoutModule,
    DbxFlagLayoutModule,
    DbxItemLayoutModule,
    DbxListLayoutModule,
    DbxSectionLayoutModule,
    DbxStepLayoutModule
  ],
})
export class DbxLayoutModule { }
