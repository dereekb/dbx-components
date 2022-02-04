import { DbxContentElevateComponent } from './content.elevate.component';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxContentComponent } from './content.component';
import { DbxContentBorderComponent } from './content.border.component';
import { DbxContentContainerComponent } from './content.container.component';
import { DbxContentBoxComponent } from './content.box.component';

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
    DbxContentBorderComponent,
    DbxContentElevateComponent,
    DbxContentBoxComponent
  ],
  exports: [
    DbxContentComponent,
    DbxContentContainerComponent,
    DbxContentBorderComponent,
    DbxContentElevateComponent,
    DbxContentBoxComponent
  ]
})
export class DbxContentLayoutModule { }
