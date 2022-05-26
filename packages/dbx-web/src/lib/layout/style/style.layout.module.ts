import { DbxSetStyleDirective } from './style.set.directive';
import { DbxStyleDirective } from './style.directive';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxSpacerDirective } from './spacer.directive';
import { DbxStyleBodyDirective } from './style.body.directive';

@NgModule({
  imports: [CommonModule],
  declarations: [DbxSpacerDirective, DbxStyleDirective, DbxSetStyleDirective, DbxStyleBodyDirective],
  exports: [DbxSpacerDirective, DbxStyleDirective, DbxSetStyleDirective, DbxStyleBodyDirective]
})
export class DbxStyleLayoutModule {}
