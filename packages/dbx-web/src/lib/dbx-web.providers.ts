import { DbxLoadingModule } from './loading/loading.module';
import { NgModule } from '@angular/core';
import { DbxButtonModule } from './button';
import { DbxActionModule } from './action';

/**
 * @deprecated Use DbxButtonModule, DbxActionModule, and DbxLoadingModule directly instead.
 */
@NgModule({
  exports: [DbxButtonModule, DbxActionModule, DbxLoadingModule]
})
export class DbxWebModule {}
