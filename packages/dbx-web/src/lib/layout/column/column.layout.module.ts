import { NgModule } from '@angular/core';
import { DbNgxTwoColumnLayoutModule } from './two';
import { DbNgxOneColumnLayoutModule } from './one';

@NgModule({
  exports: [
    DbNgxOneColumnLayoutModule,
    DbNgxTwoColumnLayoutModule
  ]
})
export class DbNgxColumnLayoutModule { }
