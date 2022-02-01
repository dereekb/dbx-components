import { NgModule } from '@angular/core';
import { DbxAnchorModule } from './anchor/anchor.module';

@NgModule({
  exports: [
    DbxAnchorModule
  ]
})
export class DbxRouterLayoutModule { }
