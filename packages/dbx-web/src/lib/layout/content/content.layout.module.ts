import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxContentComponent } from './content.component';
import { DbxFullWidthContentContainerComponent } from './content.container.fullwidth.component';
import { DbxBorderedContentComponent } from './content.bordered.component';
import { DbxContentContainerComponent } from './content.container.component';

/**
 * Module for container-type components.
 */
@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxContentComponent,
    DbxContentContainerComponent,
    DbxBorderedContentComponent,
    DbxFullWidthContentContainerComponent
  ],
  exports: [
    DbxContentComponent,
    DbxContentContainerComponent,
    DbxBorderedContentComponent,
    DbxFullWidthContentContainerComponent
  ]
})
export class DbxContentLayoutModule { }
