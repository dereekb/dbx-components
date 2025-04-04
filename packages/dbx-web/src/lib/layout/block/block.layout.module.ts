import { NgModule } from '@angular/core';
import { DbxTwoBlockComponent } from './two.block.component';

/**
 * Module for block components.
 *
 * @deprecated import DbxTwoBlockComponent directly instead.
 */
@NgModule({
  imports: [DbxTwoBlockComponent],
  exports: [DbxTwoBlockComponent]
})
export class DbxBlockLayoutModule {}
