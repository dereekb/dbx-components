import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxCompactDirective } from './compact.directive';

/**
 * Module for block components.
 */
@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxCompactDirective
  ],
  exports: [
    DbxCompactDirective
  ]
})
export class DbxCompactLayoutModule { }
