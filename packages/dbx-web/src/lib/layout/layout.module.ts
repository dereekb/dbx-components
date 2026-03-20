import { NgModule } from '@angular/core';
import { DbxSectionLayoutModule } from './section/section.layout.module';
import { DbxFlagLayoutModule } from './flag/flag.layout.module';
import { DbxContentLayoutModule } from './content/content.layout.module';
import { DbxColumnLayoutModule } from './column/column.layout.module';
import { DbxCardBoxLayoutModule } from './card/card.box.layout.module';
import { DbxCompactDirective } from './compact/compact.directive';
import { DbxBarLayoutModule } from './bar/bar.layout.module';
import { DbxTextModule } from './text/text.module';
import { DbxStyleLayoutModule } from './style/style.layout.module';
import { DbxFlexGroupDirective } from './flex/flex.group.directive';
import { DbxFlexSizeDirective } from './flex/flex.size.directive';

@NgModule({
  imports: [DbxCompactDirective, DbxFlexGroupDirective, DbxFlexSizeDirective],
  exports: [DbxBarLayoutModule, DbxCardBoxLayoutModule, DbxColumnLayoutModule, DbxCompactDirective, DbxContentLayoutModule, DbxFlagLayoutModule, DbxFlexGroupDirective, DbxFlexSizeDirective, DbxSectionLayoutModule, DbxStyleLayoutModule, DbxTextModule]
})
export class DbxLayoutModule {}
