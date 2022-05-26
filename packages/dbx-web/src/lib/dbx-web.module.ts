import { DbxLoadingModule } from './loading/loading.module';
import { NgModule } from '@angular/core';
import { DbxButtonModule } from './button';
import { DbxActionModule } from './action';

@NgModule({
  exports: [DbxButtonModule, DbxActionModule, DbxLoadingModule]
})
export class DbxWebModule {}

/**
 * Should only be imported once in the root app.
 *
 * Pre-configures the following modules:
 */
@NgModule({
  imports: []
})
export class DbxWebRootModule {}
