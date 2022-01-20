import { DbNgxAnchorModule } from '../../router';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxTwoBlocksComponent } from './two.block.component';
import { AngularResizeEventModule } from 'angular-resize-event';

/**
 * Module for block components.
 */
@NgModule({
  imports: [
    CommonModule,
    DbNgxAnchorModule,
    AngularResizeEventModule
  ],
  declarations: [
    DbNgxTwoBlocksComponent
  ],
  exports: [
    DbNgxTwoBlocksComponent
  ]
})
export class DbNgxBlockLayoutModule { }
