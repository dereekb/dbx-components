import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxCompactDirective } from './compact.directive';

/**
 * Module for block components.
 */
@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbNgxCompactDirective
  ],
  exports: [
    DbNgxCompactDirective
  ]
})
export class DbNgxCompactLayoutModule { }
