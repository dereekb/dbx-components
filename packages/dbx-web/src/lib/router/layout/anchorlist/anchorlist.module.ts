import { NgModule } from '@angular/core';
import { DbxAnchorListComponent } from './anchorlist.component';

/**
 * @deprecated import standalone DbxAnchorListComponent directly
 */
@NgModule({
  imports: [DbxAnchorListComponent],
  exports: [DbxAnchorListComponent]
})
export class DbxRouterAnchorListModule {}
