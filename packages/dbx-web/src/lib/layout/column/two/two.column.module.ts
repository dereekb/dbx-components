import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxAnchorModule } from '../../../router';
import { DbxContentLayoutModule } from '../../content';
import { DbxTwoColumnsSrefDirective } from './two.column.sref.directive';
import { DbxTwoColumnsComponent } from './two.column.component';
import { DbxTwoColumnsColumnHeadComponent } from './two.column.head.component';
import { DbxTwoColumnsRightComponent } from './two.column.right.component';
import { DbxTwoColumnsBackDirective } from './two.column.back.directive';
import { DbxTwoColumnsFullLeftDirective } from './two.column.full.left.directive';
import { DbxTwoColumnsContextDirective } from './two.column.context.directive';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    DbxAnchorModule,
    DbxContentLayoutModule
  ],
  declarations: [
    DbxTwoColumnsComponent,
    DbxTwoColumnsRightComponent,
    DbxTwoColumnsColumnHeadComponent,
    DbxTwoColumnsSrefDirective,
    DbxTwoColumnsBackDirective,
    DbxTwoColumnsFullLeftDirective,
    DbxTwoColumnsContextDirective
  ],
  exports: [
    DbxTwoColumnsComponent,
    DbxTwoColumnsRightComponent,
    DbxTwoColumnsColumnHeadComponent,
    DbxTwoColumnsSrefDirective,
    DbxTwoColumnsBackDirective,
    DbxTwoColumnsFullLeftDirective,
    DbxTwoColumnsContextDirective
  ],
})
export class DbxTwoColumnLayoutModule { }
