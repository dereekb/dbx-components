import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxStructureDirective } from './structure.structure.directive';
import { DbxBodyDirective } from './structure.body.directive';

const declarations = [DbxBodyDirective, DbxStructureDirective];

@NgModule({
  imports: [
    //
    CommonModule
  ],
  declarations,
  exports: declarations
})
export class DbxStructureModule {}
