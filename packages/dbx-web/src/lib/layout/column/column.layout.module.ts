import { NgModule } from '@angular/core';
import { DbxTwoColumnLayoutModule } from './two';
import { DbxOneColumnLayoutModule } from './one';

@NgModule({
  exports: [
    DbxOneColumnLayoutModule,
    DbxTwoColumnLayoutModule
  ]
})
export class DbxColumnLayoutModule { }
