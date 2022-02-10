import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxFlexGroupDirective } from './flex.group.directive';
import { DbxFlexSizeDirective } from './flex.size.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxFlexGroupDirective,
    DbxFlexSizeDirective
  ],
  exports: [
    DbxFlexGroupDirective,
    DbxFlexSizeDirective
  ]
})
export class DbxFlexLayoutModule { }
