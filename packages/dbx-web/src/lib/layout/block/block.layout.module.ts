import { DbxRouterAnchorModule } from '../../router';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxTwoBlocksComponent } from './two.block.component';
import { AngularResizeEventModule } from 'angular-resize-event';

/**
 * Module for block components.
 */
@NgModule({
  imports: [CommonModule, DbxRouterAnchorModule, AngularResizeEventModule],
  declarations: [DbxTwoBlocksComponent],
  exports: [DbxTwoBlocksComponent]
})
export class DbxBlockLayoutModule {}
