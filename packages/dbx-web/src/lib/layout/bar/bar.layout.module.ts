import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxLabelBarComponent } from './label.bar.component';

/**
 * Module for block components.
 */
@NgModule({
  imports: [
    CommonModule,
    MatIconModule
  ],
  declarations: [
    DbxLabelBarComponent
  ],
  exports: [
    DbxLabelBarComponent
  ]
})
export class DbxBarLayoutModule { }
