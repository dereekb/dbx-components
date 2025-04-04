import { NgModule } from '@angular/core';
import { DbxNavbarComponent } from './navbar.component';

/**
 * @deprecated import DbxNavbarComponent directly
 */
@NgModule({
  imports: [DbxNavbarComponent],
  exports: [DbxNavbarComponent]
})
export class DbxRouterNavbarModule {}
