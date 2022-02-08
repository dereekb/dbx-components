import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxSpacerDirective } from './spacer.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxSpacerDirective
  ],
  exports: [
    DbxSpacerDirective
  ]
})
export class DbxStyleLayoutModule { }
