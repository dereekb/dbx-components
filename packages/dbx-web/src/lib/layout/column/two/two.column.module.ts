import { NgModule } from '@angular/core';
import { DbxTwoColumnSrefDirective } from './two.column.sref.directive';
import { DbxTwoColumnComponent } from './two.column.component';
import { DbxTwoColumnColumnHeadDirective } from './two.column.head.directive';
import { DbxTwoColumnRightComponent } from './two.column.right.component';
import { DbxTwoColumnBackDirective } from './two.column.back.directive';
import { DbxTwoColumnFullLeftDirective } from './two.column.full.left.directive';
import { DbxTwoColumnContextDirective } from './two.column.context.directive';
import { DbxTwoColumnSrefShowRightDirective } from './two.column.sref.showright.directive';

const importsAndExports = [DbxTwoColumnComponent, DbxTwoColumnRightComponent, DbxTwoColumnColumnHeadDirective, DbxTwoColumnSrefDirective, DbxTwoColumnBackDirective, DbxTwoColumnFullLeftDirective, DbxTwoColumnContextDirective, DbxTwoColumnSrefShowRightDirective];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxTwoColumnLayoutModule {}
