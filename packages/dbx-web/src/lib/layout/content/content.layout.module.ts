import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxContentComponent } from './content.component';
import { DbNgxFullWidthContentContainerComponent } from './content.container.fullwidth.component';
import { DbNgxBorderedContentComponent } from './content.bordered.component';
import { DbNgxContentContainerComponent } from './content.container.component';

/**
 * Module for container-type components.
 */
@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbNgxContentComponent,
    DbNgxContentContainerComponent,
    DbNgxBorderedContentComponent,
    DbNgxFullWidthContentContainerComponent
  ],
  exports: [
    DbNgxContentComponent,
    DbNgxContentContainerComponent,
    DbNgxBorderedContentComponent,
    DbNgxFullWidthContentContainerComponent
  ]
})
export class DbNgxContentLayoutModule { }
