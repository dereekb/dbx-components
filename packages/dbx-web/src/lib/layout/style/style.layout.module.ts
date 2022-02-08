import { DbxSetStyleDirective } from './style.set.directive';
import { DbxStyleDirective } from './style.directive';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxSpacerDirective } from './spacer.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxSpacerDirective,
    DbxStyleDirective,
    DbxSetStyleDirective
  ],
  exports: [
    DbxSpacerDirective,
    DbxStyleDirective,
    DbxSetStyleDirective
  ]
})
export class DbxStyleLayoutModule { }
