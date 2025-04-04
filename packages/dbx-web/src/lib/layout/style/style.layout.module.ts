import { DbxSetStyleDirective } from './style.set.directive';
import { DbxStyleDirective } from './style.directive';
import { NgModule } from '@angular/core';
import { DbxSpacerDirective } from './spacer.directive';
import { DbxStyleBodyDirective } from './style.body.directive';
import { DbxColorDirective } from './style.color.directive';

const importsAndExports = [DbxColorDirective, DbxSpacerDirective, DbxStyleDirective, DbxSetStyleDirective, DbxStyleBodyDirective];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxStyleLayoutModule {}
