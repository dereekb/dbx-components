import { DbxLoadingModule } from './loading/loading.module';
import { NgModule } from '@angular/core';
import { DbxButtonModule } from './button';
import { DbxActionModule } from './action';

@NgModule({
  exports: [DbxButtonModule, DbxActionModule, DbxLoadingModule]
})
export class DbxWebModule {}
