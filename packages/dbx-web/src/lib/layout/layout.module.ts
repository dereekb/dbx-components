import { NgModule } from '@angular/core';
import { DbxSectionLayoutModule } from './section/section.layout.module';
import { DbxFlagLayoutModule } from './flag/flag.layout.module';
import { DbxContentLayoutModule } from './content/content.layout.module';
import { DbxColumnLayoutModule } from './column/column.layout.module';
import { DbxCardBoxLayoutModule } from './card/card.box.layout.module';
import { DbxCompactLayoutModule } from './compact/compact.layout.module';
import { DbxBarLayoutModule } from './bar/bar.layout.module';
import { DbxTextModule } from './text/text.module';
import { DbxStyleLayoutModule } from './style/style.layout.module';
import { DbxFlexLayoutModule } from './flex/flex.layout.module';

@NgModule({
  exports: [DbxBarLayoutModule, DbxCardBoxLayoutModule, DbxColumnLayoutModule, DbxCompactLayoutModule, DbxContentLayoutModule, DbxFlagLayoutModule, DbxFlexLayoutModule, DbxSectionLayoutModule, DbxStyleLayoutModule, DbxTextModule]
})
export class DbxLayoutModule {}
