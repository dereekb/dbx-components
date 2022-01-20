import { NgModule } from '@angular/core';
import { DbNgxSectionLayoutModule } from './section/section.layout.module';
import { DbNgxListLayoutModule } from './list/list.layout.module';
import { DbNgxItemLayoutModule } from './item/item.layout.module';
import { DbNgxFlagLayoutModule } from './flag/flag.layout.module';
import { DbNgxDialogLayoutModule } from './dialog/dialog.layout.module';
import { DbNgxContentLayoutModule } from './content/content.layout.module';
import { DbNgxColumnLayoutModule } from './column/column.layout.module';
import { DbNgxCardBoxLayoutModule } from './card/card.box.layout.module';
import { DbNgxBlockLayoutModule } from './block/block.layout.module';
import { DbNgxCompactLayoutModule } from './compact/compact.layout.module';
import { DbNgxStepLayoutModule } from './step/step.layout.module';

@NgModule({
  exports: [
    DbNgxBlockLayoutModule,
    DbNgxCardBoxLayoutModule,
    DbNgxColumnLayoutModule,
    DbNgxCompactLayoutModule,
    DbNgxContentLayoutModule,
    DbNgxDialogLayoutModule,
    DbNgxFlagLayoutModule,
    DbNgxItemLayoutModule,
    DbNgxListLayoutModule,
    DbNgxSectionLayoutModule,
    DbNgxStepLayoutModule
  ],
})
export class DbNgxLayoutModule { }
