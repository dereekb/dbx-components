import { DbxRouterAnchorModule } from '../../router';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxTwoBlockComponent } from './two.block.component';
import { AngularResizeEventModule } from 'angular-resize-event-package';

/**
 * Module for block components.
 * 
 * @deprecated import DbxTwoBlockComponent directly instead.
 */
@NgModule({
  imports: [DbxTwoBlockComponent],
  exports: [DbxTwoBlockComponent]
})
export class DbxBlockLayoutModule { }
