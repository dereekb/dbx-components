import { DbxSetStyleDirective } from './style.set.directive';
import { DbxStyleDirective } from './style.directive';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxSpacerDirective } from './spacer.directive';
import { DbxStyleBodyDirective } from './style.body.directive';
import { DbxColorDirective } from './style.color.directive';

const declarations = [DbxColorDirective, DbxSpacerDirective, DbxStyleDirective, DbxSetStyleDirective, DbxStyleBodyDirective];

@NgModule({
  imports: [CommonModule],
  declarations,
  exports: declarations
})
export class DbxStyleLayoutModule {}
