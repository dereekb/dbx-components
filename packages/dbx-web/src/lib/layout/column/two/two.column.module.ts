import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxAnchorModule } from '../../../router';
import { DbxContentLayoutModule } from '../../content';
import { DbxTwoColumnSrefDirective } from './two.column.sref.directive';
import { DbxTwoColumnComponent } from './two.column.component';
import { DbxTwoColumnColumnHeadComponent } from './two.column.head.component';
import { DbxTwoColumnRightComponent } from './two.column.right.component';
import { DbxTwoColumnBackDirective } from './two.column.back.directive';
import { DbxTwoColumnFullLeftDirective } from './two.column.full.left.directive';
import { DbxTwoColumnContextDirective } from './two.column.context.directive';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    DbxAnchorModule,
    DbxContentLayoutModule
  ],
  declarations: [
    DbxTwoColumnComponent,
    DbxTwoColumnRightComponent,
    DbxTwoColumnColumnHeadComponent,
    DbxTwoColumnSrefDirective,
    DbxTwoColumnBackDirective,
    DbxTwoColumnFullLeftDirective,
    DbxTwoColumnContextDirective
  ],
  exports: [
    DbxTwoColumnComponent,
    DbxTwoColumnRightComponent,
    DbxTwoColumnColumnHeadComponent,
    DbxTwoColumnSrefDirective,
    DbxTwoColumnBackDirective,
    DbxTwoColumnFullLeftDirective,
    DbxTwoColumnContextDirective
  ],
})
export class DbxTwoColumnLayoutModule { }
