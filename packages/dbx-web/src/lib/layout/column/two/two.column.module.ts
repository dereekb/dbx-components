import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxAnchorModule } from '../../../router';
import { DbNgxContentLayoutModule } from '../../content';
import { DbNgxTwoColumnsSrefDirective } from './two.column.sref.directive';
import { DbNgxTwoColumnsComponent } from './two.column.component';
import { DbNgxTwoColumnsColumnHeadComponent } from './two.column.head.component';
import { DbNgxTwoColumnsRightComponent } from './two.column.right.component';
import { DbNgxTwoColumnsBackDirective } from './two.column.back.directive';
import { DbNgxTwoColumnsFullLeftDirective } from './two.column.full.left.directive';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    DbNgxAnchorModule,
    DbNgxContentLayoutModule
  ],
  declarations: [
    DbNgxTwoColumnsComponent,
    DbNgxTwoColumnsRightComponent,
    DbNgxTwoColumnsColumnHeadComponent,
    DbNgxTwoColumnsSrefDirective,
    DbNgxTwoColumnsBackDirective,
    DbNgxTwoColumnsFullLeftDirective
  ],
  exports: [
    DbNgxTwoColumnsComponent,
    DbNgxTwoColumnsRightComponent,
    DbNgxTwoColumnsColumnHeadComponent,
    DbNgxTwoColumnsSrefDirective,
    DbNgxTwoColumnsBackDirective,
    DbNgxTwoColumnsFullLeftDirective
  ],
})
export class DbNgxTwoColumnLayoutModule { }
